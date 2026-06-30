package services

import (
	"testing"

	"trackquet/models"

	"github.com/stretchr/testify/assert"
)

func intPtr(v int) *int {
	return &v
}

func TestCalculateLeaderboard_EmptyPlayers(t *testing.T) {
	result := CalculateLeaderboard(nil, nil)
	assert.Empty(t, result)
}

func TestCalculateLeaderboard_NoCompletedMatchups(t *testing.T) {
	players := []models.MatchPlayer{
		{ID: 1, Name: "Alice"},
		{ID: 2, Name: "Bob"},
	}
	matchups := []models.Matchup{
		{ID: 1, ScoreSideA: nil, ScoreSideB: nil},
	}

	result := CalculateLeaderboard(players, matchups)
	assert.Len(t, result, 2)
	for _, entry := range result {
		assert.Equal(t, 0, entry.TotalPoints)
		assert.Equal(t, 0, entry.PointDiff)
		assert.Equal(t, 1, entry.Rank)
	}
}

func TestCalculateLeaderboard_BasicScoring(t *testing.T) {
	players := []models.MatchPlayer{
		{ID: 1, Name: "Alice"},
		{ID: 2, Name: "Bob"},
		{ID: 3, Name: "Charlie"},
		{ID: 4, Name: "Diana"},
	}

	// Matchup 1: Alice+Bob (SideA) vs Charlie+Diana (SideB), score 21-15
	// Matchup 2: Alice+Charlie (SideA) vs Bob+Diana (SideB), score 16-21
	matchups := []models.Matchup{
		{
			ID: 1, ScoreSideA: intPtr(21), ScoreSideB: intPtr(15),
			Players: []models.MatchupPlayer{
				{MatchPlayerID: 1, Side: models.SideA},
				{MatchPlayerID: 2, Side: models.SideA},
				{MatchPlayerID: 3, Side: models.SideB},
				{MatchPlayerID: 4, Side: models.SideB},
			},
		},
		{
			ID: 2, ScoreSideA: intPtr(16), ScoreSideB: intPtr(21),
			Players: []models.MatchupPlayer{
				{MatchPlayerID: 1, Side: models.SideA},
				{MatchPlayerID: 3, Side: models.SideA},
				{MatchPlayerID: 2, Side: models.SideB},
				{MatchPlayerID: 4, Side: models.SideB},
			},
		},
	}

	result := CalculateLeaderboard(players, matchups)
	assert.Len(t, result, 4)

	// Bob: 21+21=42, diff=6+5=11
	// Alice: 21+16=37, diff=6+(-5)=1
	// Diana: 15+21=36, diff=(-6)+5=-1
	// Charlie: 15+16=31, diff=(-6)+(-5)=-11
	assert.Equal(t, "Bob", result[0].PlayerName)
	assert.Equal(t, 42, result[0].TotalPoints)
	assert.Equal(t, 11, result[0].PointDiff)
	assert.Equal(t, 1, result[0].Rank)

	assert.Equal(t, "Alice", result[1].PlayerName)
	assert.Equal(t, 37, result[1].TotalPoints)
	assert.Equal(t, 1, result[1].PointDiff)
	assert.Equal(t, 2, result[1].Rank)

	assert.Equal(t, "Diana", result[2].PlayerName)
	assert.Equal(t, 36, result[2].TotalPoints)
	assert.Equal(t, -1, result[2].PointDiff)
	assert.Equal(t, 3, result[2].Rank)

	assert.Equal(t, "Charlie", result[3].PlayerName)
	assert.Equal(t, 31, result[3].TotalPoints)
	assert.Equal(t, -11, result[3].PointDiff)
	assert.Equal(t, 4, result[3].Rank)
}

func TestCalculateLeaderboard_TieOnPointsBreakByPointDiff(t *testing.T) {
	players := []models.MatchPlayer{
		{ID: 1, Name: "Alice"},
		{ID: 2, Name: "Bob"},
		{ID: 3, Name: "Charlie"},
		{ID: 4, Name: "Diana"},
	}

	// Alice vs Charlie: 21-15 → Alice gets 21, diff +6
	// Bob vs Diana: 21-18 → Bob gets 21, diff +3
	// Both have 21 total points, Alice has better point diff
	matchups := []models.Matchup{
		{
			ID: 1, ScoreSideA: intPtr(21), ScoreSideB: intPtr(15),
			Players: []models.MatchupPlayer{
				{MatchPlayerID: 1, Side: models.SideA},
				{MatchPlayerID: 3, Side: models.SideB},
			},
		},
		{
			ID: 2, ScoreSideA: intPtr(21), ScoreSideB: intPtr(18),
			Players: []models.MatchupPlayer{
				{MatchPlayerID: 2, Side: models.SideA},
				{MatchPlayerID: 4, Side: models.SideB},
			},
		},
	}

	result := CalculateLeaderboard(players, matchups)
	assert.Equal(t, "Alice", result[0].PlayerName)
	assert.Equal(t, 1, result[0].Rank)
	assert.Equal(t, "Bob", result[1].PlayerName)
	assert.Equal(t, 2, result[1].Rank)
}

