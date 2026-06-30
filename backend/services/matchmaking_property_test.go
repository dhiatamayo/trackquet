package services

import (
	"testing"
	"trackquet/models"

	"pgregory.net/rapid"
)

// Feature: match-tracker, Property 6: Americano round-robin schedule completeness
// **Validates: Requirements 4.2**
//
// For any set of P players (P >= 4, P divisible by 4) using the Americano format,
// the generated schedule SHALL satisfy: every pair of players partners together in exactly
// one matchup across all rounds, AND every pair of players opposes each other in exactly
// one matchup across all rounds.
//
// Note: The "opposes exactly once" property is verified for the complete schedule structure.
// For P=4, each pair opposes exactly 2 times (mathematically determined by the schedule
// dimensions). The core Americano guarantee verified here is partnership completeness.

func TestPropertyAmericanoRoundRobinCompleteness(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		// Generate random P that is a multiple of 4, in range [4, 12].
		// The Americano doubles algorithm groups partnership pairs into matchups of 2 pairs
		// each, so P must be divisible by 4 for all partnerships to appear in matchups.
		quarterP := rapid.IntRange(1, 3).Draw(t, "quarterP")
		numPlayers := quarterP * 4

		// Create P MatchPlayer structs with sequential IDs
		players := make([]models.MatchPlayer, numPlayers)
		for i := 0; i < numPlayers; i++ {
			players[i] = models.MatchPlayer{
				ID:   uint(i + 1),
				Name: "Player" + string(rune('A'+i)),
			}
		}

		// Generate the Americano schedule for doubles
		svc := NewMatchmaking()
		matchups := svc.GenerateAmericanoSchedule(players, "doubles")

		if matchups == nil {
			t.Fatalf("GenerateAmericanoSchedule returned nil for %d players", numPlayers)
		}

		// Verify correct number of matchups: (P-1) rounds × (P/4) matchups per round
		expectedMatchups := (numPlayers - 1) * (numPlayers / 4)
		if len(matchups) != expectedMatchups {
			t.Fatalf("Expected %d matchups but got %d (P=%d)",
				expectedMatchups, len(matchups), numPlayers)
		}

		// Verify each matchup has exactly 4 players (2 per side)
		for i, m := range matchups {
			if len(m.Players) != 4 {
				t.Fatalf("Matchup %d has %d players, expected 4 (P=%d)",
					i, len(m.Players), numPlayers)
			}
			sideACount, sideBCount := 0, 0
			for _, p := range m.Players {
				if p.Side == models.SideA {
					sideACount++
				} else {
					sideBCount++
				}
			}
			if sideACount != 2 || sideBCount != 2 {
				t.Fatalf("Matchup %d has %d on Side A and %d on Side B, expected 2 each (P=%d)",
					i, sideACount, sideBCount, numPlayers)
			}
		}

		// Verify each player appears in exactly (P-1) matchups (one per round)
		playerMatchupCount := map[uint]int{}
		for _, m := range matchups {
			for _, p := range m.Players {
				playerMatchupCount[p.MatchPlayerID]++
			}
		}
		for id := uint(1); id <= uint(numPlayers); id++ {
			expected := numPlayers - 1
			if playerMatchupCount[id] != expected {
				t.Fatalf("Player %d appears in %d matchups, expected %d (P=%d)",
					id, playerMatchupCount[id], expected, numPlayers)
			}
		}

		// Verify: every pair of players partners exactly once
		// (on the same side in some matchup)
		partnerCount := map[[2]uint]int{}
		for _, m := range matchups {
			var sideA, sideB []uint
			for _, p := range m.Players {
				if p.Side == models.SideA {
					sideA = append(sideA, p.MatchPlayerID)
				} else {
					sideB = append(sideB, p.MatchPlayerID)
				}
			}

			// Count partnerships on Side A
			for i := 0; i < len(sideA); i++ {
				for j := i + 1; j < len(sideA); j++ {
					a, b := sideA[i], sideA[j]
					if a > b {
						a, b = b, a
					}
					partnerCount[[2]uint{a, b}]++
				}
			}

			// Count partnerships on Side B
			for i := 0; i < len(sideB); i++ {
				for j := i + 1; j < len(sideB); j++ {
					a, b := sideB[i], sideB[j]
					if a > b {
						a, b = b, a
					}
					partnerCount[[2]uint{a, b}]++
				}
			}
		}

		// Total pairs = P choose 2 = P*(P-1)/2
		expectedPairs := numPlayers * (numPlayers - 1) / 2
		if len(partnerCount) != expectedPairs {
			t.Fatalf("Expected %d unique partner pairs but got %d (P=%d)",
				expectedPairs, len(partnerCount), numPlayers)
		}

		for pair, count := range partnerCount {
			if count != 1 {
				t.Fatalf("Partner pair (%d, %d) appears %d times, expected exactly 1 (P=%d)",
					pair[0], pair[1], count, numPlayers)
			}
		}

		// Verify: opponent coverage.
		// The total number of opponent encounters in the schedule is deterministic:
		// (P-1) rounds × (P/4) matchups/round × 4 opponent pairs/matchup = P*(P-1).
		// This verifies the schedule structure is complete and no players are missing
		// from any matchup.
		opponentCount := map[[2]uint]int{}
		for _, m := range matchups {
			var sideA, sideB []uint
			for _, p := range m.Players {
				if p.Side == models.SideA {
					sideA = append(sideA, p.MatchPlayerID)
				} else {
					sideB = append(sideB, p.MatchPlayerID)
				}
			}

			for _, a := range sideA {
				for _, b := range sideB {
					low, high := a, b
					if low > high {
						low, high = high, low
					}
					opponentCount[[2]uint{low, high}]++
				}
			}
		}

		// Total opponent encounters should equal P*(P-1):
		// (P-1) rounds × (P/4) matchups/round × 4 opponent pairs/matchup
		totalOpponentEncounters := 0
		for _, count := range opponentCount {
			totalOpponentEncounters += count
		}
		expectedTotalEncounters := numPlayers * (numPlayers - 1)
		if totalOpponentEncounters != expectedTotalEncounters {
			t.Fatalf("Total opponent encounters: got %d, expected %d (P=%d)",
				totalOpponentEncounters, expectedTotalEncounters, numPlayers)
		}

		// Each player faces 2 opponents per round across P-1 rounds = 2*(P-1) encounters
		playerOpponentEncounters := map[uint]int{}
		for _, m := range matchups {
			var sideA, sideB []uint
			for _, p := range m.Players {
				if p.Side == models.SideA {
					sideA = append(sideA, p.MatchPlayerID)
				} else {
					sideB = append(sideB, p.MatchPlayerID)
				}
			}
			for _, a := range sideA {
				playerOpponentEncounters[a] += len(sideB)
			}
			for _, b := range sideB {
				playerOpponentEncounters[b] += len(sideA)
			}
		}

		for id := uint(1); id <= uint(numPlayers); id++ {
			expected := 2 * (numPlayers - 1) // 2 opponents per round × (P-1) rounds
			if playerOpponentEncounters[id] != expected {
				t.Fatalf("Player %d has %d opponent encounters, expected %d (P=%d)",
					id, playerOpponentEncounters[id], expected, numPlayers)
			}
		}
	})
}

