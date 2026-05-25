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

func setupSessionRouter() *gin.Engine {
	r := testhelper.NewRouter()
	auth := r.Group("/api")
	auth.Use(middleware.RequireAuth)
	{
		auth.GET("/racquets/:id/sessions", handlers.ListSessions)
		auth.POST("/racquets/:id/sessions", handlers.CreateSession)
		auth.DELETE("/racquets/:id/sessions/:sessionID", handlers.DeleteSession)
		auth.GET("/racquets/:id/string-records", handlers.ListStringRecords)
	}
	return r
}

func seedRacquetWithUser(t *testing.T) (models.Racquet, uint) {
	t.Helper()
	u := models.User{Name: "Player", Username: fmt.Sprintf("p%d", time.Now().UnixNano()),
		Email: fmt.Sprintf("p%d@test.com", time.Now().UnixNano()), Password: "x"}
	require.NoError(t, database.DB.Create(&u).Error)
	rq := models.Racquet{UserID: u.ID, Name: "Test Racquet", ThresholdHours: 20}
	require.NoError(t, database.DB.Create(&rq).Error)
	sr := models.StringRecord{RacquetID: rq.ID, StringName: "ALU", ThresholdHours: 20,
		StartedAt: time.Now().Add(-7 * 24 * time.Hour)}
	require.NoError(t, database.DB.Create(&sr).Error)
	return rq, u.ID
}

func TestListSessions_Empty(t *testing.T) {
	testhelper.InitTestDB()
	r := setupSessionRouter()
	rq, uid := seedRacquetWithUser(t)

	w := testhelper.Do(r, testhelper.ReqAuth("GET",
		fmt.Sprintf("/api/racquets/%d/sessions", rq.ID), "", uid))
	assert.Equal(t, http.StatusOK, w.Code)
	var list []interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &list))
	assert.Len(t, list, 0)
}

func TestCreateSession_Success(t *testing.T) {
	testhelper.InitTestDB()
	r := setupSessionRouter()
	rq, uid := seedRacquetWithUser(t)

	w := testhelper.Do(r, testhelper.ReqAuth("POST",
		fmt.Sprintf("/api/racquets/%d/sessions", rq.ID),
		`{"date":"2026-05-20","duration_min":90,"type":"training","name":"Morning hit"}`, uid))
	assert.Equal(t, http.StatusCreated, w.Code)

	var sess map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &sess))
	assert.Equal(t, float64(90), sess["duration_min"])
	assert.Equal(t, "Morning hit", sess["name"])

	// Verify racquet TotalMinutes updated
	var rqUpdated models.Racquet
	database.DB.First(&rqUpdated, rq.ID)
	assert.Equal(t, 90, rqUpdated.TotalMinutes)
}

func TestCreateSession_BackdatedBeforeStringStart(t *testing.T) {
	testhelper.InitTestDB()
	r := setupSessionRouter()
	rq, uid := seedRacquetWithUser(t)

	// Date is 30 days ago — before the string record started (7 days ago) — should still work
	w := testhelper.Do(r, testhelper.ReqAuth("POST",
		fmt.Sprintf("/api/racquets/%d/sessions", rq.ID),
		`{"date":"2026-04-01","duration_min":60,"type":"match"}`, uid))
	assert.Equal(t, http.StatusCreated, w.Code)
}

