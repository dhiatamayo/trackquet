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

func setupUpdateRouter() *gin.Engine {
	r := testhelper.NewRouter()
	auth := r.Group("/api")
	auth.Use(middleware.RequireAuth)
	{
		auth.PUT("/racquets/:id", handlers.UpdateRacquet)
		auth.GET("/racquets/:id", handlers.GetRacquet)
		auth.POST("/racquets", handlers.CreateRacquet)
	}
	return r
}

func TestUpdateRacquet_AllFields(t *testing.T) {
	testhelper.InitTestDB()
	r := setupUpdateRouter()
	u := models.User{Name: "T", Username: "t_upd_all", Email: "t_upd_all@test.com", Password: "x"}
	database.DB.Create(&u)
	rq := models.Racquet{UserID: u.ID, Name: "Old", Brand: "OldBrand",
		HeadSize: 95, Weight: 300, ThresholdHours: 20}
	database.DB.Create(&rq)

	w := testhelper.Do(r, testhelper.ReqAuth("PUT",
		fmt.Sprintf("/api/racquets/%d", rq.ID), `{
		"name":"New","brand":"NewBrand","year":2024,
		"head_size":100,"weight":310,"string_name":"RPM",
		"gauge":"17","main_tension":55,"cross_tension":52,"threshold_hours":16
	}`, u.ID))
	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, "New", resp["name"])
	assert.Equal(t, "NewBrand", resp["brand"])
	assert.Equal(t, float64(2024), resp["year"])
	assert.Equal(t, float64(100), resp["head_size"])
	assert.Equal(t, float64(310), resp["weight"])
	assert.Equal(t, "RPM", resp["string_name"])
	assert.Equal(t, "17", resp["gauge"])
	assert.Equal(t, float64(55), resp["main_tension"])
	assert.Equal(t, float64(52), resp["cross_tension"])
	assert.Equal(t, float64(16), resp["threshold_hours"])
}

func TestUpdateRacquet_NotFound(t *testing.T) {
	testhelper.InitTestDB()
	r := setupUpdateRouter()
	u := models.User{Name: "T", Username: "t_upd_nf", Email: "t_upd_nf@test.com", Password: "x"}
	database.DB.Create(&u)
	w := testhelper.Do(r, testhelper.ReqAuth("PUT", "/api/racquets/9999",
		`{"name":"X"}`, u.ID))
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestCreateRacquet_PresetThreshold(t *testing.T) {
	testhelper.InitTestDB()
	database.DB.Create(&models.StringPreset{Name: "Prince Syn Gut", Brand: "Prince", ThresholdHours: 40})
	r := setupUpdateRouter()
	u := models.User{Name: "T", Username: "t_preset", Email: "t_preset@test.com", Password: "x"}
	database.DB.Create(&u)

	// No gauge — should fall back to string preset threshold
	w := testhelper.Do(r, testhelper.ReqAuth("POST", "/api/racquets", `{
		"name":"My Racquet","string_name":"Prince Syn Gut"
	}`, u.ID))
	require.Equal(t, http.StatusCreated, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, float64(40), resp["threshold_hours"])
}