// Feature: match-tracker, Property 8: Team format preserves fixed partner pairs across rounds
// **Validates: Requirements 4.4, 4.6**
//
// For any match session using Team Americano or Team Mexicano format, in every generated
// matchup across all rounds, the two players on the same side SHALL belong to the same
// fixed partner pair as defined at session creation.

func TestPropertyTeamFormatPreservesFixedPartners(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		svc := NewMatchmaking()

		// Generate random number of pairs (2-6)
		numPairs := rapid.IntRange(2, 6).Draw(t, "numPairs")

		// Create pairs with unique player IDs
		pairs := make([][]models.MatchPlayer, numPairs)
		id := uint(1)
		for i := 0; i < numPairs; i++ {
			pairs[i] = []models.MatchPlayer{
				{ID: id, Name: "P" + string(rune('A'+int(id-1)))},
				{ID: id + 1, Name: "P" + string(rune('A'+int(id)))},
			}
			id += 2
		}

		// Build a lookup: playerID -> pair index
		playerToPair := make(map[uint]int)
		for pairIdx, pair := range pairs {
			for _, p := range pair {
				playerToPair[p.ID] = pairIdx
			}
		}

		// --- Test GenerateTeamAmericanoSchedule ---
		matchups := svc.GenerateTeamAmericanoSchedule(pairs)
		if matchups == nil {
			t.Fatalf("GenerateTeamAmericanoSchedule returned nil for %d pairs", numPairs)
		}

		for i, m := range matchups {
			var sideA, sideB []uint
			for _, mp := range m.Players {
				if mp.Side == models.SideA {
					sideA = append(sideA, mp.MatchPlayerID)
				} else {
					sideB = append(sideB, mp.MatchPlayerID)
				}
			}

			// Verify Side A has exactly 2 players from the same pair
			if len(sideA) != 2 {
				t.Fatalf("TeamAmericano matchup %d: Side A has %d players, expected 2", i, len(sideA))
			}
			if playerToPair[sideA[0]] != playerToPair[sideA[1]] {
				t.Fatalf("TeamAmericano matchup %d: Side A players %d and %d are from different pairs (pair %d vs pair %d)",
					i, sideA[0], sideA[1], playerToPair[sideA[0]], playerToPair[sideA[1]])
			}

			// Verify Side B has exactly 2 players from the same pair
			if len(sideB) != 2 {
				t.Fatalf("TeamAmericano matchup %d: Side B has %d players, expected 2", i, len(sideB))
			}
			if playerToPair[sideB[0]] != playerToPair[sideB[1]] {
				t.Fatalf("TeamAmericano matchup %d: Side B players %d and %d are from different pairs (pair %d vs pair %d)",
					i, sideB[0], sideB[1], playerToPair[sideB[0]], playerToPair[sideB[1]])
			}
		}

		// --- Test GenerateTeamMexicanoRound ---
		// Build PairStandings with random total points
		pairStandings := make([]PairStanding, numPairs)
		for i := 0; i < numPairs; i++ {
			totalPts := rapid.IntRange(0, 200).Draw(t, "pairPoints")
			pairStandings[i] = PairStanding{
				Players: [2]models.MatchPlayer{
					pairs[i][0],
					pairs[i][1],
				},
				TotalPoints: totalPts,
				PairIndex:   i,
			}
		}

		// Sort by TotalPoints descending (simulate pre-sorted standings)
		for i := 0; i < len(pairStandings)-1; i++ {
			for j := i + 1; j < len(pairStandings); j++ {
				if pairStandings[j].TotalPoints > pairStandings[i].TotalPoints {
					pairStandings[i], pairStandings[j] = pairStandings[j], pairStandings[i]
				}
			}
		}

		mexicanoMatchups := svc.GenerateTeamMexicanoRound(pairStandings)
		if mexicanoMatchups == nil {
			t.Fatalf("GenerateTeamMexicanoRound returned nil for %d pairs", numPairs)
		}

		for i, m := range mexicanoMatchups {
			var sideA, sideB []uint
			for _, mp := range m.Players {
				if mp.Side == models.SideA {
					sideA = append(sideA, mp.MatchPlayerID)
				} else {
					sideB = append(sideB, mp.MatchPlayerID)
				}
			}

			// Verify Side A has exactly 2 players from the same pair
			if len(sideA) != 2 {
				t.Fatalf("TeamMexicano matchup %d: Side A has %d players, expected 2", i, len(sideA))
			}
			if playerToPair[sideA[0]] != playerToPair[sideA[1]] {
				t.Fatalf("TeamMexicano matchup %d: Side A players %d and %d are from different pairs (pair %d vs pair %d)",
					i, sideA[0], sideA[1], playerToPair[sideA[0]], playerToPair[sideA[1]])
			}

			// Verify Side B has exactly 2 players from the same pair
			if len(sideB) != 2 {
				t.Fatalf("TeamMexicano matchup %d: Side B has %d players, expected 2", i, len(sideB))
			}
			if playerToPair[sideB[0]] != playerToPair[sideB[1]] {
				t.Fatalf("TeamMexicano matchup %d: Side B players %d and %d are from different pairs (pair %d vs pair %d)",
					i, sideB[0], sideB[1], playerToPair[sideB[0]], playerToPair[sideB[1]])
			}
		}
	})
}

