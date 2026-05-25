package models

import "time"

type SessionType string

const (
	SessionMatch    SessionType = "match"
	SessionTraining SessionType = "training"
)

// Session represents a single play session logged against a racquet
type Session struct {
	ID             uint        `gorm:"primaryKey" json:"id"`
	CreatedAt      time.Time   `json:"created_at"`
	RacquetID      uint        `gorm:"not null;index" json:"racquet_id"`
	StringRecordID uint        `gorm:"index" json:"string_record_id"`
	Date           time.Time   `json:"date"`
	DurationMin    int         `json:"duration_min"` // duration in minutes
	Type           SessionType `json:"type"`         // "match" or "training"
	Name           string      `json:"name"`         // e.g. "Coaching at Cinere" or "Match vs Ramzy"
	Notes          string      `json:"notes"`
}