func TestCreateSession_MissingRequiredFields(t *testing.T) {
	testhelper.InitTestDB()
	r := setupSessionRouter()
	rq, uid := seedRacquetWithUser(t)

	w := testhelper.Do(r, testhelper.ReqAuth("POST",
		fmt.Sprintf("/api/racquets/%d/sessions", rq.ID),
		`{"duration_min":60}`, uid)) // missing date and type
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestCreateSession_InvalidDateFormat(t *testing.T) {
	testhelper.InitTestDB()
	r := setupSessionRouter()
	rq, uid := seedRacquetWithUser(t)

	w := testhelper.Do(r, testhelper.ReqAuth("POST",
		fmt.Sprintf("/api/racquets/%d/sessions", rq.ID),
		`{"date":"not-a-date","duration_min":60,"type":"training"}`, uid))
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestCreateSession_RacquetNotFound(t *testing.T) {
	testhelper.InitTestDB()
	r := setupSessionRouter()
	u := models.User{Name: "X", Username: "x_user", Email: "x@test.com", Password: "x"}
	database.DB.Create(&u)

	w := testhelper.Do(r, testhelper.ReqAuth("POST", "/api/racquets/9999/sessions",
		`{"date":"2026-05-20","duration_min":60,"type":"training"}`, u.ID))
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestCreateSession_WithExplicitStringRecord(t *testing.T) {
	testhelper.InitTestDB()
	r := setupSessionRouter()
	rq, uid := seedRacquetWithUser(t)

	var sr models.StringRecord
	database.DB.Where("racquet_id = ?", rq.ID).First(&sr)

	body := fmt.Sprintf(
		`{"date":"2026-05-20","duration_min":45,"type":"match","string_record_id":%d}`, sr.ID)
	w := testhelper.Do(r, testhelper.ReqAuth("POST",
		fmt.Sprintf("/api/racquets/%d/sessions", rq.ID), body, uid))
	assert.Equal(t, http.StatusCreated, w.Code)
}

func TestCreateSession_StringRecordAfterRetired(t *testing.T) {
	testhelper.InitTestDB()
	r := setupSessionRouter()
	rq, uid := seedRacquetWithUser(t)

	// Retire the string record
	ended := time.Now().Add(-24 * time.Hour)
	database.DB.Model(&models.StringRecord{}).Where("racquet_id = ?", rq.ID).
		Update("ended_at", ended)

	var sr models.StringRecord
	database.DB.Where("racquet_id = ?", rq.ID).First(&sr)

	body := fmt.Sprintf(
		`{"date":"2026-05-25","duration_min":60,"type":"training","string_record_id":%d}`, sr.ID)
	w := testhelper.Do(r, testhelper.ReqAuth("POST",
		fmt.Sprintf("/api/racquets/%d/sessions", rq.ID), body, uid))
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestDeleteSession_Success(t *testing.T) {
	testhelper.InitTestDB()
	r := setupSessionRouter()
	rq, uid := seedRacquetWithUser(t)

	// Create a session first
	w := testhelper.Do(r, testhelper.ReqAuth("POST",
		fmt.Sprintf("/api/racquets/%d/sessions", rq.ID),
		`{"date":"2026-05-20","duration_min":60,"type":"training"}`, uid))
	require.Equal(t, http.StatusCreated, w.Code)

	var sess map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &sess)
	sessID := int(sess["id"].(float64))

	// Delete it
	w2 := testhelper.Do(r, testhelper.ReqAuth("DELETE",
		fmt.Sprintf("/api/racquets/%d/sessions/%d", rq.ID, sessID), "", uid))
	assert.Equal(t, http.StatusOK, w2.Code)

	// Verify minutes subtracted
	var rqUpdated models.Racquet
	database.DB.First(&rqUpdated, rq.ID)
	assert.Equal(t, 0, rqUpdated.TotalMinutes)
}

func TestDeleteSession_NotFound(t *testing.T) {
	testhelper.InitTestDB()
	r := setupSessionRouter()
	rq, uid := seedRacquetWithUser(t)

	w := testhelper.Do(r, testhelper.ReqAuth("DELETE",
		fmt.Sprintf("/api/racquets/%d/sessions/9999", rq.ID), "", uid))
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestListStringRecords(t *testing.T) {
	testhelper.InitTestDB()
	r := setupSessionRouter()
	rq, uid := seedRacquetWithUser(t)

	w := testhelper.Do(r, testhelper.ReqAuth("GET",
		fmt.Sprintf("/api/racquets/%d/string-records", rq.ID), "", uid))
	assert.Equal(t, http.StatusOK, w.Code)
	var list []interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &list))
	assert.GreaterOrEqual(t, len(list), 1)
}
