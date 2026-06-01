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

// ── helpers ──────────────────────────────────────────────────────────────────

func setupReportRouter() *gin.Engine {
	r := testhelper.NewRouter()
	auth := r.Group("/api")
	auth.Use(middleware.RequireAuth)
	auth.GET("/reports/monthly", handlers.GetMonthlyReport)
	return r
}

// seedUserWithRacquet creates a user + racquet and returns both.
func seedUserWithRacquet(t *testing.T) (models.User, models.Racquet) {
	t.Helper()
	u := models.User{
		Name:     "ReportUser",
		Username: fmt.Sprintf("ru%d", time.Now().UnixNano()),
		Email:    fmt.Sprintf("ru%d@test.com", time.Now().UnixNano()),
		Password: "x",
	}
	require.NoError(t, database.DB.Create(&u).Error)
	rq := models.Racquet{UserID: u.ID, Name: "Prince Pro", ThresholdHours: 20}
	require.NoError(t, database.DB.Create(&rq).Error)
	return u, rq
}

// addSession inserts a session for the given racquet in the given year/month.
func addSession(t *testing.T, rqID uint, name string, sessionType models.SessionType,
	result models.MatchResult, durationMin int, year, month int) models.Session {
	t.Helper()
	s := models.Session{
		RacquetID:   rqID,
		Name:        name,
		Type:        sessionType,
		MatchResult: result,
		DurationMin: durationMin,
		Date:        time.Date(year, time.Month(month), 5, 0, 0, 0, 0, time.UTC),
	}
	require.NoError(t, database.DB.Create(&s).Error)
	return s
}



// ── tests ─────────────────────────────────────────────────────────────────────

func TestGetMonthlyReport_NoRacquets(t *testing.T) {
	testhelper.InitTestDB()
	r := setupReportRouter()

	u := models.User{
		Name:     "Solo",
		Username: fmt.Sprintf("solo%d", time.Now().UnixNano()),
		Email:    fmt.Sprintf("solo%d@test.com", time.Now().UnixNano()),
		Password: "x",
	}
	require.NoError(t, database.DB.Create(&u).Error)

	url := "/api/reports/monthly?year=2026&month=6"
	w := testhelper.Do(r, testhelper.ReqAuth("GET", url, "", u.ID))
	assert.Equal(t, http.StatusOK, w.Code)

	var resp handlers.MonthlyReportResponse
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, 0, resp.TotalSessions)
	assert.Equal(t, "June 2026", resp.Month)
	assert.Empty(t, resp.RacquetUsage)
	assert.Empty(t, resp.NotableResults)
}

func TestGetMonthlyReport_NoSessionsInMonth(t *testing.T) {
	testhelper.InitTestDB()
	r := setupReportRouter()
	u, rq := seedUserWithRacquet(t)

	// Add a session in a different month
	addSession(t, rq.ID, "Old Match", models.SessionMatch, models.MatchWin, 60, 2026, 5)

	url := "/api/reports/monthly?year=2026&month=6"
	w := testhelper.Do(r, testhelper.ReqAuth("GET", url, "", u.ID))
	assert.Equal(t, http.StatusOK, w.Code)

	var resp handlers.MonthlyReportResponse
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, 0, resp.TotalSessions)
	assert.Empty(t, resp.NotableResults)
}

