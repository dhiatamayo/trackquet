package models

import (
	"time"

	"gorm.io/gorm"
)

// Sport types supported by match sessions
type SportType string

const (
	SportTennis SportType = "tennis"
	SportPadel  SportType = "padel"
)

// Matchmaking format determines how players are paired across rounds
type MatchmakingFormat string

const (
	FormatAmericano      MatchmakingFormat = "americano"
	FormatMexicano       MatchmakingFormat = "mexicano"
	FormatTeamAmericano  MatchmakingFormat = "team_americano"
	FormatMixedAmericano MatchmakingFormat = "mixed_americano"
	FormatTeamMexicano   MatchmakingFormat = "team_mexicano"
	FormatSuperMexicano  MatchmakingFormat = "super_mexicano"
)

// Win condition determines how a matchup winner is decided
type WinConditionType string

const (
	WinConditionSets   WinConditionType = "sets"
	WinConditionPoints WinConditionType = "points"
)

// Gender designation for Mixed Americano format
type Gender string

const (
	GenderMale   Gender = "male"
	GenderFemale Gender = "female"
)

// Side indicates which side of a matchup a player is on
type Side string

const (
	SideA Side = "A"
	SideB Side = "B"
)

// MatchSession represents an organized multi-player match event
type MatchSession struct {
	ID                uint              `gorm:"primaryKey" json:"id"`
	CreatedAt         time.Time         `json:"created_at"`
	UpdatedAt         time.Time         `json:"updated_at"`
	DeletedAt         gorm.DeletedAt    `gorm:"index" json:"-"`
	UserID            uint              `gorm:"index;not null" json:"user_id"`
	Name              string            `gorm:"not null" json:"name"`
	Date              time.Time         `gorm:"not null" json:"date"`
	SportType         SportType         `gorm:"not null" json:"sport_type"`
	MatchType         MatchType         `gorm:"not null" json:"match_type"`
	Format            MatchmakingFormat `gorm:"not null" json:"format"`
	WinConditionType  WinConditionType  `gorm:"not null" json:"win_condition_type"`
	WinConditionValue int               `gorm:"not null" json:"win_condition_value"`
	NumCourts         int               `gorm:"not null;default:1" json:"num_courts"`
	FixedPartners     bool              `json:"fixed_partners"`
	StartedAt         *time.Time        `json:"started_at"`
	FinishedAt        *time.Time        `json:"finished_at"`
	Players           []MatchPlayer     `gorm:"foreignKey:MatchSessionID" json:"players,omitempty"`
	Matchups          []Matchup         `gorm:"foreignKey:MatchSessionID" json:"matchups,omitempty"`
}

// MatchPlayer represents a player participating in a match session
type MatchPlayer struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	CreatedAt      time.Time `json:"created_at"`
	MatchSessionID uint      `gorm:"index;not null" json:"match_session_id"`
	Name           string    `gorm:"not null" json:"name"`
	Gender         Gender    `json:"gender"`
	TotalPoints    int       `json:"total_points"`
	PointDiff      int       `json:"point_diff"`
	PairIndex      *int      `json:"pair_index"`
}

// Matchup represents a single game between two sides within a match session
type Matchup struct {
	ID             uint            `gorm:"primaryKey" json:"id"`
	CreatedAt      time.Time       `json:"created_at"`
	MatchSessionID uint            `gorm:"index;not null" json:"match_session_id"`
	Round          int             `gorm:"not null" json:"round"`
	CourtNumber    *int            `json:"court_number"`
	ScoreSideA     *int            `json:"score_side_a"`
	ScoreSideB     *int            `json:"score_side_b"`
	StartedAt      *time.Time      `json:"started_at"`
	FinishedAt     *time.Time      `json:"finished_at"`
	Notes          string          `json:"notes"`
	Players        []MatchupPlayer `gorm:"foreignKey:MatchupID" json:"players,omitempty"`
}

// MatchupPlayer links a player to a matchup with their assigned side
type MatchupPlayer struct {
	ID            uint `gorm:"primaryKey" json:"id"`
	MatchupID     uint `gorm:"index;not null" json:"matchup_id"`
	MatchPlayerID uint `gorm:"index;not null" json:"match_player_id"`
	Side          Side `gorm:"not null" json:"side"`
}
