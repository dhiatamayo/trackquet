// Package testhelper provides a shared in-memory SQLite database and router
// factory used across all handler test packages.
package testhelper

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"time"

	"trackquet/database"
	"trackquet/middleware"
	"trackquet/models"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// InitTestDB wires up an in-memory SQLite DB and points database.DB at it.
// Call this at the start of every test or TestMain.
func InitTestDB() {
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		panic(fmt.Sprintf("failed to open test db: %v", err))
	}
	db.AutoMigrate(
		&models.User{},
		&models.Racquet{},
		&models.StringRecord{},
		&models.Session{},
		&models.StringPreset{},
	)
	database.DB = db
}

// NewRouter returns a test-mode Gin engine with no middleware.
func NewRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	return gin.New()
}

// MakeToken generates a signed JWT for the given userID using the default dev secret.
func MakeToken(userID uint) string {
	claims := middleware.Claims{
		UserID: userID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, _ := token.SignedString(middleware.JWTSecret())
	return "Bearer " + signed
}

// AuthHeader returns an http.Header pre-populated with a valid Bearer token.
func AuthHeader(userID uint) http.Header {
	h := http.Header{}
	h.Set("Authorization", MakeToken(userID))
	h.Set("Content-Type", "application/json")
	return h
}

// Req builds an *http.Request with a JSON body.
func Req(method, url, body string) *http.Request {
	r, _ := http.NewRequest(method, url, strings.NewReader(body))
	r.Header.Set("Content-Type", "application/json")
	return r
}

// ReqAuth builds a request with a valid JWT for the given userID.
func ReqAuth(method, url, body string, userID uint) *http.Request {
	r := Req(method, url, body)
	r.Header.Set("Authorization", MakeToken(userID))
	return r
}

// Do executes a request against the given router and returns the recorder.
func Do(r *gin.Engine, req *http.Request) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}