func TestGetMonthlyReport_BasicAggregation(t *testing.T) {
	testhelper.InitTestDB()
	r := setupReportRouter()
	u, rq := seedUserWithRacquet(t)

	addSession(t, rq.ID, "Win 1", models.SessionMatch, models.MatchWin, 90, 2026, 6)
	addSession(t, rq.ID, "Loss 1", models.SessionMatch, models.MatchLoss, 75, 2026, 6)
	addSession(t, rq.ID, "Training", models.SessionTraining, "", 45, 2026, 6)

	url := "/api/reports/monthly?year=2026&month=6"
	w := testhelper.Do(r, testhelper.ReqAuth("GET", url, "", u.ID))
	assert.Equal(t, http.StatusOK, w.Code)

	var resp handlers.MonthlyReportResponse
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))

	assert.Equal(t, 3, resp.TotalSessions)
	assert.Equal(t, 210, resp.TotalMinutes) // 90+75+45
	assert.Equal(t, 70.0, resp.AvgMinPerSession)
	assert.Equal(t, 1, resp.TotalWins)
	assert.Equal(t, 2, resp.TotalMatches)
	assert.Equal(t, 50.0, resp.WinRate)
	assert.Equal(t, "June 2026", resp.Month)
	assert.Equal(t, 2026, resp.Year)
	assert.Equal(t, 6, resp.MonthNum)

	require.Len(t, resp.RacquetUsage, 1)
	assert.Equal(t, rq.Name, resp.RacquetUsage[0].RacquetName)
	assert.Equal(t, 3, resp.RacquetUsage[0].Sessions)
	assert.Equal(t, 1, resp.RacquetUsage[0].Wins)
	assert.Equal(t, 1, resp.RacquetUsage[0].Losses)
}

func TestGetMonthlyReport_Milestones_WinsAndLosses(t *testing.T) {
	testhelper.InitTestDB()
	r := setupReportRouter()
	u, rq := seedUserWithRacquet(t)

	// Two wins (biggest should be longest)
	addSession(t, rq.ID, "Big Win", models.SessionMatch, models.MatchWin, 120, 2026, 6)
	addSession(t, rq.ID, "Small Win", models.SessionMatch, models.MatchWin, 60, 2026, 6)
	// Two losses
	addSession(t, rq.ID, "Hard Loss", models.SessionMatch, models.MatchLoss, 110, 2026, 6)
	addSession(t, rq.ID, "Small Loss", models.SessionMatch, models.MatchLoss, 50, 2026, 6)

	url := "/api/reports/monthly?year=2026&month=6"
	w := testhelper.Do(r, testhelper.ReqAuth("GET", url, "", u.ID))
	require.Equal(t, http.StatusOK, w.Code)

	var resp handlers.MonthlyReportResponse
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))

	tags := make([]string, len(resp.NotableResults))
	for i, n := range resp.NotableResults {
		tags[i] = n.NotableTag
	}
	assert.Contains(t, tags, "Biggest Win")
	assert.Contains(t, tags, "Notable Win")
	assert.Contains(t, tags, "Hardest Loss")
	assert.Contains(t, tags, "Notable Loss")

	// Biggest Win should have the longer duration
	for _, n := range resp.NotableResults {
		if n.NotableTag == "Biggest Win" {
			assert.Equal(t, 120, n.DurationMin)
		}
		if n.NotableTag == "Hardest Loss" {
			assert.Equal(t, 110, n.DurationMin)
		}
	}
}

func TestGetMonthlyReport_Milestones_LongestMatchAndTraining(t *testing.T) {
	testhelper.InitTestDB()
	r := setupReportRouter()
	u, rq := seedUserWithRacquet(t)

	// A draw-like match (no win/loss result) + a training
	addSession(t, rq.ID, "Long Match", models.SessionMatch, "", 100, 2026, 6)
	addSession(t, rq.ID, "Long Training", models.SessionTraining, "", 80, 2026, 6)
	addSession(t, rq.ID, "Short Training", models.SessionTraining, "", 30, 2026, 6)

	url := "/api/reports/monthly?year=2026&month=6"
	w := testhelper.Do(r, testhelper.ReqAuth("GET", url, "", u.ID))
	require.Equal(t, http.StatusOK, w.Code)

	var resp handlers.MonthlyReportResponse
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))

	tags := make([]string, len(resp.NotableResults))
	for i, n := range resp.NotableResults {
		tags[i] = n.NotableTag
	}
	assert.Contains(t, tags, "Longest Match")
	assert.Contains(t, tags, "Longest Training")

	// Longest Training should pick the 80-min session, not the 30-min one
	for _, n := range resp.NotableResults {
		if n.NotableTag == "Longest Training" {
			assert.Equal(t, 80, n.DurationMin)
		}
	}
}

