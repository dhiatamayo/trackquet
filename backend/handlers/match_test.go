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
	"trackquet/testhelper"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupMatchRouter() *gin.Engine {
	r := testhelper.NewRouter()
	r.Use(middleware.RequireAuth)
	r.POST("/api/matches/:id/start", handlers.StartMatchSession)
	r.POST("/api/matches/:id/finish", handlers.FinishMatchSession)
	r.GET("/api/matches/:id/matchups", handlers.ListMatchups)
	r.GET("/api/matches/:id/matchups/:matchupId", handlers.GetMatchup)
	r.PUT("/api/matches/:id/matchups/:matchupId", handlers.UpdateMatchup)
	return r
}

func initMatchTestDB(t *testing.T) {
	t.Helper()
	testhelper.InitTestDB()
	// Also migrate match-specific models
	database.DB.AutoMigrate(
		&models.MatchSession{},
		&models.MatchPlayer{},
		&models.Matchup{},
		&models.MatchupPlayer{},
	)
}

func createTestUser(t *testing.T, email string) models.User {
	t.Helper()
	user := models.User{
		Name:     "Test User",
		Username: email,
		Email:    email,
		Password: "hashedpass",
	}
	database.DB.Create(&user)
	return user
}

func createTestMatch(t *testing.T, userID uint) models.MatchSession {
	t.Helper()
	session := models.MatchSession{
		UserID:            userID,
		Name:              "Test Match",
		Date:              time.Now(),
		SportType:         models.SportTennis,
		MatchType:         models.MatchTypeDoubles,
		Format:            models.FormatAmericano,
		WinConditionType:  models.WinConditionSets,
		WinConditionValue: 2,
	}
	database.DB.Create(&session)
	return session
}

// --- Start Match Session Tests ---

func TestStartMatchSession_Success(t *testing.T) {
	initMatchTestDB(t)
	r := setupMatchRouter()

	user := createTestUser(t, "start-success@test.com")
	session := createTestMatch(t, user.ID)

	req := testhelper.ReqAuth("POST", fmt.Sprintf("/api/matches/%d/start", session.ID), "", user.ID)
	w := testhelper.Do(r, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp models.MatchSession
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.NotNil(t, resp.StartedAt, "started_at should be set")
}

func TestStartMatchSession_AlreadyStarted(t *testing.T) {
	initMatchTestDB(t)
	r := setupMatchRouter()

	user := createTestUser(t, "start-already@test.com")
	session := createTestMatch(t, user.ID)

	// Pre-set started_at
	now := time.Now()
	session.StartedAt = &now
	database.DB.Save(&session)

	req := testhelper.ReqAuth("POST", fmt.Sprintf("/api/matches/%d/start", session.ID), "", user.ID)
	w := testhelper.Do(r, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var resp map[string]string
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, "session already started", resp["error"])
}

func TestStartMatchSession_NotFound(t *testing.T) {
	initMatchTestDB(t)
	r := setupMatchRouter()

	user := createTestUser(t, "start-notfound@test.com")

	req := testhelper.ReqAuth("POST", "/api/matches/9999/start", "", user.ID)
	w := testhelper.Do(r, req)

	assert.Equal(t, http.StatusNotFound, w.Code)

	var resp map[string]string
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, "match session not found", resp["error"])
}

func TestStartMatchSession_OtherUserSession(t *testing.T) {
	initMatchTestDB(t)
	r := setupMatchRouter()

	user1 := createTestUser(t, "start-owner@test.com")
	user2 := createTestUser(t, "start-other@test.com")
	session := createTestMatch(t, user1.ID)

	// user2 tries to start user1's session
	req := testhelper.ReqAuth("POST", fmt.Sprintf("/api/matches/%d/start", session.ID), "", user2.ID)
	w := testhelper.Do(r, req)

	assert.Equal(t, http.StatusNotFound, w.Code)

	var resp map[string]string
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, "match session not found", resp["error"])
}

// --- Finish Match Session Tests ---