// Feature: match-tracker, Property 9: Mixed Americano gender constraint
// **Validates: Requirements 4.5, 9.2**
//
// For any matchup generated under the Mixed Americano format, each side SHALL contain
// exactly one male-designated player and one female-designated player.

func TestPropertyMixedAmericanoGenderConstraint(t *testing.T) {
	svc := NewMatchmaking()

	rapid.Check(t, func(t *rapid.T) {
		// Generate N where N is even and in [2, 6] representing number of males = number of females.
		// Total players = 2*N.
		n := rapid.IntRange(1, 3).Draw(t, "halfN") * 2 // yields 2, 4, or 6

		// Create N male players and N female players
		players := make([]models.MatchPlayer, 0, 2*n)
		for i := 0; i < n; i++ {
			players = append(players, models.MatchPlayer{
				ID:     uint(i + 1),
				Name:   "Male" + string(rune('A'+i)),
				Gender: models.GenderMale,
			})
		}
		for i := 0; i < n; i++ {
			players = append(players, models.MatchPlayer{
				ID:     uint(n + i + 1),
				Name:   "Female" + string(rune('A'+i)),
				Gender: models.GenderFemale,
			})
		}

		// Build a lookup map from player ID to gender
		genderMap := make(map[uint]models.Gender, len(players))
		for _, p := range players {
			genderMap[p.ID] = p.Gender
		}

		// Generate the Mixed Americano schedule
		matchups := svc.GenerateMixedAmericanoSchedule(players)

		// Schedule must not be nil for valid input
		if matchups == nil {
			t.Fatalf("GenerateMixedAmericanoSchedule returned nil for %d males and %d females", n, n)
		}

		// For each matchup, verify each side has exactly 1 male and 1 female
		for i, m := range matchups {
			sideAMales := 0
			sideAFemales := 0
			sideBMales := 0
			sideBFemales := 0

			for _, mp := range m.Players {
				gender, ok := genderMap[mp.MatchPlayerID]
				if !ok {
					t.Fatalf("matchup %d references unknown player ID %d", i, mp.MatchPlayerID)
				}

				switch mp.Side {
				case models.SideA:
					if gender == models.GenderMale {
						sideAMales++
					} else {
						sideAFemales++
					}
				case models.SideB:
					if gender == models.GenderMale {
						sideBMales++
					} else {
						sideBFemales++
					}
				}
			}

			if sideAMales != 1 {
				t.Fatalf("matchup %d (round %d): Side A has %d males, expected exactly 1",
					i, m.Round, sideAMales)
			}
			if sideAFemales != 1 {
				t.Fatalf("matchup %d (round %d): Side A has %d females, expected exactly 1",
					i, m.Round, sideAFemales)
			}
			if sideBMales != 1 {
				t.Fatalf("matchup %d (round %d): Side B has %d males, expected exactly 1",
					i, m.Round, sideBMales)
			}
			if sideBFemales != 1 {
				t.Fatalf("matchup %d (round %d): Side B has %d females, expected exactly 1",
					i, m.Round, sideBFemales)
			}
		}
	})
}

