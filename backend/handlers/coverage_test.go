package handlers_test

import (
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
)

func setupCoverageRouter() *gin.Engine {
	r := testhelper.NewRouter()
	auth := r.Group("/api")
	auth.Use(middleware.RequireAuth)
	{
		auth.GET("/auth/me", handlers.Me)
		auth.DELETE("/racquets/:id", handlers.DeleteRacquet)
		auth.POST("/racquets/:id/restring", handlers.RestringRacquet)
		auth.GET("/racquets/:id/sessions", handlers.ListSessions)
		auth.DELETE("/racquets/:id/sessions/:sessionID", handlers.DeleteSession)
		auth.GET("/racquets/:id/string-records", handlers.ListStringRecords)
	}
	return r
}

func TestMe_UserNotFound(t *testing.T) {
	testhelper.InitTestDB()
	r := setupCoverageRouter()
	// Token for a userID that doesn't exist in DB
	w := testhelper.Do(r, testhelper.ReqAuth("GET", "/api/auth/me", "", 99999))
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestDeleteRacquet_InvalidID(t *testing.T) {
	testhelper.InitTestDB()
	r := setupCoverageRouter()
	u := models.User{Name: "T", Username: "del_inv", Email: "del_inv@test.com", Password: "x"}
	database.DB.Create(&u)
	w := testhelper.Do(r, testhelper.ReqAuth("DELETE", "/api/racquets/abc", "", u.ID))
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestRestringRacquet_OtherUser(t *testing.T) {
	testhelper.InitTestDB()
	r := setupCoverageRouter()
	u1 := models.User{Name: "A", Username: "res_a", Email: "res_a@test.com", Password: "x"}
	u2 := models.User{Name: "B", Username: "res_b", Email: "res_b@test.com", Password: "x"}
	database.DB.Create(&u1)
	database.DB.Create(&u2)
	rq := models.Racquet{UserID: u1.ID, Name: "R", ThresholdHours: 20}
	database.DB.Create(&rq)

	w := testhelper.Do(r, testhelper.ReqAuth("POST",
		fmt.Sprintf("/api/racquets/%d/restring", rq.ID),
		`{"string_name":"RPM"}`, u2.ID))
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestRestringRacquet_InvalidID(t *testing.T) {
	testhelper.InitTestDB()
	r := setupCoverageRouter()
	u := models.User{Name: "T", Username: "res_inv", Email: "res_inv@test.com", Password: "x"}
	database.DB.Create(&u)
	w := testhelper.Do(r, testhelper.ReqAuth("POST", "/api/racquets/abc/restring", "{}", u.ID))
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestListSessions_InvalidRacquetID(t *testing.T) {
	testhelper.InitTestDB()
	r := setupCoverageRouter()
	u := models.User{Name: "T", Username: "ls_inv", Email: "ls_inv@test.com", Password: "x"}
	database.DB.Create(&u)
	w := testhelper.Do(r, testhelper.ReqAuth("GET", "/api/racquets/abc/sessions", "", u.ID))
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestDeleteSession_InvalidSessionID(t *testing.T) {
	testhelper.InitTestDB()
	r := setupCoverageRouter()
	u := models.User{Name: "T", Username: "ds_inv", Email: "ds_inv@test.com", Password: "x"}
	database.DB.Create(&u)
	rq := models.Racquet{UserID: u.ID, Name: "R", ThresholdHours: 20}
	database.DB.Create(&rq)
	w := testhelper.Do(r, testhelper.ReqAuth("DELETE",
		fmt.Sprintf("/api/racquets/%d/sessions/abc", rq.ID), "", u.ID))
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestDeleteSession_InvalidRacquetID(t *testing.T) {
	testhelper.InitTestDB()
	r := setupCoverageRouter()
	u := models.User{Name: "T", Username: "dsr_inv", Email: "dsr_inv@test.com", Password: "x"}
	database.DB.Create(&u)
	w := testhelper.Do(r, testhelper.ReqAuth("DELETE", "/api/racquets/abc/sessions/1", "", u.ID))
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestListStringRecords_InvalidRacquetID(t *testing.T) {
	testhelper.InitTestDB()
	r := setupCoverageRouter()
	u := models.User{Name: "T", Username: "lsr_inv", Email: "lsr_inv@test.com", Password: "x"}
	database.DB.Create(&u)
	w := testhelper.Do(r, testhelper.ReqAuth("GET", "/api/racquets/abc/string-records", "", u.ID))
	assert.Equal(t, http.StatusBadRequest, w.Code)
}
