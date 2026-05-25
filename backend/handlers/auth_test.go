package handlers_test

import (
	"encoding/json"
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

func setupAuthRouter() *gin.Engine {
	r := testhelper.NewRouter()
	r.POST("/api/auth/register", handlers.Register)
	r.POST("/api/auth/login", handlers.Login)
	r.GET("/api/auth/me", middleware.RequireAuth, handlers.Me)
	return r
}

func TestRegister_Success(t *testing.T) {
	testhelper.InitTestDB()
	r := setupAuthRouter()

	w := testhelper.Do(r, testhelper.Req("POST", "/api/auth/register", `{
		"name":"Alice","username":"alice","email":"alice@example.com","password":"secret123"
	}`))
	assert.Equal(t, http.StatusCreated, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.NotEmpty(t, resp["token"])
	user := resp["user"].(map[string]interface{})
	assert.Equal(t, "Alice", user["name"])
	assert.Equal(t, "alice", user["username"])
	assert.Nil(t, user["password"]) // password must never be returned
}

func TestRegister_DuplicateUsername(t *testing.T) {
	testhelper.InitTestDB()
	r := setupAuthRouter()

	body := `{"name":"A","username":"dup","email":"a@example.com","password":"secret123"}`
	testhelper.Do(r, testhelper.Req("POST", "/api/auth/register", body))
	w := testhelper.Do(r, testhelper.Req("POST", "/api/auth/register",
		`{"name":"B","username":"dup","email":"b@example.com","password":"secret123"}`))
	assert.Equal(t, http.StatusConflict, w.Code)
}

func TestRegister_DuplicateEmail(t *testing.T) {
	testhelper.InitTestDB()
	r := setupAuthRouter()

	testhelper.Do(r, testhelper.Req("POST", "/api/auth/register",
		`{"name":"A","username":"user1","email":"shared@example.com","password":"secret123"}`))
	w := testhelper.Do(r, testhelper.Req("POST", "/api/auth/register",
		`{"name":"B","username":"user2","email":"shared@example.com","password":"secret123"}`))
	assert.Equal(t, http.StatusConflict, w.Code)
}

func TestRegister_InvalidEmail(t *testing.T) {
	testhelper.InitTestDB()
	r := setupAuthRouter()
	w := testhelper.Do(r, testhelper.Req("POST", "/api/auth/register",
		`{"name":"A","username":"user3","email":"not-an-email","password":"secret123"}`))
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestRegister_ShortPassword(t *testing.T) {
	testhelper.InitTestDB()
	r := setupAuthRouter()
	w := testhelper.Do(r, testhelper.Req("POST", "/api/auth/register",
		`{"name":"A","username":"user4","email":"u4@example.com","password":"123"}`))
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestLogin_Success(t *testing.T) {
	testhelper.InitTestDB()
	r := setupAuthRouter()

	testhelper.Do(r, testhelper.Req("POST", "/api/auth/register",
		`{"name":"Bob","username":"bob","email":"bob@example.com","password":"mypassword"}`))

	w := testhelper.Do(r, testhelper.Req("POST", "/api/auth/login",
		`{"username":"bob","password":"mypassword"}`))
	assert.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.NotEmpty(t, resp["token"])
}

func TestLogin_WrongPassword(t *testing.T) {
	testhelper.InitTestDB()
	r := setupAuthRouter()

	testhelper.Do(r, testhelper.Req("POST", "/api/auth/register",
		`{"name":"C","username":"carol","email":"carol@example.com","password":"rightpass"}`))
	w := testhelper.Do(r, testhelper.Req("POST", "/api/auth/login",
		`{"username":"carol","password":"wrongpass"}`))
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestLogin_UnknownUser(t *testing.T) {
	testhelper.InitTestDB()
	r := setupAuthRouter()
	w := testhelper.Do(r, testhelper.Req("POST", "/api/auth/login",
		`{"username":"ghost","password":"whatever"}`))
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestMe_Authenticated(t *testing.T) {
	testhelper.InitTestDB()
	r := setupAuthRouter()

	testhelper.Do(r, testhelper.Req("POST", "/api/auth/register",
		`{"name":"Dave","username":"dave","email":"dave@example.com","password":"pass123"}`))

	var user models.User
	database.DB.Where("username = ?", "dave").First(&user)

	w := testhelper.Do(r, testhelper.ReqAuth("GET", "/api/auth/me", "", user.ID))
	assert.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, "dave", resp["username"])
}

func TestMe_Unauthenticated(t *testing.T) {
	testhelper.InitTestDB()
	r := setupAuthRouter()
	w := testhelper.Do(r, testhelper.Req("GET", "/api/auth/me", ""))
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestMe_InvalidToken(t *testing.T) {
	testhelper.InitTestDB()
	r := setupAuthRouter()
	req := testhelper.Req("GET", "/api/auth/me", "")
	req.Header.Set("Authorization", "Bearer totallywrongtoken")
	w := testhelper.Do(r, req)
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}
