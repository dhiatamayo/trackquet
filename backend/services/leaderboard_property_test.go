package services

import (
	"testing"

	"trackquet/models"

	"pgregory.net/rapid"
)

// Feature: match-tracker, Property 10: Tiebreaker ordering
// **Validates: Requirements 4.9**
//
// For any set of players with equal total_points, the leaderboard SHALL rank them by
// point_diff (descending) as the first tiebreaker, and by head-to-head results as
// the second tiebreaker when point_diff is also equal.

func TestPropertyTiebreakerOrdering(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		// Generate between 2 and 8 players
		numPlayers := rapid.IntRange(2, 8).Draw(t, "numPlayers")

		players := make([]models.MatchPlayer, numPlayers)
		for i := 0; i < numPlayers; i++ {
			players[i] = models.MatchPlayer{
				ID:   uint(i + 1),
				Name: string(rune('A'+i)) + "Player",
			}
		}

		// Generate matchups that create scenarios with equal total_points.
		// Strategy: generate matchups between pairs of players with controlled scores
		// so that some players end up with the same total_points.
		//
		// We generate a target total_points value and create matchups for each player
		// against a "dummy" opponent to reach that target, then create head-to-head
		// matchups between the tied players.

		// Each player plays against every other player exactly once (round-robin singles).
		// We'll generate scores for each pair.
		type matchupDef struct {
			playerA int
			playerB int
			scoreA  int
			scoreB  int
		}

		var matchupDefs []matchupDef
		for i := 0; i < numPlayers; i++ {
			for j := i + 1; j < numPlayers; j++ {
				// Generate scores between 0 and 21 for each side
				scoreA := rapid.IntRange(0, 21).Draw(t, "scoreA")
				scoreB := rapid.IntRange(0, 21).Draw(t, "scoreB")
				matchupDefs = append(matchupDefs, matchupDef{
					playerA: i,
					playerB: j,
					scoreA:  scoreA,
					scoreB:  scoreB,
				})
			}
		}

		// Build matchups from the definitions
		matchups := make([]models.Matchup, len(matchupDefs))
		for idx, md := range matchupDefs {
			scoreA := md.scoreA
			scoreB := md.scoreB
			matchups[idx] = models.Matchup{
				ID:         uint(idx + 1),
				ScoreSideA: &scoreA,
				ScoreSideB: &scoreB,
				Players: []models.MatchupPlayer{
					{MatchPlayerID: uint(md.playerA + 1), Side: models.SideA},
					{MatchPlayerID: uint(md.playerB + 1), Side: models.SideB},
				},
			}
		}

		// Calculate leaderboard
		result := CalculateLeaderboard(players, matchups)

		// Verify property: among entries with equal total_points, they must be ordered
		// by point_diff descending. Among entries with equal total_points AND equal
		// point_diff, head-to-head determines ordering (or they share rank if no h2h).
		for i := 0; i < len(result)-1; i++ {
			for j := i + 1; j < len(result); j++ {
				entryI := result[i]
				entryJ := result[j]

				// Only check tiebreaker among players with equal total_points
				if entryI.TotalPoints != entryJ.TotalPoints {
					continue
				}

				// First tiebreaker: point_diff descending
				// Player at position i should have >= point_diff than player at position j
				if entryI.PointDiff != entryJ.PointDiff {
					if entryI.PointDiff < entryJ.PointDiff {
						t.Fatalf("Tiebreaker violation: player %s (pos %d, pts=%d, diff=%d) "+
							"should not be ranked above player %s (pos %d, pts=%d, diff=%d) "+
							"— point_diff tiebreaker broken",
							entryI.PlayerName, i, entryI.TotalPoints, entryI.PointDiff,
							entryJ.PlayerName, j, entryJ.TotalPoints, entryJ.PointDiff)
					}
					continue
				}

				// Second tiebreaker: head-to-head
				// If they have equal total_points and equal point_diff,
				// the player who wins head-to-head should be ranked higher.
				// Compute head-to-head from matchups.
				h2hNet := computeH2H(entryI.PlayerID, entryJ.PlayerID, matchups)

				if h2hNet > 0 {
					// Player i beat player j in h2h, so i should rank higher (lower rank number)
					if entryI.Rank > entryJ.Rank {
						t.Fatalf("Head-to-head tiebreaker violation: player %s (rank %d) "+
							"beat player %s (rank %d) head-to-head but ranks lower",
							entryI.PlayerName, entryI.Rank,
							entryJ.PlayerName, entryJ.Rank)
					}
				} else if h2hNet < 0 {
					// Player j beat player i in h2h, so j should rank higher
					if entryJ.Rank > entryI.Rank {
						t.Fatalf("Head-to-head tiebreaker violation: player %s (rank %d) "+
							"beat player %s (rank %d) head-to-head but ranks lower",
							entryJ.PlayerName, entryJ.Rank,
							entryI.PlayerName, entryI.Rank)
					}
				} else {
					// No head-to-head advantage: they should share the same rank
					if entryI.Rank != entryJ.Rank {
						t.Fatalf("Tie sharing violation: players %s and %s have equal "+
							"total_points (%d), equal point_diff (%d), and no head-to-head "+
							"advantage, but have different ranks (%d vs %d)",
							entryI.PlayerName, entryJ.PlayerName,
							entryI.TotalPoints, entryI.PointDiff,
							entryI.Rank, entryJ.Rank)
					}
				}
			}
		}
	})
}

