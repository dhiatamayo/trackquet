package main

import (
	"log"
	"os"
	"strings"

	"trackquet/database"
	"trackquet/handlers"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	dsn := os.Getenv("DB_PATH")
	if dsn == "" {
		dsn = "trackquet.db"
	}

	database.Init(dsn)

	r := gin.Default()

	// CORS — allow frontend dev server + production origin
	allowedOrigins := []string{"http://localhost:5173", "http://localhost:3000"}
	if envOrigins := os.Getenv("ALLOWED_ORIGINS"); envOrigins != "" {
		allowedOrigins = strings.Split(envOrigins, ",")
	}
	r.Use(cors.New(cors.Config{
		AllowOrigins:     allowedOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		AllowCredentials: true,
	}))

	api := r.Group("/api")
	{
		// Racquets
		api.GET("/racquets", handlers.ListRacquets)
		api.POST("/racquets", handlers.CreateRacquet)
		api.GET("/racquets/:id", handlers.GetRacquet)
		api.PUT("/racquets/:id", handlers.UpdateRacquet)
		api.DELETE("/racquets/:id", handlers.DeleteRacquet)
		api.POST("/racquets/:id/restring", handlers.RestringRacquet)

		// Sessions (nested under racquet)
		api.GET("/racquets/:id/sessions", handlers.ListSessions)
		api.POST("/racquets/:id/sessions", handlers.CreateSession)
		api.DELETE("/racquets/:id/sessions/:sessionID", handlers.DeleteSession)

		// String records (history)
		api.GET("/racquets/:id/string-records", handlers.ListStringRecords)

		// String presets
		api.GET("/string-presets", handlers.ListStringPresets)
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("🎾 Trackquet server running on :%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("failed to start server: %v", err)
	}
}
