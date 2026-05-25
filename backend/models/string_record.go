package models

import "time"

// StringRecord captures a single string setup period for a racquet.
// A new record is created when a racquet is first registered or restrung.
// When restrung, the current record is archived (EndedAt set) and a new one begins.
type StringRecord struct {
	ID             uint       `gorm:"primaryKey" json:"id"`
	CreatedAt      time.Time  `json:"created_at"`
	RacquetID      uint       `gorm:"not null;index" json:"racquet_id"`
	StringName     string     `json:"string_name"`
	Gauge          string     `json:"gauge"` // e.g. "16", "16L", "17", "17L", "18"
	MainTension    float64    `json:"main_tension"`
	CrossTension   float64    `json:"cross_tension"`
	ThresholdHours int        `json:"threshold_hours"`
	StartedAt      time.Time  `json:"started_at"`
	EndedAt        *time.Time `json:"ended_at"`      // nil = currently active
	TotalMinutes   int        `json:"total_minutes"` // accumulated minutes for this string period
	Sessions       []Session  `gorm:"foreignKey:StringRecordID" json:"sessions,omitempty"`
}

// IsActive returns true if this string record is the current one
func (sr *StringRecord) IsActive() bool {
	return sr.EndedAt == nil
}

// TotalHours returns the play time for this string period
func (sr *StringRecord) TotalHours() float64 {
	return float64(sr.TotalMinutes) / 60.0
}
