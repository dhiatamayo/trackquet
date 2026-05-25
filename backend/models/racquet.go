package models

import (
	"time"

	"gorm.io/gorm"
)

// StringPreset holds well-known string brands with their default restring threshold
type StringPreset struct {
	ID             uint   `gorm:"primaryKey" json:"id"`
	Name           string `gorm:"uniqueIndex;not null" json:"name"`
	Brand          string `json:"brand"`
	ThresholdHours int    `json:"threshold_hours"` // recommended max hours before restringing
}

// Racquet represents a tennis racquet owned by the user
type Racquet struct {
	ID             uint           `gorm:"primaryKey" json:"id"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
	UserID         uint           `gorm:"index;not null;default:0" json:"user_id"`
	Name           string         `gorm:"not null" json:"name"`
	Brand          string         `json:"brand"`
	Year           int            `json:"year"`            // release year / version year
	HeadSize       float64        `json:"head_size"`       // in sq. inches
	Weight         float64        `json:"weight"`          // in grams
	StringName     string         `json:"string_name"`     // current string name
	Gauge          string         `json:"gauge"`           // string gauge e.g. "16", "17", "18"
	MainTension    float64        `json:"main_tension"`    // main string tension in lbs
	CrossTension   float64        `json:"cross_tension"`   // cross string tension in lbs
	ThresholdHours int            `json:"threshold_hours"` // hours before restring
	TotalMinutes   int            `json:"total_minutes"`   // accumulated play time in minutes (current string)
	Sessions       []Session      `gorm:"foreignKey:RacquetID" json:"sessions,omitempty"`
	StringRecords  []StringRecord `gorm:"foreignKey:RacquetID" json:"string_records,omitempty"`
}

// TotalHours returns accumulated play time as hours (float)
func (r *Racquet) TotalHours() float64 {
	return float64(r.TotalMinutes) / 60.0
}

// NeedsRestring returns true if the accumulated hours exceed the threshold
func (r *Racquet) NeedsRestring() bool {
	if r.ThresholdHours <= 0 {
		return false
	}
	return r.TotalHours() >= float64(r.ThresholdHours)
}

// RestringSuggestion holds the recommendation message
func (r *Racquet) RestringSuggestion() string {
	if r.ThresholdHours <= 0 {
		return "No restring threshold set."
	}
	remaining := float64(r.ThresholdHours) - r.TotalHours()
	if remaining <= 0 {
		return "⚠️ You should restring your racquet now!"
	}
	if remaining <= float64(r.ThresholdHours)*0.15 {
		return "🔔 Getting close — consider restringing soon."
	}
	return "✅ Strings are in good shape."
}
