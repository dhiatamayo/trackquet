package models_test

import (
	"testing"

	"trackquet/models"

	"github.com/stretchr/testify/assert"
)

func TestTotalHours(t *testing.T) {
	r := models.Racquet{TotalMinutes: 90}
	assert.InDelta(t, 1.5, r.TotalHours(), 0.001)
}

func TestTotalHoursZero(t *testing.T) {
	r := models.Racquet{TotalMinutes: 0}
	assert.Equal(t, 0.0, r.TotalHours())
}

func TestNeedsRestring_BelowThreshold(t *testing.T) {
	r := models.Racquet{TotalMinutes: 600, ThresholdHours: 20} // 10h < 20h
	assert.False(t, r.NeedsRestring())
}

func TestNeedsRestring_AtThreshold(t *testing.T) {
	r := models.Racquet{TotalMinutes: 1200, ThresholdHours: 20} // exactly 20h
	assert.True(t, r.NeedsRestring())
}

func TestNeedsRestring_AboveThreshold(t *testing.T) {
	r := models.Racquet{TotalMinutes: 1500, ThresholdHours: 20} // 25h > 20h
	assert.True(t, r.NeedsRestring())
}

func TestNeedsRestring_NoThreshold(t *testing.T) {
	r := models.Racquet{TotalMinutes: 9999, ThresholdHours: 0}
	assert.False(t, r.NeedsRestring())
}

func TestRestringSuggestion_Good(t *testing.T) {
	r := models.Racquet{TotalMinutes: 0, ThresholdHours: 20}
	assert.Contains(t, r.RestringSuggestion(), "good shape")
}

func TestRestringSuggestion_Close(t *testing.T) {
	// 90% used — within last 15%
	r := models.Racquet{TotalMinutes: int(0.9 * 20 * 60), ThresholdHours: 20}
	assert.Contains(t, r.RestringSuggestion(), "consider restringing")
}

func TestRestringSuggestion_Overdue(t *testing.T) {
	r := models.Racquet{TotalMinutes: 9999, ThresholdHours: 20}
	assert.Contains(t, r.RestringSuggestion(), "restring")
}

func TestRestringSuggestion_NoThreshold(t *testing.T) {
	r := models.Racquet{TotalMinutes: 0, ThresholdHours: 0}
	assert.Contains(t, r.RestringSuggestion(), "No restring threshold")
}
