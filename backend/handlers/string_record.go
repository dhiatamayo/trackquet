package handlers

import (
	"net/http"
	"strconv"

	"trackquet/database"
	"trackquet/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// GET /api/racquets/:id/string-records
// Returns all string records for a racquet, each with its sessions, newest first.
func ListStringRecords(c *gin.Context) {
	racquetID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid racquet id"})
		return
	}

	var records []models.StringRecord
	database.DB.
		Preload("Sessions", func(db *gorm.DB) *gorm.DB {
			return db.Order("date DESC")
		}).
		Where("racquet_id = ?", racquetID).
		Order("started_at DESC").
		Find(&records)

	c.JSON(http.StatusOK, records)
}