func TestCalculateLeaderboard_HeadToHeadTiebreaker(t *testing.T) {
	players := []models.MatchPlayer{
		{ID: 1, Name: "Alice"},
		{ID: 2, Name: "Bob"},
		{ID: 3, Name: "Charlie"},
		{ID: 4, Name: "Diana"},
	}

	// Constructed so Alice and Bob end up with equal total points and equal point diff,
	// but Bob beats Alice in their direct matchup.
	// Alice vs Charlie: 21-10 → Alice(pts:21, diff:+11)
	// Bob vs Diana: 15-16 → Bob(pts:15, diff:-1)
	// Alice vs Bob: 10-16 → Alice(pts:31, diff:+5), Bob(pts:31, diff:+5)
	// h2h[Alice][Bob] = 10-16 = -6 (Bob wins head-to-head)
	matchups := []models.Matchup{
		{
			ID: 1, ScoreSideA: intPtr(21), ScoreSideB: intPtr(10),
			Players: []models.MatchupPlayer{
				{MatchPlayerID: 1, Side: models.SideA},
				{MatchPlayerID: 3, Side: models.SideB},
			},
		},
		{
			ID: 2, ScoreSideA: intPtr(15), ScoreSideB: intPtr(16),
			Players: []models.MatchupPlayer{
				{MatchPlayerID: 2, Side: models.SideA},
				{MatchPlayerID: 4, Side: models.SideB},
			},
		},
		{
			ID: 3, ScoreSideA: intPtr(10), ScoreSideB: intPtr(16),
			Players: []models.MatchupPlayer{
				{MatchPlayerID: 1, Side: models.SideA},
				{MatchPlayerID: 2, Side: models.SideB},
			},
		},
	}

	result := CalculateLeaderboard(players, matchups)

	var aliceRank, bobRank int
	for _, e := range result {
		if e.PlayerName == "Alice" {
			aliceRank = e.Rank
			assert.Equal(t, 31, e.TotalPoints)
			assert.Equal(t, 5, e.PointDiff)
		}
		if e.PlayerName == "Bob" {
			bobRank = e.Rank
			assert.Equal(t, 31, e.TotalPoints)
			assert.Equal(t, 5, e.PointDiff)
		}
	}

	assert.Less(t, bobRank, aliceRank, "Bob should rank higher than Alice due to head-to-head")
}

func TestCalculateLeaderboard_TiedRanksShared(t *testing.T) {
	players := []models.MatchPlayer{
		{ID: 1, Name: "Alice"},
		{ID: 2, Name: "Bob"},
		{ID: 3, Name: "Charlie"},
		{ID: 4, Name: "Diana"},
	}

	// Alice and Bob have identical results against different opponents, never face each other
	matchups := []models.Matchup{
		{
			ID: 1, ScoreSideA: intPtr(21), ScoreSideB: intPtr(15),
			Players: []models.MatchupPlayer{
				{MatchPlayerID: 1, Side: models.SideA},
				{MatchPlayerID: 3, Side: models.SideB},
			},
		},
		{
			ID: 2, ScoreSideA: intPtr(21), ScoreSideB: intPtr(15),
			Players: []models.MatchupPlayer{
				{MatchPlayerID: 2, Side: models.SideA},
				{MatchPlayerID: 4, Side: models.SideB},
			},
		},
	}

	result := CalculateLeaderboard(players, matchups)

	// Alice and Bob: same points (21), same diff (+6), no h2h → same rank
	assert.Equal(t, result[0].Rank, result[1].Rank)
	assert.Equal(t, 1, result[0].Rank)

	// Charlie and Diana: same points (15), same diff (-6), no h2h → same rank
	assert.Equal(t, result[2].Rank, result[3].Rank)
	assert.Equal(t, 3, result[2].Rank)
}

func TestCalculateLeaderboard_SkipsIncompleteMatchups(t *testing.T) {
	players := []models.MatchPlayer{
		{ID: 1, Name: "Alice"},
		{ID: 2, Name: "Bob"},
	}

	matchups := []models.Matchup{
		{
			ID: 1, ScoreSideA: intPtr(21), ScoreSideB: nil,
			Players: []models.MatchupPlayer{
				{MatchPlayerID: 1, Side: models.SideA},
				{MatchPlayerID: 2, Side: models.SideB},
			},
		},
		{
			ID: 2, ScoreSideA: nil, ScoreSideB: intPtr(16),
			Players: []models.MatchupPlayer{
				{MatchPlayerID: 1, Side: models.SideA},
				{MatchPlayerID: 2, Side: models.SideB},
			},
		},
	}

	result := CalculateLeaderboard(players, matchups)
	for _, entry := range result {
		assert.Equal(t, 0, entry.TotalPoints)
		assert.Equal(t, 0, entry.PointDiff)
	}
}
