package handlers_test

import (
	"fmt"
	"net/http"
	"testing"

	"trackquet/handlers"
	"trackquet/middleware"
	"trackquet/testhelper"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

// setupAuthGuardRouter sets up a router with all match endpoints behind auth middleware.
func setupAuthGuardRouter() *gin.Engine {
	r := testhelper.NewRouter()
	r.Use(middleware.RequireAuth)
	r.GET("/api/matches", handlers.ListMatchSessions)
	r.POST("/api/matches", handlers.CreateMatchSession)
	r.GET("/api/matches/:id", handlers.GetMatchSession)
	r.PUT("/api/matches/:id", handlers.UpdateMatchSession)
	r.DELETE("/api/matches/:id", handlers.DeleteMatchSession)
	r.POST("/api/matches/:id/start", handlers.StartMatchSession)
	r.POST("/api/matches/:id/finish", handlers.FinishMatchSession)
	r.GET("/api/matches/:id/matchups", handlers.ListMatchups)
	r.GET("/api/matches/:id/matchups/:matchupId", handlers.GetMatchup)
	r.PUT("/api/matches/:id/matchups/:matchupId", handlers.UpdateMatchup)
	r.GET("/api/matches/:id/leaderboard", handlers.GetLeaderboard)
	return r
}

// --- Unauthenticated Access Returns 401 ---

func TestAuthGuard_ListMatches_NoToken_Returns401(t *testing.T) {
	initMatchTestDB(t)
	r := setupAuthGuardRouter()

	req := testhelper.Req("GET", "/api/matches", "")
	w := testhelper.Do(r, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAuthGuard_CreateMatch_NoToken_Returns401(t *testing.T) {
	initMatchTestDB(t)
	r := setupAuthGuardRouter()

	req := testhelper.Req("POST", "/api/matches", `{"name":"Test"}`)
	w := testhelper.Do(r, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAuthGuard_GetMatch_NoToken_Returns401(t *testing.T) {
	initMatchTestDB(t)
	r := setupAuthGuardRouter()

	req := testhelper.Req("GET", "/api/matches/1", "")
	w := testhelper.Do(r, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAuthGuard_UpdateMatch_NoToken_Returns401(t *testing.T) {
	initMatchTestDB(t)
	r := setupAuthGuardRouter()

	req := testhelper.Req("PUT", "/api/matches/1", `{"name":"Updated"}`)
	w := testhelper.Do(r, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAuthGuard_DeleteMatch_NoToken_Returns401(t *testing.T) {
	initMatchTestDB(t)
	r := setupAuthGuardRouter()

	req := testhelper.Req("DELETE", "/api/matches/1", "")
	w := testhelper.Do(r, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAuthGuard_StartMatch_NoToken_Returns401(t *testing.T) {
	initMatchTestDB(t)
	r := setupAuthGuardRouter()

	req := testhelper.Req("POST", "/api/matches/1/start", "")
	w := testhelper.Do(r, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAuthGuard_FinishMatch_NoToken_Returns401(t *testing.T) {
	initMatchTestDB(t)
	r := setupAuthGuardRouter()

	req := testhelper.Req("POST", "/api/matches/1/finish", "")
	w := testhelper.Do(r, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAuthGuard_ListMatchups_NoToken_Returns401(t *testing.T) {
	initMatchTestDB(t)
	r := setupAuthGuardRouter()

	req := testhelper.Req("GET", "/api/matches/1/matchups", "")
	w := testhelper.Do(r, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAuthGuard_GetMatchup_NoToken_Returns401(t *testing.T) {
	initMatchTestDB(t)
	r := setupAuthGuardRouter()

	req := testhelper.Req("GET", "/api/matches/1/matchups/1", "")
	w := testhelper.Do(r, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAuthGuard_UpdateMatchup_NoToken_Returns401(t *testing.T) {
	initMatchTestDB(t)
	r := setupAuthGuardRouter()

	req := testhelper.Req("PUT", "/api/matches/1/matchups/1", `{"score_side_a":21,"score_side_b":10}`)
	w := testhelper.Do(r, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAuthGuard_Leaderboard_NoToken_Returns401(t *testing.T) {
	initMatchTestDB(t)
	r := setupAuthGuardRouter()

	req := testhelper.Req("GET", "/api/matches/1/leaderboard", "")
	w := testhelper.Do(r, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

// --- Accessing Another User's Session Returns 404 ---

func TestAuthGuard_GetMatch_OtherUser_Returns404(t *testing.T) {
	initMatchTestDB(t)
	r := setupAuthGuardRouter()

	owner := createTestUser(t, "guard-owner-get@test.com")
	other := createTestUser(t, "guard-other-get@test.com")
	session := createTestMatch(t, owner.ID)

	req := testhelper.ReqAuth("GET", fmt.Sprintf("/api/matches/%d", session.ID), "", other.ID)
	w := testhelper.Do(r, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestAuthGuard_UpdateMatch_OtherUser_Returns404(t *testing.T) {
	initMatchTestDB(t)
	r := setupAuthGuardRouter()

	owner := createTestUser(t, "guard-owner-update@test.com")
	other := createTestUser(t, "guard-other-update@test.com")
	session := createTestMatch(t, owner.ID)

	body := `{"name":"Hacked Name"}`
	req := testhelper.ReqAuth("PUT", fmt.Sprintf("/api/matches/%d", session.ID), body, other.ID)
	w := testhelper.Do(r, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestAuthGuard_DeleteMatch_OtherUser_Returns404(t *testing.T) {
	initMatchTestDB(t)
	r := setupAuthGuardRouter()

	owner := createTestUser(t, "guard-owner-delete@test.com")
	other := createTestUser(t, "guard-other-delete@test.com")
	session := createTestMatch(t, owner.ID)

	req := testhelper.ReqAuth("DELETE", fmt.Sprintf("/api/matches/%d", session.ID), "", other.ID)
	w := testhelper.Do(r, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestAuthGuard_StartMatch_OtherUser_Returns404(t *testing.T) {
	initMatchTestDB(t)
	r := setupAuthGuardRouter()

	owner := createTestUser(t, "guard-owner-start@test.com")
	other := createTestUser(t, "guard-other-start@test.com")
	session := createTestMatch(t, owner.ID)

	req := testhelper.ReqAuth("POST", fmt.Sprintf("/api/matches/%d/start", session.ID), "", other.ID)
	w := testhelper.Do(r, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestAuthGuard_FinishMatch_OtherUser_Returns404(t *testing.T) {
	initMatchTestDB(t)
	r := setupAuthGuardRouter()

	owner := createTestUser(t, "guard-owner-finish@test.com")
	other := createTestUser(t, "guard-other-finish@test.com")
	session := createTestMatch(t, owner.ID)

	req := testhelper.ReqAuth("POST", fmt.Sprintf("/api/matches/%d/finish", session.ID), "", other.ID)
	w := testhelper.Do(r, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestAuthGuard_ListMatchups_OtherUser_Returns404(t *testing.T) {
	initMatchTestDB(t)
	r := setupAuthGuardRouter()

	owner := createTestUser(t, "guard-owner-matchups@test.com")
	other := createTestUser(t, "guard-other-matchups@test.com")
	session := createTestMatch(t, owner.ID)

	req := testhelper.ReqAuth("GET", fmt.Sprintf("/api/matches/%d/matchups", session.ID), "", other.ID)
	w := testhelper.Do(r, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestAuthGuard_GetMatchup_OtherUser_Returns404(t *testing.T) {
	initMatchTestDB(t)
	r := setupAuthGuardRouter()

	owner := createTestUser(t, "guard-owner-getmu@test.com")
	other := createTestUser(t, "guard-other-getmu@test.com")
	session, matchups := createMatchWithMatchups(t, owner.ID)

	req := testhelper.ReqAuth("GET", fmt.Sprintf("/api/matches/%d/matchups/%d", session.ID, matchups[0].ID), "", other.ID)
	w := testhelper.Do(r, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestAuthGuard_UpdateMatchup_OtherUser_Returns404(t *testing.T) {
	initMatchTestDB(t)
	r := setupAuthGuardRouter()

	owner := createTestUser(t, "guard-owner-updatemu@test.com")
	other := createTestUser(t, "guard-other-updatemu@test.com")
	session, matchups := createMatchWithMatchups(t, owner.ID)

	body := `{"score_side_a": 21, "score_side_b": 10}`
	req := testhelper.ReqAuth("PUT", fmt.Sprintf("/api/matches/%d/matchups/%d", session.ID, matchups[0].ID), body, other.ID)
	w := testhelper.Do(r, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestAuthGuard_Leaderboard_OtherUser_Returns404(t *testing.T) {
	initMatchTestDB(t)
	r := setupAuthGuardRouter()

	owner := createTestUser(t, "guard-owner-lb@test.com")
	other := createTestUser(t, "guard-other-lb@test.com")
	session := createTestMatch(t, owner.ID)

	req := testhelper.ReqAuth("GET", fmt.Sprintf("/api/matches/%d/leaderboard", session.ID), "", other.ID)
	w := testhelper.Do(r, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

// --- Non-existent Session Returns 404 ---

func TestAuthGuard_GetMatch_NonExistent_Returns404(t *testing.T) {
	initMatchTestDB(t)
	r := setupAuthGuardRouter()

	user := createTestUser(t, "guard-noexist-get@test.com")

	req := testhelper.ReqAuth("GET", "/api/matches/99999", "", user.ID)
	w := testhelper.Do(r, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestAuthGuard_UpdateMatch_NonExistent_Returns404(t *testing.T) {
	initMatchTestDB(t)
	r := setupAuthGuardRouter()

	user := createTestUser(t, "guard-noexist-update@test.com")

	req := testhelper.ReqAuth("PUT", "/api/matches/99999", `{"name":"Nope"}`, user.ID)
	w := testhelper.Do(r, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestAuthGuard_DeleteMatch_NonExistent_Returns404(t *testing.T) {
	initMatchTestDB(t)
	r := setupAuthGuardRouter()

	user := createTestUser(t, "guard-noexist-delete@test.com")

	req := testhelper.ReqAuth("DELETE", "/api/matches/99999", "", user.ID)
	w := testhelper.Do(r, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestAuthGuard_Leaderboard_NonExistent_Returns404(t *testing.T) {
	initMatchTestDB(t)
	r := setupAuthGuardRouter()

	user := createTestUser(t, "guard-noexist-lb@test.com")

	req := testhelper.ReqAuth("GET", "/api/matches/99999/leaderboard", "", user.ID)
	w := testhelper.Do(r, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}