func TestFinishMatchSession_Success(t *testing.T) {
	initMatchTestDB(t)
	r := setupMatchRouter()

	user := createTestUser(t, "finish-success@test.com")
	session := createTestMatch(t, user.ID)

	// Start it first (valid state: started but not finished)
	now := time.Now()
	session.StartedAt = &now
	database.DB.Save(&session)

	req := testhelper.ReqAuth("POST", fmt.Sprintf("/api/matches/%d/finish", session.ID), "", user.ID)
	w := testhelper.Do(r, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp models.MatchSession
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.NotNil(t, resp.FinishedAt, "finished_at should be set")
}

func TestFinishMatchSession_AlreadyFinished(t *testing.T) {
	initMatchTestDB(t)
	r := setupMatchRouter()

	user := createTestUser(t, "finish-already@test.com")
	session := createTestMatch(t, user.ID)

	// Pre-set both started_at and finished_at
	now := time.Now()
	session.StartedAt = &now
	session.FinishedAt = &now
	database.DB.Save(&session)

	req := testhelper.ReqAuth("POST", fmt.Sprintf("/api/matches/%d/finish", session.ID), "", user.ID)
	w := testhelper.Do(r, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var resp map[string]string
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, "session already finished", resp["error"])
}

func TestFinishMatchSession_NotFound(t *testing.T) {
	initMatchTestDB(t)
	r := setupMatchRouter()

	user := createTestUser(t, "finish-notfound@test.com")

	req := testhelper.ReqAuth("POST", "/api/matches/9999/finish", "", user.ID)
	w := testhelper.Do(r, req)

	assert.Equal(t, http.StatusNotFound, w.Code)

	var resp map[string]string
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, "match session not found", resp["error"])
}

func TestFinishMatchSession_OtherUserSession(t *testing.T) {
	initMatchTestDB(t)
	r := setupMatchRouter()

	user1 := createTestUser(t, "finish-owner@test.com")
	user2 := createTestUser(t, "finish-other@test.com")
	session := createTestMatch(t, user1.ID)

	now := time.Now()
	session.StartedAt = &now
	database.DB.Save(&session)

	// user2 tries to finish user1's session
	req := testhelper.ReqAuth("POST", fmt.Sprintf("/api/matches/%d/finish", session.ID), "", user2.ID)
	w := testhelper.Do(r, req)

	assert.Equal(t, http.StatusNotFound, w.Code)

	var resp map[string]string
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, "match session not found", resp["error"])
}

// --- Timestamp Persistence Tests ---

func TestStartMatchSession_PersistsTimestamp(t *testing.T) {
	initMatchTestDB(t)
	r := setupMatchRouter()

	user := createTestUser(t, "start-persist@test.com")
	session := createTestMatch(t, user.ID)

	req := testhelper.ReqAuth("POST", fmt.Sprintf("/api/matches/%d/start", session.ID), "", user.ID)
	w := testhelper.Do(r, req)

	assert.Equal(t, http.StatusOK, w.Code)

	// Verify it's actually persisted in the DB
	var dbSession models.MatchSession
	database.DB.First(&dbSession, session.ID)
	assert.NotNil(t, dbSession.StartedAt, "started_at should be persisted in DB")
}

func TestFinishMatchSession_PersistsTimestamp(t *testing.T) {
	initMatchTestDB(t)
	r := setupMatchRouter()

	user := createTestUser(t, "finish-persist@test.com")
	session := createTestMatch(t, user.ID)

	now := time.Now()
	session.StartedAt = &now
	database.DB.Save(&session)

	req := testhelper.ReqAuth("POST", fmt.Sprintf("/api/matches/%d/finish", session.ID), "", user.ID)
	w := testhelper.Do(r, req)

	assert.Equal(t, http.StatusOK, w.Code)

	// Verify it's actually persisted in the DB
	var dbSession models.MatchSession
	database.DB.First(&dbSession, session.ID)
	assert.NotNil(t, dbSession.FinishedAt, "finished_at should be persisted in DB")
}

// --- Matchup Handler Tests ---

func createMatchWithMatchups(t *testing.T, userID uint) (models.MatchSession, []models.Matchup) {
	t.Helper()
	session := models.MatchSession{
		UserID:            userID,
		Name:              "Matchup Test",
		Date:              time.Now(),
		SportType:         models.SportPadel,
		MatchType:         models.MatchTypeDoubles,
		Format:            models.FormatMexicano,
		WinConditionType:  models.WinConditionPoints,
		WinConditionValue: 21,
	}
	database.DB.Create(&session)

	// Create players
	players := []models.MatchPlayer{
		{MatchSessionID: session.ID, Name: "Alice"},
		{MatchSessionID: session.ID, Name: "Bob"},
		{MatchSessionID: session.ID, Name: "Charlie"},
		{MatchSessionID: session.ID, Name: "Diana"},
	}
	database.DB.Create(&players)

	// Create matchup
	matchup := models.Matchup{
		MatchSessionID: session.ID,
		Round:          1,
	}
	database.DB.Create(&matchup)

	// Create matchup players
	matchupPlayers := []models.MatchupPlayer{
		{MatchupID: matchup.ID, MatchPlayerID: players[0].ID, Side: models.SideA},
		{MatchupID: matchup.ID, MatchPlayerID: players[1].ID, Side: models.SideA},
		{MatchupID: matchup.ID, MatchPlayerID: players[2].ID, Side: models.SideB},
		{MatchupID: matchup.ID, MatchPlayerID: players[3].ID, Side: models.SideB},
	}
	database.DB.Create(&matchupPlayers)

	return session, []models.Matchup{matchup}
}

