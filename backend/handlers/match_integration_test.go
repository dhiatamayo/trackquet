package handlers_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"

	"trackquet/database"
	"trackquet/handlers"
	"trackquet/middleware"
	"trackquet/models"
	"trackquet/services"
	"trackquet/testhelper"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// setupIntegrationRouter sets up a router with all match routes needed for integration tests.
func setupIntegrationRouter() *gin.Engine {
	r := testhelper.NewRouter()
	r.Use(middleware.RequireAuth)
	r.POST("/api/matches/:id/start", handlers.StartMatchSession)
	r.POST("/api/matches/:id/finish", handlers.FinishMatchSession)
	r.GET("/api/matches/:id/matchups", handlers.ListMatchups)
	r.GET("/api/matches/:id/matchups/:matchupId", handlers.GetMatchup)
	r.PUT("/api/matches/:id/matchups/:matchupId", handlers.UpdateMatchup)
	r.GET("/api/matches/:id/leaderboard", handlers.GetLeaderboard)
	return r
}

// --- Integration Test: Score Entry Updates Cumulative Points (Req 10.2) ---

func TestIntegration_ScoreEntryUpdatesCumulativePoints(t *testing.T) {
	initMatchTestDB(t)
	r := setupIntegrationRouter()

	user := createTestUser(t, "integ-score-points@test.com")

	// Create a points-based session with 4 players and 2 matchups
	session := models.MatchSession{
		UserID:            user.ID,
		Name:              "Integration Score Test",
		Date:              time.Now(),
		SportType:         models.SportPadel,
		MatchType:         models.MatchTypeDoubles,
		Format:            models.FormatAmericano,
		WinConditionType:  models.WinConditionPoints,
		WinConditionValue: 21,
	}
	database.DB.Create(&session)

	players := []models.MatchPlayer{
		{MatchSessionID: session.ID, Name: "Alice"},
		{MatchSessionID: session.ID, Name: "Bob"},
		{MatchSessionID: session.ID, Name: "Charlie"},
		{MatchSessionID: session.ID, Name: "Diana"},
	}
	database.DB.Create(&players)

	// Create two matchups in the same round (different court assignments)
	matchup1 := models.Matchup{MatchSessionID: session.ID, Round: 1}
	database.DB.Create(&matchup1)
	database.DB.Create(&[]models.MatchupPlayer{
		{MatchupID: matchup1.ID, MatchPlayerID: players[0].ID, Side: models.SideA},
		{MatchupID: matchup1.ID, MatchPlayerID: players[1].ID, Side: models.SideA},
		{MatchupID: matchup1.ID, MatchPlayerID: players[2].ID, Side: models.SideB},
		{MatchupID: matchup1.ID, MatchPlayerID: players[3].ID, Side: models.SideB},
	})

	// Enter score for matchup 1: Side A wins 21-15
	body := `{"score_side_a": 21, "score_side_b": 15}`
	req := testhelper.ReqAuth("PUT", fmt.Sprintf("/api/matches/%d/matchups/%d", session.ID, matchup1.ID), body, user.ID)
	w := testhelper.Do(r, req)
	require.Equal(t, http.StatusOK, w.Code)

	// Verify cumulative points were updated in DB
	var updatedPlayers []models.MatchPlayer
	database.DB.Where("match_session_id = ?", session.ID).Find(&updatedPlayers)

	for _, p := range updatedPlayers {
		if p.Name == "Alice" || p.Name == "Bob" {
			assert.Equal(t, 21, p.TotalPoints, "Side A player %s should have 21 points", p.Name)
			assert.Equal(t, 6, p.PointDiff, "Side A player %s should have +6 point diff", p.Name)
		} else {
			assert.Equal(t, 15, p.TotalPoints, "Side B player %s should have 15 points", p.Name)
			assert.Equal(t, -6, p.PointDiff, "Side B player %s should have -6 point diff", p.Name)
		}
	}
}

// --- Integration Test: Leaderboard Recalculation on Score Entry (Req 10.3) ---

