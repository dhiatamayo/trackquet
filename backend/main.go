package main

import (
	"log"
	"os"
	"strings"

	"trackquet/database"
	"trackquet/handlers"
	"trackquet/middleware"

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
		if envOrigins == "*" {
			// Wildcard: allow any origin (useful for debugging — don't use in production long-term)
			allowedOrigins = []string{"*"}
		} else {
			allowedOrigins = strings.Split(envOrigins, ",")
		}
	}
	log.Printf("CORS allowed origins: %v", allowedOrigins)
	corsConfig := cors.Config{
		AllowMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders: []string{"Origin", "Content-Type", "Accept", "Authorization"},
	}
	if len(allowedOrigins) == 1 && allowedOrigins[0] == "*" {
		corsConfig.AllowAllOrigins = true
	} else {
		corsConfig.AllowOrigins = allowedOrigins
		corsConfig.AllowCredentials = true
	}
	r.Use(cors.New(corsConfig))

	// Public health check (used by Render)
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	api := r.Group("/api")
	{
		// Auth (public)
		api.POST("/auth/register", handlers.Register)
		api.POST("/auth/login", handlers.Login)

		// All routes below require a valid JWT
		protected := api.Group("/")
		protected.Use(middleware.RequireAuth)
		{
			// Current user
			protected.GET("/auth/me", handlers.Me)

			// Racquets
			protected.GET("/racquets", handlers.ListRacquets)
			protected.POST("/racquets", handlers.CreateRacquet)
			protected.GET("/racquets/:id", handlers.GetRacquet)
			protected.PUT("/racquets/:id", handlers.UpdateRacquet)
			protected.DELETE("/racquets/:id", handlers.DeleteRacquet)
			protected.POST("/racquets/:id/restring", handlers.RestringRacquet)

			// Sessions (nested under racquet)
			protected.GET("/racquets/:id/sessions", handlers.ListSessions)
			protected.POST("/racquets/:id/sessions", handlers.CreateSession)
			protected.GET("/racquets/:id/sessions/:sessionID", handlers.GetSession)
			protected.PUT("/racquets/:id/sessions/:sessionID", handlers.UpdateSession)
			protected.DELETE("/racquets/:id/sessions/:sessionID", handlers.DeleteSession)

			// String records (history)
			protected.GET("/racquets/:id/string-records", handlers.ListStringRecords)

			// String presets (public-ish but fine behind auth)
			protected.GET("/string-presets", handlers.ListStringPresets)

			// Monthly report
			protected.GET("/reports/monthly", handlers.GetMonthlyReport)
		}
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
