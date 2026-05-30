package models

import "time"

type SessionType string
type MatchResult string

const (
	SessionMatch    SessionType = "match"
	SessionTraining SessionType = "training"

	MatchWin  MatchResult = "win"
	MatchLoss MatchResult = "loss"
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
	// Match-specific fields
	MatchResult     MatchResult `json:"match_result"`     // "win" or "loss" (empty for training)
	MatchScore      string      `json:"match_score"`      // optional score, e.g. "6-3, 7-5"
	OpponentRacquet string      `json:"opponent_racquet"` // optional opponent's racquet info
}