func TestIntegration_LeaderboardRecalculationOnScoreEntry(t *testing.T) {
	initMatchTestDB(t)
	r := setupIntegrationRouter()

	user := createTestUser(t, "integ-leaderboard@test.com")

	session := models.MatchSession{
		UserID:            user.ID,
		Name:              "Leaderboard Integration",
		Date:              time.Now(),
		SportType:         models.SportPadel,
		MatchType:         models.MatchTypeDoubles,
		Format:            models.FormatAmericano,
		WinConditionType:  models.WinConditionPoints,
		WinConditionValue: 21,
	}
	database.DB.Create(&session)

	players := []models.MatchPlayer{
		{MatchSessionID: session.ID, Name: "Alice"},
		{MatchSessionID: session.ID, Name: "Bob"},
		{MatchSessionID: session.ID, Name: "Charlie"},
		{MatchSessionID: session.ID, Name: "Diana"},
	}
	database.DB.Create(&players)

	matchup := models.Matchup{MatchSessionID: session.ID, Round: 1}
	database.DB.Create(&matchup)
	database.DB.Create(&[]models.MatchupPlayer{
		{MatchupID: matchup.ID, MatchPlayerID: players[0].ID, Side: models.SideA},
		{MatchupID: matchup.ID, MatchPlayerID: players[1].ID, Side: models.SideA},
		{MatchupID: matchup.ID, MatchPlayerID: players[2].ID, Side: models.SideB},
		{MatchupID: matchup.ID, MatchPlayerID: players[3].ID, Side: models.SideB},
	})

	// Enter score: Side A wins 21-10
	body := `{"score_side_a": 21, "score_side_b": 10}`
	req := testhelper.ReqAuth("PUT", fmt.Sprintf("/api/matches/%d/matchups/%d", session.ID, matchup.ID), body, user.ID)
	w := testhelper.Do(r, req)
	require.Equal(t, http.StatusOK, w.Code)

	// Fetch leaderboard
	req = testhelper.ReqAuth("GET", fmt.Sprintf("/api/matches/%d/leaderboard", session.ID), "", user.ID)
	w = testhelper.Do(r, req)
	require.Equal(t, http.StatusOK, w.Code)

	var leaderboard []services.LeaderboardEntry
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &leaderboard))

	// Leaderboard should have 4 entries
	require.Len(t, leaderboard, 4)

	// Top two should be Alice and Bob (21 points each), bottom two should be Charlie and Diana (10 points each)
	assert.Equal(t, 21, leaderboard[0].TotalPoints)
	assert.Equal(t, 21, leaderboard[1].TotalPoints)
	assert.Equal(t, 10, leaderboard[2].TotalPoints)
	assert.Equal(t, 10, leaderboard[3].TotalPoints)

	// Ranks: top two tied at rank 1, bottom two tied at rank 3
	assert.Equal(t, 1, leaderboard[0].Rank)
	assert.Equal(t, 1, leaderboard[1].Rank)
	assert.Equal(t, 3, leaderboard[2].Rank)
	assert.Equal(t, 3, leaderboard[3].Rank)
}

// --- Integration Test: Leaderboard Recalculation on Score Modification (Req 10.6) ---

