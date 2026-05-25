package handlers

import (
	"net/http"
	"strconv"
	"time"

	"trackquet/database"
	"trackquet/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// --- DTOs ---

type CreateRacquetRequest struct {
	Name           string  `json:"name" binding:"required"`
	Brand          string  `json:"brand"`
	Year           int     `json:"year"`
	HeadSize       float64 `json:"head_size"`
	Weight         float64 `json:"weight"`
	StringName     string  `json:"string_name"`
	Gauge          string  `json:"gauge"`
	MainTension    float64 `json:"main_tension"`
	CrossTension   float64 `json:"cross_tension"`
	ThresholdHours int     `json:"threshold_hours"`
}

type UpdateRacquetRequest struct {
	Name           string  `json:"name"`
	Brand          string  `json:"brand"`
	Year           int     `json:"year"`
	HeadSize       float64 `json:"head_size"`
	Weight         float64 `json:"weight"`
	StringName     string  `json:"string_name"`
	Gauge          string  `json:"gauge"`
	MainTension    float64 `json:"main_tension"`
	CrossTension   float64 `json:"cross_tension"`
	ThresholdHours int     `json:"threshold_hours"`
}

type RestringRequest struct {
	StringName     string  `json:"string_name"`
	Gauge          string  `json:"gauge"`
	MainTension    float64 `json:"main_tension"`
	CrossTension   float64 `json:"cross_tension"`
	ThresholdHours int     `json:"threshold_hours"`
}

// gaugeDefaultThreshold returns the recommended restring threshold in hours for a given gauge.
// Thinner gauges (higher number) break/lose tension faster so get a shorter threshold.
func gaugeDefaultThreshold(gauge string) int {
	switch gauge {
	case "15":
		return 25
	case "15L":
		return 22
	case "16":
		return 20
	case "16L":
		return 18
	case "17":
		return 16
	case "17L":
		return 14
	case "18":
		return 12
	}
	return 0 // unknown gauge — caller falls back to default
}

type RacquetResponse struct {
	models.Racquet
	TotalHours         float64 `json:"total_hours"`
	LifetimeHours      float64 `json:"lifetime_hours"`
	NeedsRestring      bool    `json:"needs_restring"`
	RestringSuggestion string  `json:"restring_suggestion"`
	UsagePercent       float64 `json:"usage_percent"`
}

func toRacquetResponse(r models.Racquet) RacquetResponse {
	pct := 0.0
	if r.ThresholdHours > 0 {
		pct = (r.TotalHours() / float64(r.ThresholdHours)) * 100
		if pct > 100 {
			pct = 100
		}
	}
	// Sum all string record periods for lifetime hours.
	// The active record's minutes mirror racquet.TotalMinutes, so we use
	// StringRecords when preloaded, else fall back to current only.
	lifetimeMin := 0
	if len(r.StringRecords) > 0 {
		for _, sr := range r.StringRecords {
			lifetimeMin += sr.TotalMinutes
		}
	} else {
		lifetimeMin = r.TotalMinutes
	}
	return RacquetResponse{
		Racquet:            r,
		TotalHours:         r.TotalHours(),
		LifetimeHours:      float64(lifetimeMin) / 60.0,
		NeedsRestring:      r.NeedsRestring(),
		RestringSuggestion: r.RestringSuggestion(),
		UsagePercent:       pct,
	}
}

// GET /api/racquets
func ListRacquets(c *gin.Context) {
	userID := c.MustGet("userID").(uint)
	var racquets []models.Racquet
	database.DB.Preload("StringRecords").Where("user_id = ?", userID).Find(&racquets)

	resp := make([]RacquetResponse, len(racquets))
	for i, r := range racquets {
		resp[i] = toRacquetResponse(r)
	}
	c.JSON(http.StatusOK, resp)
}

// GET /api/racquets/:id
func GetRacquet(c *gin.Context) {
	userID := c.MustGet("userID").(uint)
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var racquet models.Racquet
	result := database.DB.Preload("Sessions").Preload("StringRecords").Where("id = ? AND user_id = ?", id, userID).First(&racquet)
	if result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "racquet not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		}
		return
	}
	c.JSON(http.StatusOK, toRacquetResponse(racquet))
}

// POST /api/racquets
func CreateRacquet(c *gin.Context) {
	userID := c.MustGet("userID").(uint)
	var req CreateRacquetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	threshold := req.ThresholdHours
	// Auto-fill threshold: gauge takes priority, then string preset, then default
	if threshold == 0 && req.Gauge != "" {
		threshold = gaugeDefaultThreshold(req.Gauge)
	}
	if threshold == 0 && req.StringName != "" {
		var preset models.StringPreset
		if err := database.DB.Where("name = ?", req.StringName).First(&preset).Error; err == nil {
			threshold = preset.ThresholdHours
		}
	}
	if threshold == 0 {
		threshold = 20
	}

	racquet := models.Racquet{
		UserID:         userID,
		Name:           req.Name,
		Brand:          req.Brand,
		Year:           req.Year,
		HeadSize:       req.HeadSize,
		Weight:         req.Weight,
		StringName:     req.StringName,
		Gauge:          req.Gauge,
		MainTension:    req.MainTension,
		CrossTension:   req.CrossTension,
		ThresholdHours: threshold,
	}

	if err := database.DB.Create(&racquet).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Create the initial StringRecord for this racquet
	sr := models.StringRecord{
		RacquetID:      racquet.ID,
		StringName:     req.StringName,
		Gauge:          req.Gauge,
		MainTension:    req.MainTension,
		CrossTension:   req.CrossTension,
		ThresholdHours: threshold,
		StartedAt:      time.Now(),
	}
	database.DB.Create(&sr)

	c.JSON(http.StatusCreated, toRacquetResponse(racquet))
}