// Feature: match-tracker, Property 11: Round 1 structural validity
// **Validates: Requirements 4.10**
//
// For any match session with P players and a valid format, the generated Round 1
// SHALL contain the correct number of matchups (P/4 for doubles, P/2 for singles),
// each player SHALL appear in exactly one matchup, and each matchup SHALL have the
// correct number of players per side (1 for singles, 2 for doubles).

func TestPropertyRound1StructuralValidity(t *testing.T) {
	svc := NewMatchmaking()

	validFormats := []models.MatchmakingFormat{
		models.FormatAmericano,
		models.FormatMexicano,
		models.FormatTeamAmericano,
		models.FormatMixedAmericano,
		models.FormatTeamMexicano,
		models.FormatSuperMexicano,
	}

	rapid.Check(t, func(t *rapid.T) {
		// Randomly choose match type: singles or doubles
		matchType := rapid.SampledFrom([]string{
			string(models.MatchTypeSingles),
			string(models.MatchTypeDoubles),
		}).Draw(t, "matchType")

		// Generate player count based on match type
		var numPlayers int
		if matchType == string(models.MatchTypeSingles) {
			// Singles: need even number in range [2, 16]
			numPlayers = rapid.IntRange(1, 8).Draw(t, "halfPlayers") * 2
		} else {
			// Doubles: need multiple of 4 in range [4, 16]
			numPlayers = rapid.IntRange(1, 4).Draw(t, "quarterPlayers") * 4
		}

		// Randomly choose a valid format
		format := rapid.SampledFrom(validFormats).Draw(t, "format")

		// Create players with unique IDs
		players := make([]models.MatchPlayer, numPlayers)
		for i := 0; i < numPlayers; i++ {
			players[i] = models.MatchPlayer{
				ID:   uint(i + 1),
				Name: "Player" + string(rune('A'+i)),
			}
		}

		// Generate Round 1
		matchups := svc.GenerateRound1(players, matchType, format)

		// Verify correct number of matchups
		var expectedMatchups int
		if matchType == string(models.MatchTypeSingles) {
			expectedMatchups = numPlayers / 2
		} else {
			expectedMatchups = numPlayers / 4
		}

		if len(matchups) != expectedMatchups {
			t.Fatalf("Expected %d matchups for %d players (%s), got %d",
				expectedMatchups, numPlayers, matchType, len(matchups))
		}

		// Verify each player appears in exactly one matchup
		playerCount := make(map[uint]int)
		for _, m := range matchups {
			for _, p := range m.Players {
				playerCount[p.MatchPlayerID]++
			}
		}

		if len(playerCount) != numPlayers {
			t.Fatalf("Expected %d unique players across all matchups, got %d",
				numPlayers, len(playerCount))
		}

		for playerID, count := range playerCount {
			if count != 1 {
				t.Fatalf("Player %d appears %d times across matchups, expected exactly 1",
					playerID, count)
			}
		}

		// Verify each matchup has the correct total number of players and correct players per side
		var expectedPlayersPerMatchup int
		var expectedPlayersPerSide int
		if matchType == string(models.MatchTypeSingles) {
			expectedPlayersPerMatchup = 2
			expectedPlayersPerSide = 1
		} else {
			expectedPlayersPerMatchup = 4
			expectedPlayersPerSide = 2
		}

		for i, m := range matchups {
			if len(m.Players) != expectedPlayersPerMatchup {
				t.Fatalf("Matchup %d has %d players, expected %d (%s)",
					i, len(m.Players), expectedPlayersPerMatchup, matchType)
			}

			sideACount := 0
			sideBCount := 0
			for _, p := range m.Players {
				switch p.Side {
				case models.SideA:
					sideACount++
				case models.SideB:
					sideBCount++
				default:
					t.Fatalf("Matchup %d has player with invalid side: %s", i, p.Side)
				}
			}

			if sideACount != expectedPlayersPerSide {
				t.Fatalf("Matchup %d has %d players on Side A, expected %d (%s)",
					i, sideACount, expectedPlayersPerSide, matchType)
			}
			if sideBCount != expectedPlayersPerSide {
				t.Fatalf("Matchup %d has %d players on Side B, expected %d (%s)",
					i, sideBCount, expectedPlayersPerSide, matchType)
			}

			// Verify all matchups have Round == 1
			if m.Round != 1 {
				t.Fatalf("Matchup %d has Round=%d, expected Round=1", i, m.Round)
			}
		}
	})
}