func TestIntegration_LeaderboardRecalculationOnScoreModification(t *testing.T) {
	initMatchTestDB(t)
	r := setupIntegrationRouter()

	user := createTestUser(t, "integ-score-modify@test.com")

	session := models.MatchSession{
		UserID:            user.ID,
		Name:              "Score Modification Integration",
		Date:              time.Now(),
		SportType:         models.SportPadel,
		MatchType:         models.MatchTypeDoubles,
		Format:            models.FormatAmericano,
		WinConditionType:  models.WinConditionPoints,
		WinConditionValue: 21,
	}
	database.DB.Create(&session)

	players := []models.MatchPlayer{
		{MatchSessionID: session.ID, Name: "Alice"},
		{MatchSessionID: session.ID, Name: "Bob"},
		{MatchSessionID: session.ID, Name: "Charlie"},
		{MatchSessionID: session.ID, Name: "Diana"},
	}
	database.DB.Create(&players)

	matchup := models.Matchup{MatchSessionID: session.ID, Round: 1}
	database.DB.Create(&matchup)
	database.DB.Create(&[]models.MatchupPlayer{
		{MatchupID: matchup.ID, MatchPlayerID: players[0].ID, Side: models.SideA},
		{MatchupID: matchup.ID, MatchPlayerID: players[1].ID, Side: models.SideA},
		{MatchupID: matchup.ID, MatchPlayerID: players[2].ID, Side: models.SideB},
		{MatchupID: matchup.ID, MatchPlayerID: players[3].ID, Side: models.SideB},
	})

	// Step 1: Enter initial score - Side A wins 21-10
	body := `{"score_side_a": 21, "score_side_b": 10}`
	req := testhelper.ReqAuth("PUT", fmt.Sprintf("/api/matches/%d/matchups/%d", session.ID, matchup.ID), body, user.ID)
	w := testhelper.Do(r, req)
	require.Equal(t, http.StatusOK, w.Code)

	// Verify initial leaderboard
	req = testhelper.ReqAuth("GET", fmt.Sprintf("/api/matches/%d/leaderboard", session.ID), "", user.ID)
	w = testhelper.Do(r, req)
	require.Equal(t, http.StatusOK, w.Code)

	var leaderboard1 []services.LeaderboardEntry
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &leaderboard1))
	require.Len(t, leaderboard1, 4)
	assert.Equal(t, 21, leaderboard1[0].TotalPoints)
	assert.Equal(t, 10, leaderboard1[2].TotalPoints)

	// Step 2: Modify score - now Side B wins 21-5
	body = `{"score_side_a": 5, "score_side_b": 21}`
	req = testhelper.ReqAuth("PUT", fmt.Sprintf("/api/matches/%d/matchups/%d", session.ID, matchup.ID), body, user.ID)
	w = testhelper.Do(r, req)
	require.Equal(t, http.StatusOK, w.Code)

	// Step 3: Verify leaderboard reflects new values
	req = testhelper.ReqAuth("GET", fmt.Sprintf("/api/matches/%d/leaderboard", session.ID), "", user.ID)
	w = testhelper.Do(r, req)
	require.Equal(t, http.StatusOK, w.Code)

	var leaderboard2 []services.LeaderboardEntry
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &leaderboard2))
	require.Len(t, leaderboard2, 4)

	// Now Charlie and Diana should be at the top (21 points), Alice and Bob at bottom (5 points)
	assert.Equal(t, 21, leaderboard2[0].TotalPoints)
	assert.Equal(t, 21, leaderboard2[1].TotalPoints)
	assert.Equal(t, 5, leaderboard2[2].TotalPoints)
	assert.Equal(t, 5, leaderboard2[3].TotalPoints)

	// Verify the top players are Charlie/Diana
	topNames := []string{leaderboard2[0].PlayerName, leaderboard2[1].PlayerName}
	assert.Contains(t, topNames, "Charlie")
	assert.Contains(t, topNames, "Diana")

	// Verify point diffs are also recalculated correctly
	assert.Equal(t, 16, leaderboard2[0].PointDiff)  // 21-5 = +16
	assert.Equal(t, -16, leaderboard2[2].PointDiff) // 5-21 = -16
}

// --- Integration Test: Round Completion Triggers Next Round for Mexicano (Req 10.4) ---