func TestGetMonthlyReport_MilestonesNoDuplicates(t *testing.T) {
	testhelper.InitTestDB()
	r := setupReportRouter()
	u, rq := seedUserWithRacquet(t)

	// 3 wins — the top 2 become Biggest Win / Notable Win; the 3rd is the longest remaining match
	addSession(t, rq.ID, "Win A", models.SessionMatch, models.MatchWin, 120, 2026, 6)
	addSession(t, rq.ID, "Win B", models.SessionMatch, models.MatchWin, 90, 2026, 6)
	addSession(t, rq.ID, "Win C", models.SessionMatch, models.MatchWin, 70, 2026, 6)

	url := "/api/reports/monthly?year=2026&month=6"
	w := testhelper.Do(r, testhelper.ReqAuth("GET", url, "", u.ID))
	require.Equal(t, http.StatusOK, w.Code)

	var resp handlers.MonthlyReportResponse
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))

	// Verify no session ID appears twice
	seen := make(map[uint]int)
	for _, n := range resp.NotableResults {
		seen[n.SessionID]++
	}
	for id, count := range seen {
		assert.Equal(t, 1, count, "session %d appeared %d times in milestones", id, count)
	}

	tags := make([]string, len(resp.NotableResults))
	for i, n := range resp.NotableResults {
		tags[i] = n.NotableTag
	}
	assert.Contains(t, tags, "Longest Match") // Win C should fill this slot
}

func TestGetMonthlyReport_InvalidParams(t *testing.T) {
	testhelper.InitTestDB()
	r := setupReportRouter()
	u, _ := seedUserWithRacquet(t)

	cases := []struct {
		url  string
		desc string
	}{
		{"/api/reports/monthly?year=abc&month=6", "non-numeric year"},
		{"/api/reports/monthly?year=2026&month=13", "month out of range"},
		{"/api/reports/monthly?year=2026&month=0", "month zero"},
		{"/api/reports/monthly?year=1999&month=6", "year too old"},
	}
	for _, tc := range cases {
		t.Run(tc.desc, func(t *testing.T) {
			w := testhelper.Do(r, testhelper.ReqAuth("GET", tc.url, "", u.ID))
			assert.Equal(t, http.StatusBadRequest, w.Code, tc.desc)
		})
	}
}

func TestGetMonthlyReport_RacquetUsageRanking(t *testing.T) {
	testhelper.InitTestDB()
	r := setupReportRouter()
	u, rq1 := seedUserWithRacquet(t)
	rq2 := models.Racquet{UserID: u.ID, Name: "Wilson Clash", ThresholdHours: 20}
	require.NoError(t, database.DB.Create(&rq2).Error)

	// rq2 gets more sessions
	addSession(t, rq2.ID, "S1", models.SessionTraining, "", 60, 2026, 6)
	addSession(t, rq2.ID, "S2", models.SessionTraining, "", 60, 2026, 6)
	addSession(t, rq2.ID, "S3", models.SessionTraining, "", 60, 2026, 6)
	addSession(t, rq1.ID, "S4", models.SessionTraining, "", 60, 2026, 6)

	url := "/api/reports/monthly?year=2026&month=6"
	w := testhelper.Do(r, testhelper.ReqAuth("GET", url, "", u.ID))
	require.Equal(t, http.StatusOK, w.Code)

	var resp handlers.MonthlyReportResponse
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))

	require.Len(t, resp.RacquetUsage, 2)
	assert.Equal(t, "Wilson Clash", resp.RacquetUsage[0].RacquetName) // ranked first
	assert.Equal(t, 3, resp.RacquetUsage[0].Sessions)
	assert.Equal(t, 1, resp.RacquetUsage[1].Sessions)
}