// computeH2H calculates the net head-to-head score of playerA vs playerB
// across all matchups. Positive means playerA scored more against playerB overall.
func computeH2H(playerAID, playerBID uint, matchups []models.Matchup) int {
	net := 0
	for _, m := range matchups {
		if m.ScoreSideA == nil || m.ScoreSideB == nil {
			continue
		}

		var aOnSideA, aOnSideB, bOnSideA, bOnSideB bool
		for _, mp := range m.Players {
			if mp.MatchPlayerID == playerAID {
				if mp.Side == models.SideA {
					aOnSideA = true
				} else {
					aOnSideB = true
				}
			}
			if mp.MatchPlayerID == playerBID {
				if mp.Side == models.SideA {
					bOnSideA = true
				} else {
					bOnSideB = true
				}
			}
		}

		scoreA := *m.ScoreSideA
		scoreB := *m.ScoreSideB

		// A on side A, B on side B
		if aOnSideA && bOnSideB {
			net += scoreA - scoreB
		}
		// A on side B, B on side A
		if aOnSideB && bOnSideA {
			net += scoreB - scoreA
		}
	}
	return net
}

// Feature: match-tracker, Property 18: Cumulative points consistency
// **Validates: Requirements 10.2, 10.6**
//
// For any match session after any sequence of score entries or modifications,
// each player's total_points SHALL equal the sum of their side's scores across
// all matchups in which they participated. This invariant holds after every
// score mutation.