func TestIntegration_RoundCompletionTriggersNextRoundMexicano(t *testing.T) {
	initMatchTestDB(t)
	r := setupIntegrationRouter()

	user := createTestUser(t, "integ-mexicano-round@test.com")

	// Create a Mexicano session (standings-based, generates only Round 1 initially)
	session := models.MatchSession{
		UserID:            user.ID,
		Name:              "Mexicano Integration",
		Date:              time.Now(),
		SportType:         models.SportPadel,
		MatchType:         models.MatchTypeDoubles,
		Format:            models.FormatMexicano,
		WinConditionType:  models.WinConditionPoints,
		WinConditionValue: 21,
	}
	database.DB.Create(&session)

	// Create 8 players for 2 matchups per round
	players := []models.MatchPlayer{
		{MatchSessionID: session.ID, Name: "P1"},
		{MatchSessionID: session.ID, Name: "P2"},
		{MatchSessionID: session.ID, Name: "P3"},
		{MatchSessionID: session.ID, Name: "P4"},
		{MatchSessionID: session.ID, Name: "P5"},
		{MatchSessionID: session.ID, Name: "P6"},
		{MatchSessionID: session.ID, Name: "P7"},
		{MatchSessionID: session.ID, Name: "P8"},
	}
	database.DB.Create(&players)

	// Create Round 1 matchups manually (simulating what GenerateRound1 would produce)
	matchup1 := models.Matchup{MatchSessionID: session.ID, Round: 1}
	database.DB.Create(&matchup1)
	database.DB.Create(&[]models.MatchupPlayer{
		{MatchupID: matchup1.ID, MatchPlayerID: players[0].ID, Side: models.SideA}, // P1
		{MatchupID: matchup1.ID, MatchPlayerID: players[1].ID, Side: models.SideA}, // P2
		{MatchupID: matchup1.ID, MatchPlayerID: players[2].ID, Side: models.SideB}, // P3
		{MatchupID: matchup1.ID, MatchPlayerID: players[3].ID, Side: models.SideB}, // P4
	})

	matchup2 := models.Matchup{MatchSessionID: session.ID, Round: 1}
	database.DB.Create(&matchup2)
	database.DB.Create(&[]models.MatchupPlayer{
		{MatchupID: matchup2.ID, MatchPlayerID: players[4].ID, Side: models.SideA}, // P5
		{MatchupID: matchup2.ID, MatchPlayerID: players[5].ID, Side: models.SideA}, // P6
		{MatchupID: matchup2.ID, MatchPlayerID: players[6].ID, Side: models.SideB}, // P7
		{MatchupID: matchup2.ID, MatchPlayerID: players[7].ID, Side: models.SideB}, // P8
	})

	// Verify only Round 1 matchups exist initially
	req := testhelper.ReqAuth("GET", fmt.Sprintf("/api/matches/%d/matchups", session.ID), "", user.ID)
	w := testhelper.Do(r, req)
	require.Equal(t, http.StatusOK, w.Code)

	var matchups []models.Matchup
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &matchups))
	assert.Len(t, matchups, 2, "Initially should have only 2 Round 1 matchups")
	for _, m := range matchups {
		assert.Equal(t, 1, m.Round)
	}

	// Enter score for matchup 1: Side A wins 21-15
	body := `{"score_side_a": 21, "score_side_b": 15}`
	req = testhelper.ReqAuth("PUT", fmt.Sprintf("/api/matches/%d/matchups/%d", session.ID, matchup1.ID), body, user.ID)
	w = testhelper.Do(r, req)
	require.Equal(t, http.StatusOK, w.Code)

	// Check that round 2 is NOT yet generated (only 1 of 2 matchups scored)
	req = testhelper.ReqAuth("GET", fmt.Sprintf("/api/matches/%d/matchups", session.ID), "", user.ID)
	w = testhelper.Do(r, req)
	require.Equal(t, http.StatusOK, w.Code)

	var afterFirst []models.Matchup
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &afterFirst))
	assert.Len(t, afterFirst, 2, "Should still have only 2 matchups after first score")

	// Enter score for matchup 2: Side A wins 21-10
	body = `{"score_side_a": 21, "score_side_b": 10}`
	req = testhelper.ReqAuth("PUT", fmt.Sprintf("/api/matches/%d/matchups/%d", session.ID, matchup2.ID), body, user.ID)
	w = testhelper.Do(r, req)
	require.Equal(t, http.StatusOK, w.Code)

	// Now all Round 1 matchups are complete - Round 2 should be generated
	req = testhelper.ReqAuth("GET", fmt.Sprintf("/api/matches/%d/matchups", session.ID), "", user.ID)
	w = testhelper.Do(r, req)
	require.Equal(t, http.StatusOK, w.Code)

	var afterSecond []models.Matchup
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &afterSecond))

	// Should now have 4 matchups: 2 from Round 1 + 2 from Round 2
	require.Len(t, afterSecond, 4, "Should have 4 matchups after round completion (2 R1 + 2 R2)")

	// Verify Round 2 matchups exist
	round2Count := 0
	for _, m := range afterSecond {
		if m.Round == 2 {
			round2Count++
		}
	}
	assert.Equal(t, 2, round2Count, "Should have 2 Round 2 matchups generated")

	// Verify Round 2 matchups have players assigned (positional pairing based on standings)
	for _, m := range afterSecond {
		if m.Round == 2 {
			assert.NotEmpty(t, m.Players, "Round 2 matchups should have players assigned")
			assert.Len(t, m.Players, 4, "Each doubles matchup should have 4 players")
		}
	}
}
