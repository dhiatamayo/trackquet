package models_test

import (
	"testing"
	"time"

	"trackquet/models"

	"github.com/stretchr/testify/assert"
)

func TestStringRecord_IsActive_True(t *testing.T) {
	sr := models.StringRecord{}
	assert.True(t, sr.IsActive())
}

func TestStringRecord_IsActive_False(t *testing.T) {
	ended := time.Now()
	sr := models.StringRecord{EndedAt: &ended}
	assert.False(t, sr.IsActive())
}

func TestStringRecord_TotalHours(t *testing.T) {
	sr := models.StringRecord{TotalMinutes: 150}
	assert.InDelta(t, 2.5, sr.TotalHours(), 0.001)
}

func TestStringRecord_TotalHours_Zero(t *testing.T) {
	sr := models.StringRecord{TotalMinutes: 0}
	assert.Equal(t, 0.0, sr.TotalHours())
}
