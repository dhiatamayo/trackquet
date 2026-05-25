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

type CreateSessionRequest struct {
	Date           string             `json:"date" binding:"required"` // RFC3339 or YYYY-MM-DD
	DurationMin    int                `json:"duration_min" binding:"required,min=1"`
	Type           models.SessionType `json:"type" binding:"required"`
	Name           string             `json:"name"`
	Notes          string             `json:"notes"`
	StringRecordID uint               `json:"string_record_id"` // optional: override which string record to attach
}

// GET /api/racquets/:id/sessions
func ListSessions(c *gin.Context) {
	racquetID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid racquet id"})
		return
	}

	var sessions []models.Session
	database.DB.Where("racquet_id = ?", racquetID).Order("date desc").Find(&sessions)
	c.JSON(http.StatusOK, sessions)
}

// POST /api/racquets/:id/sessions
func CreateSession(c *gin.Context) {
	racquetID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid racquet id"})
		return
	}

	var racquet models.Racquet
	if err := database.DB.First(&racquet, racquetID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "racquet not found"})
		return
	}

	var req CreateSessionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	sessionDate, err := time.Parse(time.RFC3339, req.Date)
	if err != nil {
		// Try date-only format
		sessionDate, err = time.Parse("2006-01-02", req.Date)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid date format, use RFC3339 or YYYY-MM-DD"})
			return
		}
	}

	session := models.Session{
		RacquetID:   uint(racquetID),
		Date:        sessionDate,
		DurationMin: req.DurationMin,
		Type:        req.Type,
		Name:        req.Name,
		Notes:       req.Notes,
	}

	if req.StringRecordID > 0 {
		// Caller specified a string record — validate it belongs to this racquet
		// and that the session date falls within its active period.
		var targetRecord models.StringRecord
		if err := database.DB.Where("id = ? AND racquet_id = ?", req.StringRecordID, racquetID).First(&targetRecord).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "string record not found for this racquet"})
			return
		}
		session.StringRecordID = targetRecord.ID
		// Only validate upper bound: session can't be after the string was retired
		if targetRecord.EndedAt != nil && sessionDate.After(targetRecord.EndedAt.Truncate(24*time.Hour)) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "session date is after this string configuration was retired"})
			return
		}
	} else {
		// Attach to the currently active StringRecord
		var activeRecord models.StringRecord
		if err := database.DB.Where("racquet_id = ? AND ended_at IS NULL", racquetID).First(&activeRecord).Error; err == nil {
			session.StringRecordID = activeRecord.ID
		}
	}

	if err := database.DB.Create(&session).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Only update racquet's current TotalMinutes when the session belongs to the active record
	var activeCheck models.StringRecord
	isActive := database.DB.Where("id = ? AND ended_at IS NULL", session.StringRecordID).First(&activeCheck).Error == nil
	if isActive {
		racquet.TotalMinutes += req.DurationMin
		database.DB.Save(&racquet)
	}

	// Update the StringRecord's running total regardless
	if session.StringRecordID > 0 {
		database.DB.Model(&models.StringRecord{}).Where("id = ?", session.StringRecordID).
			Update("total_minutes", gorm.Expr("total_minutes + ?", req.DurationMin))
	}

	c.JSON(http.StatusCreated, session)
}

// DELETE /api/racquets/:id/sessions/:sessionID
func DeleteSession(c *gin.Context) {
	racquetID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid racquet id"})
		return
	}

	sessionID, err := strconv.Atoi(c.Param("sessionID"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid session id"})
		return
	}

	var session models.Session
	if err := database.DB.Where("id = ? AND racquet_id = ?", sessionID, racquetID).First(&session).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "session not found"})
		return
	}

	// Subtract minutes from racquet
	var racquet models.Racquet
	if err := database.DB.First(&racquet, racquetID).Error; err == nil {
		racquet.TotalMinutes -= session.DurationMin
		if racquet.TotalMinutes < 0 {
			racquet.TotalMinutes = 0
		}
		database.DB.Save(&racquet)
	}

	// Subtract from StringRecord if linked
	if session.StringRecordID > 0 {
		database.DB.Model(&models.StringRecord{}).Where("id = ?", session.StringRecordID).
			Update("total_minutes", gorm.Expr("MAX(0, total_minutes - ?)", session.DurationMin))
	}

	database.DB.Delete(&session)
	c.JSON(http.StatusOK, gin.H{"message": "session deleted"})
}