func TestPropertyCumulativePointsConsistency(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		// Generate between 2 and 12 players
		numPlayers := rapid.IntRange(2, 12).Draw(t, "numPlayers")

		players := make([]models.MatchPlayer, numPlayers)
		for i := 0; i < numPlayers; i++ {
			players[i] = models.MatchPlayer{
				ID:   uint(i + 1),
				Name: string(rune('A'+i)) + "Player",
			}
		}

		// Generate random matchups: between 1 and numPlayers*2 matchups
		numMatchups := rapid.IntRange(1, numPlayers*2).Draw(t, "numMatchups")

		matchups := make([]models.Matchup, numMatchups)
		for idx := 0; idx < numMatchups; idx++ {
			// Decide how many players per side (1 for singles, 2 for doubles)
			playersPerSide := rapid.IntRange(1, 2).Draw(t, "playersPerSide")

			// We need at least 2*playersPerSide distinct players for this matchup
			totalNeeded := 2 * playersPerSide
			if totalNeeded > numPlayers {
				playersPerSide = 1
				totalNeeded = 2
			}

			// Pick distinct player indices for this matchup
			availableIndices := make([]int, numPlayers)
			for i := range availableIndices {
				availableIndices[i] = i
			}

			// Shuffle using rapid draws to pick random distinct players
			selectedIndices := make([]int, 0, totalNeeded)
			remaining := make([]int, len(availableIndices))
			copy(remaining, availableIndices)

			for pick := 0; pick < totalNeeded; pick++ {
				pickIdx := rapid.IntRange(0, len(remaining)-1).Draw(t, "pickIdx")
				selectedIndices = append(selectedIndices, remaining[pickIdx])
				// Remove picked element
				remaining[pickIdx] = remaining[len(remaining)-1]
				remaining = remaining[:len(remaining)-1]
			}

			// Assign players to sides
			matchupPlayers := make([]models.MatchupPlayer, totalNeeded)
			for i := 0; i < playersPerSide; i++ {
				matchupPlayers[i] = models.MatchupPlayer{
					MatchPlayerID: uint(selectedIndices[i] + 1),
					Side:          models.SideA,
				}
			}
			for i := 0; i < playersPerSide; i++ {
				matchupPlayers[playersPerSide+i] = models.MatchupPlayer{
					MatchPlayerID: uint(selectedIndices[playersPerSide+i] + 1),
					Side:          models.SideB,
				}
			}

			// Randomly decide if this matchup is completed (has scores) or not
			isCompleted := rapid.Bool().Draw(t, "isCompleted")

			if isCompleted {
				scoreA := rapid.IntRange(0, 32).Draw(t, "scoreA")
				scoreB := rapid.IntRange(0, 32).Draw(t, "scoreB")
				matchups[idx] = models.Matchup{
					ID:         uint(idx + 1),
					ScoreSideA: &scoreA,
					ScoreSideB: &scoreB,
					Players:    matchupPlayers,
				}
			} else {
				matchups[idx] = models.Matchup{
					ID:      uint(idx + 1),
					Players: matchupPlayers,
				}
			}
		}

		// Calculate leaderboard
		result := CalculateLeaderboard(players, matchups)

		// Manually compute expected total_points and point_diff for each player
		expectedPoints := make(map[uint]int)
		expectedDiff := make(map[uint]int)
		for i := 0; i < numPlayers; i++ {
			expectedPoints[uint(i+1)] = 0
			expectedDiff[uint(i+1)] = 0
		}

		for _, m := range matchups {
			if m.ScoreSideA == nil || m.ScoreSideB == nil {
				continue
			}
			scoreA := *m.ScoreSideA
			scoreB := *m.ScoreSideB

			for _, mp := range m.Players {
				if mp.Side == models.SideA {
					expectedPoints[mp.MatchPlayerID] += scoreA
					expectedDiff[mp.MatchPlayerID] += scoreA - scoreB
				} else if mp.Side == models.SideB {
					expectedPoints[mp.MatchPlayerID] += scoreB
					expectedDiff[mp.MatchPlayerID] += scoreB - scoreA
				}
			}
		}

		// Verify each leaderboard entry matches expected values
		for _, entry := range result {
			expPts := expectedPoints[entry.PlayerID]
			if entry.TotalPoints != expPts {
				t.Fatalf("Cumulative points mismatch for player %s (ID=%d): "+
					"leaderboard reports total_points=%d but expected %d (sum of side scores)",
					entry.PlayerName, entry.PlayerID, entry.TotalPoints, expPts)
			}

			expDiff := expectedDiff[entry.PlayerID]
			if entry.PointDiff != expDiff {
				t.Fatalf("Point diff mismatch for player %s (ID=%d): "+
					"leaderboard reports point_diff=%d but expected %d (sum of point differences)",
					entry.PlayerName, entry.PlayerID, entry.PointDiff, expDiff)
			}
		}
	})
}
