package handlers_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"trackquet/database"
	"trackquet/handlers"
	"trackquet/middleware"
	"trackquet/models"
	"trackquet/testhelper"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupRacquetRouter() *gin.Engine {
	r := testhelper.NewRouter()
	auth := r.Group("/api")
	auth.Use(middleware.RequireAuth)
	{
		auth.GET("/racquets", handlers.ListRacquets)
		auth.POST("/racquets", handlers.CreateRacquet)
		auth.GET("/racquets/:id", handlers.GetRacquet)
		auth.PUT("/racquets/:id", handlers.UpdateRacquet)
		auth.DELETE("/racquets/:id", handlers.DeleteRacquet)
		auth.POST("/racquets/:id/restring", handlers.RestringRacquet)
		auth.GET("/string-presets", handlers.ListStringPresets)
	}
	return r
}

// seedUser inserts a user and returns its ID.
func seedUser(t *testing.T, username string) uint {
	t.Helper()
	u := models.User{Name: username, Username: username, Email: username + "@test.com", Password: "x"}
	require.NoError(t, database.DB.Create(&u).Error)
	return u.ID
}

// seedRacquet creates a racquet owned by the given user.
func seedRacquet(t *testing.T, userID uint, name string) models.Racquet {
	t.Helper()
	r := models.Racquet{UserID: userID, Name: name, ThresholdHours: 20}
	require.NoError(t, database.DB.Create(&r).Error)
	sr := models.StringRecord{RacquetID: r.ID, StringName: "ALU Power", ThresholdHours: 20}
	database.DB.Create(&sr)
	return r
}

func TestListRacquets_Empty(t *testing.T) {
	testhelper.InitTestDB()
	r := setupRacquetRouter()
	uid := seedUser(t, "u1")
	w := testhelper.Do(r, testhelper.ReqAuth("GET", "/api/racquets", "", uid))
	assert.Equal(t, http.StatusOK, w.Code)
	var list []interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &list))
	assert.Len(t, list, 0)
}

func TestListRacquets_OnlyOwnRacquets(t *testing.T) {
	testhelper.InitTestDB()
	r := setupRacquetRouter()
	uid1 := seedUser(t, "owner1")
	uid2 := seedUser(t, "owner2")
	seedRacquet(t, uid1, "Blade 98")
	seedRacquet(t, uid2, "Pure Drive")

	w := testhelper.Do(r, testhelper.ReqAuth("GET", "/api/racquets", "", uid1))
	assert.Equal(t, http.StatusOK, w.Code)
	var list []interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &list))
	assert.Len(t, list, 1)
}

func TestCreateRacquet_Success(t *testing.T) {
	testhelper.InitTestDB()
	r := setupRacquetRouter()
	uid := seedUser(t, "creator")

	w := testhelper.Do(r, testhelper.ReqAuth("POST", "/api/racquets", `{
		"name":"Pro Staff 97","brand":"Wilson","gauge":"16","main_tension":55,"cross_tension":52
	}`, uid))
	assert.Equal(t, http.StatusCreated, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, "Pro Staff 97", resp["name"])
	assert.Equal(t, float64(uid), resp["user_id"])
	// threshold should be auto-set from gauge 16 = 20h
	assert.Equal(t, float64(20), resp["threshold_hours"])
}