func TestListMatchups_Success(t *testing.T) {
	initMatchTestDB(t)
	r := setupMatchRouter()

	user := createTestUser(t, "list-matchups@test.com")
	session, _ := createMatchWithMatchups(t, user.ID)

	req := testhelper.ReqAuth("GET", fmt.Sprintf("/api/matches/%d/matchups", session.ID), "", user.ID)
	w := testhelper.Do(r, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp []models.Matchup
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Len(t, resp, 1)
	assert.Equal(t, 1, resp[0].Round)
}

func TestListMatchups_NotFound(t *testing.T) {
	initMatchTestDB(t)
	r := setupMatchRouter()

	user := createTestUser(t, "list-matchups-nf@test.com")

	req := testhelper.ReqAuth("GET", "/api/matches/9999/matchups", "", user.ID)
	w := testhelper.Do(r, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestListMatchups_OtherUser(t *testing.T) {
	initMatchTestDB(t)
	r := setupMatchRouter()

	user1 := createTestUser(t, "list-matchups-owner@test.com")
	user2 := createTestUser(t, "list-matchups-other@test.com")
	session, _ := createMatchWithMatchups(t, user1.ID)

	req := testhelper.ReqAuth("GET", fmt.Sprintf("/api/matches/%d/matchups", session.ID), "", user2.ID)
	w := testhelper.Do(r, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestGetMatchup_Success(t *testing.T) {
	initMatchTestDB(t)
	r := setupMatchRouter()

	user := createTestUser(t, "get-matchup@test.com")
	session, matchups := createMatchWithMatchups(t, user.ID)

	req := testhelper.ReqAuth("GET", fmt.Sprintf("/api/matches/%d/matchups/%d", session.ID, matchups[0].ID), "", user.ID)
	w := testhelper.Do(r, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp models.Matchup
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, matchups[0].ID, resp.ID)
	assert.Equal(t, 1, resp.Round)
}

func TestGetMatchup_NotFound(t *testing.T) {
	initMatchTestDB(t)
	r := setupMatchRouter()

	user := createTestUser(t, "get-matchup-nf@test.com")
	session, _ := createMatchWithMatchups(t, user.ID)

	req := testhelper.ReqAuth("GET", fmt.Sprintf("/api/matches/%d/matchups/9999", session.ID), "", user.ID)
	w := testhelper.Do(r, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestUpdateMatchup_ScoreValid(t *testing.T) {
	initMatchTestDB(t)
	r := setupMatchRouter()

	user := createTestUser(t, "update-matchup-score@test.com")
	session, matchups := createMatchWithMatchups(t, user.ID)

	body := `{"score_side_a": 21, "score_side_b": 15}`
	req := testhelper.ReqAuth("PUT", fmt.Sprintf("/api/matches/%d/matchups/%d", session.ID, matchups[0].ID), body, user.ID)
	w := testhelper.Do(r, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp models.Matchup
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.NotNil(t, resp.ScoreSideA)
	assert.NotNil(t, resp.ScoreSideB)
	assert.Equal(t, 21, *resp.ScoreSideA)
	assert.Equal(t, 15, *resp.ScoreSideB)

	// Verify player stats updated
	var players []models.MatchPlayer
	database.DB.Where("match_session_id = ?", session.ID).Find(&players)
	for _, p := range players {
		// Side A players should have 21 total points, Side B should have 15
		if p.Name == "Alice" || p.Name == "Bob" {
			assert.Equal(t, 21, p.TotalPoints)
			assert.Equal(t, 6, p.PointDiff) // 21 - 15
		} else {
			assert.Equal(t, 15, p.TotalPoints)
			assert.Equal(t, -6, p.PointDiff) // 15 - 21
		}
	}
}

func TestUpdateMatchup_ScoreInvalid_NoWinner(t *testing.T) {
	initMatchTestDB(t)
	r := setupMatchRouter()

	user := createTestUser(t, "update-matchup-invalid@test.com")
	session, matchups := createMatchWithMatchups(t, user.ID)

	// Neither side equals target (21)
	body := `{"score_side_a": 15, "score_side_b": 10}`
	req := testhelper.ReqAuth("PUT", fmt.Sprintf("/api/matches/%d/matchups/%d", session.ID, matchups[0].ID), body, user.ID)
	w := testhelper.Do(r, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestUpdateMatchup_ScoreInvalid_Negative(t *testing.T) {
	initMatchTestDB(t)
	r := setupMatchRouter()

	user := createTestUser(t, "update-matchup-neg@test.com")
	session, matchups := createMatchWithMatchups(t, user.ID)

	body := `{"score_side_a": 21, "score_side_b": -1}`
	req := testhelper.ReqAuth("PUT", fmt.Sprintf("/api/matches/%d/matchups/%d", session.ID, matchups[0].ID), body, user.ID)
	w := testhelper.Do(r, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestUpdateMatchup_ScoreInvalid_BothEqualTarget(t *testing.T) {
	initMatchTestDB(t)
	r := setupMatchRouter()

	user := createTestUser(t, "update-matchup-both@test.com")
	session, matchups := createMatchWithMatchups(t, user.ID)

	// Both sides equal target - invalid
	body := `{"score_side_a": 21, "score_side_b": 21}`
	req := testhelper.ReqAuth("PUT", fmt.Sprintf("/api/matches/%d/matchups/%d", session.ID, matchups[0].ID), body, user.ID)
	w := testhelper.Do(r, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestUpdateMatchup_CourtAndNotes(t *testing.T) {
	initMatchTestDB(t)
	r := setupMatchRouter()

	user := createTestUser(t, "update-matchup-meta@test.com")
	session, matchups := createMatchWithMatchups(t, user.ID)

	body := `{"court_number": 3, "notes": "Great match"}`
	req := testhelper.ReqAuth("PUT", fmt.Sprintf("/api/matches/%d/matchups/%d", session.ID, matchups[0].ID), body, user.ID)
	w := testhelper.Do(r, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp models.Matchup
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.NotNil(t, resp.CourtNumber)
	assert.Equal(t, 3, *resp.CourtNumber)
	assert.Equal(t, "Great match", resp.Notes)
}

func TestUpdateMatchup_OtherUser(t *testing.T) {
	initMatchTestDB(t)
	r := setupMatchRouter()

	user1 := createTestUser(t, "update-matchup-owner@test.com")
	user2 := createTestUser(t, "update-matchup-other@test.com")
	session, matchups := createMatchWithMatchups(t, user1.ID)

	body := `{"score_side_a": 21, "score_side_b": 10}`
	req := testhelper.ReqAuth("PUT", fmt.Sprintf("/api/matches/%d/matchups/%d", session.ID, matchups[0].ID), body, user2.ID)
	w := testhelper.Do(r, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestUpdateMatchup_OnlyOneSideScore(t *testing.T) {
	initMatchTestDB(t)
	r := setupMatchRouter()

	user := createTestUser(t, "update-matchup-oneside@test.com")
	session, matchups := createMatchWithMatchups(t, user.ID)

	body := `{"score_side_a": 21}`
	req := testhelper.ReqAuth("PUT", fmt.Sprintf("/api/matches/%d/matchups/%d", session.ID, matchups[0].ID), body, user.ID)
	w := testhelper.Do(r, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestUpdateMatchup_SetBased_Valid(t *testing.T) {
	initMatchTestDB(t)
	r := setupMatchRouter()

	user := createTestUser(t, "update-matchup-sets@test.com")

	// Create a sets-based session (Race to 2)
	session := models.MatchSession{
		UserID:            user.ID,
		Name:              "Sets Test",
		Date:              time.Now(),
		SportType:         models.SportTennis,
		MatchType:         models.MatchTypeDoubles,
		Format:            models.FormatAmericano,
		WinConditionType:  models.WinConditionSets,
		WinConditionValue: 2,
	}
	database.DB.Create(&session)

	players := []models.MatchPlayer{
		{MatchSessionID: session.ID, Name: "P1"},
		{MatchSessionID: session.ID, Name: "P2"},
		{MatchSessionID: session.ID, Name: "P3"},
		{MatchSessionID: session.ID, Name: "P4"},
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

	// Valid: 2-1 (side A wins Race to 2)
	body := `{"score_side_a": 2, "score_side_b": 1}`
	req := testhelper.ReqAuth("PUT", fmt.Sprintf("/api/matches/%d/matchups/%d", session.ID, matchup.ID), body, user.ID)
	w := testhelper.Do(r, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