// PUT /api/racquets/:id
func UpdateRacquet(c *gin.Context) {
	userID := c.MustGet("userID").(uint)
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var racquet models.Racquet
	if err := database.DB.Where("id = ? AND user_id = ?", id, userID).First(&racquet).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "racquet not found"})
		return
	}

	var req UpdateRacquetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Name != "" {
		racquet.Name = req.Name
	}
	if req.Brand != "" {
		racquet.Brand = req.Brand
	}
	if req.HeadSize > 0 {
		racquet.HeadSize = req.HeadSize
	}
	if req.Weight > 0 {
		racquet.Weight = req.Weight
	}
	if req.Year > 0 {
		racquet.Year = req.Year
	}
	if req.StringName != "" {
		racquet.StringName = req.StringName
	}
	if req.Gauge != "" {
		racquet.Gauge = req.Gauge
	}
	if req.MainTension > 0 {
		racquet.MainTension = req.MainTension
	}
	if req.CrossTension > 0 {
		racquet.CrossTension = req.CrossTension
	}
	if req.ThresholdHours > 0 {
		racquet.ThresholdHours = req.ThresholdHours
	}

	database.DB.Save(&racquet)
	c.JSON(http.StatusOK, toRacquetResponse(racquet))
}

// DELETE /api/racquets/:id
func DeleteRacquet(c *gin.Context) {
	userID := c.MustGet("userID").(uint)
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	result := database.DB.Where("id = ? AND user_id = ?", id, userID).Delete(&models.Racquet{})
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "racquet not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "racquet deleted"})
}

// POST /api/racquets/:id/restring
// Archives the current string record and starts a fresh one with a new string config.
func RestringRacquet(c *gin.Context) {
	userID := c.MustGet("userID").(uint)
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var racquet models.Racquet
	if err := database.DB.Where("id = ? AND user_id = ?", id, userID).First(&racquet).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "racquet not found"})
		return
	}

	var req RestringRequest
	_ = c.ShouldBindJSON(&req) // body is optional

	now := time.Now()

	// Archive the current active StringRecord
	var currentRecord models.StringRecord
	if err := database.DB.Where("racquet_id = ? AND ended_at IS NULL", id).First(&currentRecord).Error; err == nil {
		currentRecord.EndedAt = &now
		currentRecord.TotalMinutes = racquet.TotalMinutes
		database.DB.Save(&currentRecord)
	}

	// Apply new string config (fall back to existing values if not provided)
	newStringName := req.StringName
	if newStringName == "" {
		newStringName = racquet.StringName
	}
	newGauge := req.Gauge
	if newGauge == "" {
		newGauge = racquet.Gauge
	}
	newMainTension := req.MainTension
	if newMainTension == 0 {
		newMainTension = racquet.MainTension
	}
	newCrossTension := req.CrossTension
	if newCrossTension == 0 {
		newCrossTension = racquet.CrossTension
	}
	newThreshold := req.ThresholdHours
	if newThreshold == 0 && newGauge != "" {
		newThreshold = gaugeDefaultThreshold(newGauge)
	}
	if newThreshold == 0 {
		var preset models.StringPreset
		if newStringName != "" {
			if err := database.DB.Where("name = ?", newStringName).First(&preset).Error; err == nil {
				newThreshold = preset.ThresholdHours
			}
		}
		if newThreshold == 0 {
			newThreshold = racquet.ThresholdHours
		}
	}

	// Update racquet with new string config and reset the usage counter
	racquet.StringName = newStringName
	racquet.Gauge = newGauge
	racquet.MainTension = newMainTension
	racquet.CrossTension = newCrossTension
	racquet.ThresholdHours = newThreshold
	racquet.TotalMinutes = 0
	database.DB.Save(&racquet)

	// Create new active StringRecord
	newRecord := models.StringRecord{
		RacquetID:      racquet.ID,
		StringName:     newStringName,
		Gauge:          newGauge,
		MainTension:    newMainTension,
		CrossTension:   newCrossTension,
		ThresholdHours: newThreshold,
		StartedAt:      now,
	}
	database.DB.Create(&newRecord)

	c.JSON(http.StatusOK, toRacquetResponse(racquet))
}

// GET /api/string-presets
func ListStringPresets(c *gin.Context) {
	var presets []models.StringPreset
	database.DB.Find(&presets)
	c.JSON(http.StatusOK, presets)
}