func TestCreateRacquet_MissingName(t *testing.T) {
	testhelper.InitTestDB()
	r := setupRacquetRouter()
	uid := seedUser(t, "u_noname")
	w := testhelper.Do(r, testhelper.ReqAuth("POST", "/api/racquets", `{"brand":"Wilson"}`, uid))
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestCreateRacquet_GaugeDefaultThreshold(t *testing.T) {
	testhelper.InitTestDB()
	r := setupRacquetRouter()
	uid := seedUser(t, "u_gauge")

	cases := []struct {
		gauge    string
		expected float64
	}{
		{"15", 25}, {"15L", 22}, {"16", 20}, {"16L", 18},
		{"17", 16}, {"17L", 14}, {"18", 12},
	}
	for _, tc := range cases {
		t.Run("gauge_"+tc.gauge, func(t *testing.T) {
			testhelper.InitTestDB()
			uid = seedUser(t, "g_"+tc.gauge)
			w := testhelper.Do(r, testhelper.ReqAuth("POST", "/api/racquets",
				fmt.Sprintf(`{"name":"R","gauge":"%s"}`, tc.gauge), uid))
			assert.Equal(t, http.StatusCreated, w.Code)
			var resp map[string]interface{}
			json.Unmarshal(w.Body.Bytes(), &resp)
			assert.Equal(t, tc.expected, resp["threshold_hours"], "gauge %s", tc.gauge)
		})
	}
}

func TestGetRacquet_Success(t *testing.T) {
	testhelper.InitTestDB()
	r := setupRacquetRouter()
	uid := seedUser(t, "getter")
	racquet := seedRacquet(t, uid, "Vcore 95")

	w := testhelper.Do(r, testhelper.ReqAuth("GET",
		fmt.Sprintf("/api/racquets/%d", racquet.ID), "", uid))
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestGetRacquet_NotFound(t *testing.T) {
	testhelper.InitTestDB()
	r := setupRacquetRouter()
	uid := seedUser(t, "getter2")
	w := testhelper.Do(r, testhelper.ReqAuth("GET", "/api/racquets/9999", "", uid))
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestGetRacquet_OtherUsersRacquet(t *testing.T) {
	testhelper.InitTestDB()
	r := setupRacquetRouter()
	uid1 := seedUser(t, "own_a")
	uid2 := seedUser(t, "own_b")
	racquet := seedRacquet(t, uid1, "Blade")

	w := testhelper.Do(r, testhelper.ReqAuth("GET",
		fmt.Sprintf("/api/racquets/%d", racquet.ID), "", uid2))
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestUpdateRacquet_Success(t *testing.T) {
	testhelper.InitTestDB()
	r := setupRacquetRouter()
	uid := seedUser(t, "updater")
	racquet := seedRacquet(t, uid, "Old Name")

	w := testhelper.Do(r, testhelper.ReqAuth("PUT",
		fmt.Sprintf("/api/racquets/%d", racquet.ID),
		`{"name":"New Name"}`, uid))
	assert.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, "New Name", resp["name"])
}

func TestUpdateRacquet_OtherUser(t *testing.T) {
	testhelper.InitTestDB()
	r := setupRacquetRouter()
	uid1 := seedUser(t, "upd_own")
	uid2 := seedUser(t, "upd_other")
	racquet := seedRacquet(t, uid1, "Mine")

	w := testhelper.Do(r, testhelper.ReqAuth("PUT",
		fmt.Sprintf("/api/racquets/%d", racquet.ID),
		`{"name":"Stolen"}`, uid2))
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestDeleteRacquet_Success(t *testing.T) {
	testhelper.InitTestDB()
	r := setupRacquetRouter()
	uid := seedUser(t, "deleter")
	racquet := seedRacquet(t, uid, "ToDelete")

	w := testhelper.Do(r, testhelper.ReqAuth("DELETE",
		fmt.Sprintf("/api/racquets/%d", racquet.ID), "", uid))
	assert.Equal(t, http.StatusOK, w.Code)

	// Confirm gone
	w2 := testhelper.Do(r, testhelper.ReqAuth("GET",
		fmt.Sprintf("/api/racquets/%d", racquet.ID), "", uid))
	assert.Equal(t, http.StatusNotFound, w2.Code)
}

func TestDeleteRacquet_OtherUser(t *testing.T) {
	testhelper.InitTestDB()
	r := setupRacquetRouter()
	uid1 := seedUser(t, "del_own")
	uid2 := seedUser(t, "del_other")
	racquet := seedRacquet(t, uid1, "Protected")

	w := testhelper.Do(r, testhelper.ReqAuth("DELETE",
		fmt.Sprintf("/api/racquets/%d", racquet.ID), "", uid2))
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestRestringRacquet_ResetsMinutes(t *testing.T) {
	testhelper.InitTestDB()
	r := setupRacquetRouter()
	uid := seedUser(t, "restringer")
	racquet := seedRacquet(t, uid, "Stringer")

	// Manually add some play time
	database.DB.Model(&racquet).Update("total_minutes", 600)

	w := testhelper.Do(r, testhelper.ReqAuth("POST",
		fmt.Sprintf("/api/racquets/%d/restring", racquet.ID),
		`{"string_name":"Babolat RPM","gauge":"17","main_tension":54}`, uid))
	assert.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, float64(0), resp["total_minutes"]) // reset
	assert.Equal(t, "Babolat RPM", resp["string_name"])
}

func TestListStringPresets(t *testing.T) {
	testhelper.InitTestDB()
	// Seed a preset
	database.DB.Create(&models.StringPreset{Name: "Test String", Brand: "TestBrand", ThresholdHours: 15})
	r := setupRacquetRouter()
	uid := seedUser(t, "preset_user")

	w := testhelper.Do(r, testhelper.ReqAuth("GET", "/api/string-presets", "", uid))
	assert.Equal(t, http.StatusOK, w.Code)
	var list []interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &list))
	assert.GreaterOrEqual(t, len(list), 1)
}

// ── Hybrid string tests ──────────────────────────────────────────────────────

func TestCreateRacquet_HybridThreshold(t *testing.T) {
	testhelper.InitTestDB()
	r := setupRacquetRouter()
	uid := seedUser(t, "hybrid_creator")

	// main gauge 17 (16h) × 0.55 + cross gauge 16 (20h) × 0.45 = 8.8 + 9.0 = 17.8 → round = 18
	w := testhelper.Do(r, testhelper.ReqAuth("POST", "/api/racquets", `{
		"name":"Hybrid Racquet",
		"string_name":"Solinco Confidential",
		"gauge":"17",
		"cross_string_name":"Solinco Hyper-G",
		"cross_gauge":"16"
	}`, uid))
	assert.Equal(t, http.StatusCreated, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, "Solinco Confidential", resp["string_name"])
	assert.Equal(t, "Solinco Hyper-G", resp["cross_string_name"])
	assert.Equal(t, "16", resp["cross_gauge"])
	// threshold = round(16*0.55 + 20*0.45) = round(8.8+9.0) = 18
	assert.Equal(t, float64(18), resp["threshold_hours"])
}

func TestCreateRacquet_HybridUnknownGauge(t *testing.T) {
	testhelper.InitTestDB()
	r := setupRacquetRouter()
	uid := seedUser(t, "hybrid_unknown")

	// Unknown gauge on both → both default to 20h → threshold = round(20*0.55 + 20*0.45) = 20
	w := testhelper.Do(r, testhelper.ReqAuth("POST", "/api/racquets", `{
		"name":"Mystery Hybrid",
		"string_name":"String A",
		"cross_string_name":"String B"
	}`, uid))
	assert.Equal(t, http.StatusCreated, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, float64(20), resp["threshold_hours"])
}

func TestRestringRacquet_HybridSetup(t *testing.T) {
	testhelper.InitTestDB()
	r := setupRacquetRouter()
	uid := seedUser(t, "hybrid_restringer")
	racquet := seedRacquet(t, uid, "Hybrid Stringer")

	// Restring with hybrid: main 17 (16h), cross 15 (25h)
	// threshold = round(16*0.55 + 25*0.45) = round(8.8+11.25) = round(20.05) = 20
	w := testhelper.Do(r, testhelper.ReqAuth("POST",
		fmt.Sprintf("/api/racquets/%d/restring", racquet.ID),
		`{"string_name":"Luxilon ALU","gauge":"17","cross_string_name":"Babolat VS Touch","cross_gauge":"15"}`,
		uid))
	assert.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, "Luxilon ALU", resp["string_name"])
	assert.Equal(t, "Babolat VS Touch", resp["cross_string_name"])
	assert.Equal(t, float64(20), resp["threshold_hours"])
	assert.Equal(t, float64(0), resp["total_minutes"]) // counter reset
}

func TestRestringRacquet_NoActiveRecord(t *testing.T) {
	// Restring when no active string record exists (e.g. manually deleted)
	testhelper.InitTestDB()
	r := setupRacquetRouter()
	uid := seedUser(t, "no_sr_restringer")
	racquet := models.Racquet{UserID: uid, Name: "Bare", ThresholdHours: 20}
	require.NoError(t, database.DB.Create(&racquet).Error)
	// Deliberately no StringRecord created

	w := testhelper.Do(r, testhelper.ReqAuth("POST",
		fmt.Sprintf("/api/racquets/%d/restring", racquet.ID),
		`{"string_name":"RPM","gauge":"16"}`, uid))
	assert.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, "RPM", resp["string_name"])
}

func TestCreateRacquet_UnknownGaugeDefaultsTo20(t *testing.T) {
	// gaugeDefaultThreshold("xyz") returns 0 → fallback to 20
	testhelper.InitTestDB()
	r := setupRacquetRouter()
	uid := seedUser(t, "unknown_gauge_user")
	w := testhelper.Do(r, testhelper.ReqAuth("POST", "/api/racquets",
		`{"name":"R","gauge":"xyz"}`, uid))
	assert.Equal(t, http.StatusCreated, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, float64(20), resp["threshold_hours"])
}
