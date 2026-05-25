package database

import (
	"log"
	"os"

	"trackquet/models"

	"gorm.io/driver/postgres"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func Init(dsn string) {
	var err error
	var dialector gorm.Dialector

	if dbURL := os.Getenv("DATABASE_URL"); dbURL != "" {
		log.Println("Using PostgreSQL (DATABASE_URL)")
		dialector = postgres.Open(dbURL)
	} else {
		log.Printf("Using SQLite: %s", dsn)
		dialector = sqlite.Open(dsn)
	}

	DB, err = gorm.Open(dialector, &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}

	err = DB.AutoMigrate(&models.Racquet{}, &models.StringRecord{}, &models.Session{}, &models.StringPreset{})
	if err != nil {
		log.Fatalf("failed to migrate database: %v", err)
	}

	seedStringPresets()
	log.Println("Database initialized and migrated.")
}

// seedStringPresets inserts well-known string presets on first run
func seedStringPresets() {
	presets := []models.StringPreset{
		{Name: "Luxilon ALU Power", Brand: "Luxilon", ThresholdHours: 20},
		{Name: "Babolat RPM Blast", Brand: "Babolat", ThresholdHours: 20},
		{Name: "Wilson NXT", Brand: "Wilson", ThresholdHours: 30},
		{Name: "Tecnifibre X-One Biphase", Brand: "Tecnifibre", ThresholdHours: 25},
		{Name: "Yonex Poly Tour Pro", Brand: "Yonex", ThresholdHours: 20},
		{Name: "Head Hawk", Brand: "Head", ThresholdHours: 20},
		{Name: "Solinco Tour Bite", Brand: "Solinco", ThresholdHours: 20},
		{Name: "Prince Synthetic Gut", Brand: "Prince", ThresholdHours: 40},
		{Name: "Gamma TNT2", Brand: "Gamma", ThresholdHours: 35},
		{Name: "Kirschbaum Pro Line II", Brand: "Kirschbaum", ThresholdHours: 20},
	}

	for _, p := range presets {
		DB.FirstOrCreate(&p, models.StringPreset{Name: p.Name})
	}
}
