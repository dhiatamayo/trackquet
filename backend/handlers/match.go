package handlers

import (
	"fmt"
	"math/rand"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"trackquet/database"
	"trackquet/models"
	"trackquet/services"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// --- DTOs ---

// CreateMatchPlayerRequest represents a player entry in the match session creation payload.
type CreateMatchPlayerRequest struct {
	Name      string  `json:"name"`
	Gender    string  `json:"gender"`
	PairIndex *int    `json:"pair_index"`
}

// CreateMatchSessionRequest represents the request body for creating a match session.
type CreateMatchSessionRequest struct {
	Name              string                     `json:"name"`
	Date              string                     `json:"date"`
	SportType         string                     `json:"sport_type"`
	MatchType         string                     `json:"match_type"`
	Format            string                     `json:"format"`
	WinConditionType  string                     `json:"win_condition_type"`
	WinConditionValue int                        `json:"win_condition_value"`
	NumCourts         int                        `json:"num_courts"`
	FixedPartners     bool                       `json:"fixed_partners"`
	Players           []CreateMatchPlayerRequest `json:"players"`
}

// UpdateMatchSessionRequest represents the request body for updating a match session.
type UpdateMatchSessionRequest struct {
	Name              *string `json:"name"`
	Date              *string `json:"date"`
	SportType         *string `json:"sport_type"`
	MatchType         *string `json:"match_type"`
	Format            *string `json:"format"`
	WinConditionType  *string `json:"win_condition_type"`
	WinConditionValue *int    `json:"win_condition_value"`
	FixedPartners     *bool   `json:"fixed_partners"`
}

// --- Validation helpers ---

var validSportTypes = map[string]bool{
	"tennis": true,
	"padel":  true,
}

var validMatchTypes = map[string]bool{
	"singles": true,
	"doubles": true,
}

var validFormats = map[string]bool{
	"americano":       true,
	"mexicano":        true,
	"team_americano":  true,
	"mixed_americano": true,
	"team_mexicano":   true,
	"super_mexicano":  true,
}

var validWinConditionTypes = map[string]bool{
	"sets":   true,
	"points": true,
}

// validateCreateMatchSession validates the create match session request and returns an error message if invalid.
func validateCreateMatchSession(req *CreateMatchSessionRequest) string {
	// Name validation
	if strings.TrimSpace(req.Name) == "" {
		return "name is required"
	}
	if len(req.Name) > 100 {
		return "name must be between 1 and 100 characters"
	}

	// Date validation
	if req.Date == "" {
		return "date is required"
	}
	if _, err := time.Parse(time.RFC3339, req.Date); err != nil {
		return "date must be a valid ISO 8601 timestamp"
	}

	// Sport type validation
	if req.SportType == "" {
		return "sport_type is required"
	}
	if !validSportTypes[req.SportType] {
		return "sport_type must be 'tennis' or 'padel'"
	}

	// Match type validation
	if req.MatchType == "" {
		return "match_type is required"
	}
	if !validMatchTypes[req.MatchType] {
		return "match_type must be 'singles' or 'doubles'"
	}

	// Format validation
	if req.Format == "" {
		return "format is required"
	}
	if !validFormats[req.Format] {
		return "format must be one of: americano, mexicano, team_americano, mixed_americano, team_mexicano, super_mexicano"
	}

	// Win condition type validation
	if req.WinConditionType == "" {
		return "win_condition_type is required"
	}
	if !validWinConditionTypes[req.WinConditionType] {
		return "win_condition_type must be 'sets' or 'points'"
	}

	// Win condition value validation
	if req.WinConditionValue <= 0 {
		return "win_condition_value must be a positive integer"
	}

	// Players validation
	if len(req.Players) == 0 {
		return "players are required"
	}

	// Minimum player count
	if req.MatchType == "singles" && len(req.Players) < 2 {
		return "at least 2 players are required for singles"
	}
	if req.MatchType == "doubles" && len(req.Players) < 4 {
		return "at least 4 players are required for doubles"
	}

	// Maximum player count
	if len(req.Players) > 32 {
		return "maximum 32 players allowed"
	}

	// Even player count required only for team formats or fixed partners
	needsEven := req.FixedPartners ||
		req.Format == "team_americano" ||
		req.Format == "team_mexicano"
	if needsEven && req.MatchType == "doubles" && len(req.Players)%2 != 0 {
		return "an even number of players is required for team/fixed-partner formats"
	}

	// Player name validation and uniqueness
	namesSeen := make(map[string]bool)
	for _, p := range req.Players {
		trimmedName := strings.TrimSpace(p.Name)
		if trimmedName == "" {
			return "player name is required"
		}
		if len(p.Name) > 50 {
			return "player name must be between 1 and 50 characters"
		}
		lowerName := strings.ToLower(trimmedName)
		if namesSeen[lowerName] {
			return fmt.Sprintf("duplicate player name: %s", trimmedName)
		}
		namesSeen[lowerName] = true
	}

	// Gender required for mixed_americano
	if req.Format == "mixed_americano" {
		for _, p := range req.Players {
			if p.Gender != "male" && p.Gender != "female" {
				return "gender is required for all players in mixed_americano format"
			}
		}
	}

	return ""
}

// --- Handlers ---

// POST /api/matches
func CreateMatchSession(c *gin.Context) {
	userID := c.MustGet("userID").(uint)

	var req CreateMatchSessionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	// Validate
	if errMsg := validateCreateMatchSession(&req); errMsg != "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": errMsg})
		return
	}

	// Parse date
	date, _ := time.Parse(time.RFC3339, req.Date)

	// Create MatchSession
	session := models.MatchSession{
		UserID:            userID,
		Name:              req.Name,
		Date:              date,
		SportType:         models.SportType(req.SportType),
		MatchType:         models.MatchType(req.MatchType),
		Format:            models.MatchmakingFormat(req.Format),
		WinConditionType:  models.WinConditionType(req.WinConditionType),
		WinConditionValue: req.WinConditionValue,
		NumCourts:         req.NumCourts,
		FixedPartners:     req.FixedPartners,
	}
	if session.NumCourts < 1 {
		session.NumCourts = 1
	}

	if err := database.DB.Create(&session).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	// Create MatchPlayer records
	players := make([]models.MatchPlayer, len(req.Players))
	for i, p := range req.Players {
		players[i] = models.MatchPlayer{
			MatchSessionID: session.ID,
			Name:           strings.TrimSpace(p.Name),
			Gender:         models.Gender(p.Gender),
			PairIndex:      p.PairIndex,
		}
	}

	if err := database.DB.Create(&players).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	// Generate matchups using the matchmaking service
	mm := services.NewMatchmaking()
	var matchups []models.Matchup

	switch models.MatchmakingFormat(req.Format) {
	case models.FormatAmericano:
		matchups = mm.GenerateAmericanoScheduleWithCourts(players, req.MatchType, session.NumCourts)
	case models.FormatMixedAmericano:
		matchups = mm.GenerateMixedAmericanoSchedule(players)
	case models.FormatTeamAmericano:
		pairs := buildFixedPairs(players)
		matchups = mm.GenerateTeamAmericanoSchedule(pairs)
	default:
		// For Mexicano, Team Mexicano, Super Mexicano: generate Round 1 only
		matchups = mm.GenerateRound1(players, req.MatchType, models.MatchmakingFormat(req.Format))
	}

	// Persist matchups
	if len(matchups) > 0 {
		for i := range matchups {
			matchups[i].MatchSessionID = session.ID
			// Auto-assign court numbers cycling 1..NumCourts within each round
			courtNum := (i % session.NumCourts) + 1
			matchups[i].CourtNumber = &courtNum
		}
		if err := database.DB.Create(&matchups).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
			return
		}
	}

	// Reload session with associations for response
	var fullSession models.MatchSession
	database.DB.
		Preload("Players").
		Preload("Matchups.Players").
		First(&fullSession, session.ID)

	c.JSON(http.StatusCreated, fullSession)
}

// GET /api/matches
func ListMatchSessions(c *gin.Context) {
	userID := c.MustGet("userID").(uint)

	var sessions []models.MatchSession
	database.DB.
		Where("user_id = ?", userID).
		Order("date DESC").
		Limit(50).
		Find(&sessions)

	c.JSON(http.StatusOK, sessions)
}

// GET /api/matches/:id
func GetMatchSession(c *gin.Context) {
	userID := c.MustGet("userID").(uint)
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var session models.MatchSession
	result := database.DB.
		Preload("Players").
		Preload("Matchups.Players").
		Where("id = ? AND user_id = ?", id, userID).
		First(&session)

	if result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "match session not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		}
		return
	}

	c.JSON(http.StatusOK, session)
}

// PUT /api/matches/:id
func UpdateMatchSession(c *gin.Context) {
	userID := c.MustGet("userID").(uint)
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var session models.MatchSession
	result := database.DB.Where("id = ? AND user_id = ?", id, userID).First(&session)
	if result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "match session not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		}
		return
	}

	var req UpdateMatchSessionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	// Apply updates with validation
	if req.Name != nil {
		name := strings.TrimSpace(*req.Name)
		if name == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
			return
		}
		if len(*req.Name) > 100 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "name must be between 1 and 100 characters"})
			return
		}
		session.Name = *req.Name
	}

	if req.Date != nil {
		date, parseErr := time.Parse(time.RFC3339, *req.Date)
		if parseErr != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "date must be a valid ISO 8601 timestamp"})
			return
		}
		session.Date = date
	}

	if req.SportType != nil {
		if !validSportTypes[*req.SportType] {
			c.JSON(http.StatusBadRequest, gin.H{"error": "sport_type must be 'tennis' or 'padel'"})
			return
		}
		session.SportType = models.SportType(*req.SportType)
	}

	if req.MatchType != nil {
		if !validMatchTypes[*req.MatchType] {
			c.JSON(http.StatusBadRequest, gin.H{"error": "match_type must be 'singles' or 'doubles'"})
			return
		}
		session.MatchType = models.MatchType(*req.MatchType)
	}

	if req.Format != nil {
		if !validFormats[*req.Format] {
			c.JSON(http.StatusBadRequest, gin.H{"error": "format must be one of: americano, mexicano, team_americano, mixed_americano, team_mexicano, super_mexicano"})
			return
		}
		session.Format = models.MatchmakingFormat(*req.Format)
	}

	if req.WinConditionType != nil {
		if !validWinConditionTypes[*req.WinConditionType] {
			c.JSON(http.StatusBadRequest, gin.H{"error": "win_condition_type must be 'sets' or 'points'"})
			return
		}
		session.WinConditionType = models.WinConditionType(*req.WinConditionType)
	}

	if req.WinConditionValue != nil {
		if *req.WinConditionValue <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "win_condition_value must be a positive integer"})
			return
		}
		session.WinConditionValue = *req.WinConditionValue
	}

	if req.FixedPartners != nil {
		session.FixedPartners = *req.FixedPartners
	}

	if err := database.DB.Save(&session).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	c.JSON(http.StatusOK, session)
}

// DELETE /api/matches/:id
func DeleteMatchSession(c *gin.Context) {
	userID := c.MustGet("userID").(uint)
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	// Find the session with ownership check
	var session models.MatchSession
	result := database.DB.Where("id = ? AND user_id = ?", id, userID).First(&session)
	if result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "match session not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		}
		return
	}

	// Cascade delete: matchup_players -> matchups -> match_players -> match_session
	// First, get all matchup IDs for this session
	var matchupIDs []uint
	database.DB.Model(&models.Matchup{}).
		Where("match_session_id = ?", session.ID).
		Pluck("id", &matchupIDs)

	// Delete matchup_players for all matchups in this session
	if len(matchupIDs) > 0 {
		database.DB.Where("matchup_id IN ?", matchupIDs).Delete(&models.MatchupPlayer{})
	}

	// Delete matchups
	database.DB.Where("match_session_id = ?", session.ID).Delete(&models.Matchup{})

	// Delete match players
	database.DB.Where("match_session_id = ?", session.ID).Delete(&models.MatchPlayer{})

	// Delete the session itself
	database.DB.Delete(&session)

	c.JSON(http.StatusOK, gin.H{"message": "match session deleted"})
}

// AddPlayerRequest represents the request body for adding a player to an existing session.
type AddPlayerRequest struct {
	Name   string `json:"name"`
	Gender string `json:"gender"`
}

// POST /api/matches/:id/players
func AddPlayer(c *gin.Context) {
	userID := c.MustGet("userID").(uint)
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var session models.MatchSession
	result := database.DB.Where("id = ? AND user_id = ?", id, userID).First(&session)
	if result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "match session not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		}
		return
	}

	var req AddPlayerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	trimmedName := strings.TrimSpace(req.Name)
	if trimmedName == "" || len(trimmedName) > 50 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "player name must be between 1 and 50 characters"})
		return
	}

	// Check for duplicate name
	var existingCount int64
	database.DB.Model(&models.MatchPlayer{}).
		Where("match_session_id = ? AND LOWER(name) = LOWER(?)", session.ID, trimmedName).
		Count(&existingCount)
	if existingCount > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("duplicate player name: %s", trimmedName)})
		return
	}

	// Create the new player
	newPlayer := models.MatchPlayer{
		MatchSessionID: session.ID,
		Name:           trimmedName,
		Gender:         models.Gender(req.Gender),
	}
	if err := database.DB.Create(&newPlayer).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	// Generate new matchups for the new player against all existing players
	var existingPlayers []models.MatchPlayer
	database.DB.Where("match_session_id = ? AND id != ?", session.ID, newPlayer.ID).Find(&existingPlayers)

	mm := services.NewMatchmaking()
	var newMatchups []models.Matchup

	if string(session.MatchType) == "singles" {
		// Singles: new player plays against every existing player
		var pairings [][2]uint
		for _, ep := range existingPlayers {
			pairings = append(pairings, [2]uint{newPlayer.ID, ep.ID})
		}
		rand.Shuffle(len(pairings), func(i, j int) {
			pairings[i], pairings[j] = pairings[j], pairings[i]
		})
		for _, p := range pairings {
			newMatchups = append(newMatchups, models.Matchup{
				MatchSessionID: session.ID,
				Players: []models.MatchupPlayer{
					{MatchPlayerID: p[0], Side: models.SideA},
					{MatchPlayerID: p[1], Side: models.SideB},
				},
			})
		}
	} else {
		// Doubles: generate matchups where the new player partners with each existing player
		// against other pairs (simplified: just generate new pairings involving the new player)
		var pairings [][2]uint
		for _, ep := range existingPlayers {
			pairings = append(pairings, [2]uint{newPlayer.ID, ep.ID})
		}
		rand.Shuffle(len(pairings), func(i, j int) {
			pairings[i], pairings[j] = pairings[j], pairings[i]
		})
		// Pair up partnerships into 2v2 matchups
		for i := 0; i+1 < len(pairings); i += 2 {
			// Check no overlap (new player can't be on both sides)
			a := pairings[i]
			b := pairings[i+1]
			if a[0] == b[0] || a[0] == b[1] || a[1] == b[0] || a[1] == b[1] {
				continue
			}
			newMatchups = append(newMatchups, models.Matchup{
				MatchSessionID: session.ID,
				Players: []models.MatchupPlayer{
					{MatchPlayerID: a[0], Side: models.SideA},
					{MatchPlayerID: a[1], Side: models.SideA},
					{MatchPlayerID: b[0], Side: models.SideB},
					{MatchPlayerID: b[1], Side: models.SideB},
				},
			})
		}
	}

	// Get the highest existing round
	var maxRound int
	database.DB.Model(&models.Matchup{}).
		Where("match_session_id = ?", session.ID).
		Select("COALESCE(MAX(round), 0)").
		Scan(&maxRound)

	// Get unplayed matchups (no score) and combine with new matchups, then redistribute
	var unplayedMatchups []models.Matchup
	database.DB.Preload("Players").
		Where("match_session_id = ? AND score_side_a IS NULL AND score_side_b IS NULL", session.ID).
		Find(&unplayedMatchups)

	// Remove unplayed matchups from DB (we'll reassign them)
	var unplayedIDs []uint
	for _, um := range unplayedMatchups {
		unplayedIDs = append(unplayedIDs, um.ID)
	}
	if len(unplayedIDs) > 0 {
		database.DB.Where("matchup_id IN ?", unplayedIDs).Delete(&models.MatchupPlayer{})
		database.DB.Where("id IN ?", unplayedIDs).Delete(&models.Matchup{})
	}

	// Combine unplayed + new matchups and redistribute into rounds
	allPending := append(unplayedMatchups, newMatchups...)
	rand.Shuffle(len(allPending), func(i, j int) {
		allPending[i], allPending[j] = allPending[j], allPending[i]
	})

	// Get the last completed round number
	var lastCompletedRound int
	database.DB.Model(&models.Matchup{}).
		Where("match_session_id = ? AND score_side_a IS NOT NULL AND score_side_b IS NOT NULL", session.ID).
		Select("COALESCE(MAX(round), 0)").
		Scan(&lastCompletedRound)

	// Redistribute pending matchups starting from round after the last completed
	startRound := lastCompletedRound + 1
	numCourts := session.NumCourts
	if numCourts < 1 {
		numCourts = 1
	}

	redistributed := mm.RedistributeMatchups(allPending, numCourts, startRound)

	// Persist the redistributed matchups
	if len(redistributed) > 0 {
		for i := range redistributed {
			redistributed[i].MatchSessionID = session.ID
			// Auto-assign court numbers
			courtIdx := 0
			for j := 0; j < i; j++ {
				if redistributed[j].Round == redistributed[i].Round {
					courtIdx++
				}
			}
			courtNum := (courtIdx % numCourts) + 1
			redistributed[i].CourtNumber = &courtNum
		}
		if err := database.DB.Create(&redistributed).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
			return
		}
	}

	// Return updated session
	var fullSession models.MatchSession
	database.DB.Preload("Players").Preload("Matchups.Players").First(&fullSession, session.ID)
	c.JSON(http.StatusOK, fullSession)
}

// POST /api/matches/:id/start
func StartMatchSession(c *gin.Context) {
	userID := c.MustGet("userID").(uint)
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var session models.MatchSession
	result := database.DB.Where("id = ? AND user_id = ?", id, userID).First(&session)
	if result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "match session not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		}
		return
	}

	if session.StartedAt != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "session already started"})
		return
	}

	now := time.Now()
	session.StartedAt = &now
	if err := database.DB.Save(&session).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	// Reload with players and matchups for the response
	database.DB.Preload("Players").Preload("Matchups.Players").Where("id = ?", session.ID).First(&session)

	c.JSON(http.StatusOK, session)
}

// POST /api/matches/:id/finish
func FinishMatchSession(c *gin.Context) {
	userID := c.MustGet("userID").(uint)
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var session models.MatchSession
	result := database.DB.Where("id = ? AND user_id = ?", id, userID).First(&session)
	if result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "match session not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		}
		return
	}

	if session.FinishedAt != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "session already finished"})
		return
	}

	now := time.Now()
	session.FinishedAt = &now
	if err := database.DB.Save(&session).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	// Reload with players and matchups for the response
	database.DB.Preload("Players").Preload("Matchups.Players").Where("id = ?", session.ID).First(&session)

	c.JSON(http.StatusOK, session)
}

// GET /api/matches/:id/leaderboard
func GetLeaderboard(c *gin.Context) {
	userID := c.MustGet("userID").(uint)
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	// Verify session exists and belongs to the authenticated user
	var session models.MatchSession
	result := database.DB.Where("id = ? AND user_id = ?", id, userID).First(&session)
	if result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "match session not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		}
		return
	}

	// Load all players for the session
	var players []models.MatchPlayer
	database.DB.Where("match_session_id = ?", session.ID).Find(&players)

	// Load all matchups with their MatchupPlayers
	var matchups []models.Matchup
	database.DB.Preload("Players").Where("match_session_id = ?", session.ID).Find(&matchups)

	// Calculate leaderboard
	leaderboard := services.CalculateLeaderboard(players, matchups)

	c.JSON(http.StatusOK, leaderboard)
}

// --- Matchup Handlers ---

// UpdateMatchupRequest represents the request body for updating a matchup.
type UpdateMatchupRequest struct {
	ScoreSideA  *int    `json:"score_side_a"`
	ScoreSideB  *int    `json:"score_side_b"`
	CourtNumber *int    `json:"court_number"`
	Notes       *string `json:"notes"`
}

// GET /api/matches/:id/matchups
func ListMatchups(c *gin.Context) {
	userID := c.MustGet("userID").(uint)
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	// Verify session belongs to user
	var session models.MatchSession
	result := database.DB.Where("id = ? AND user_id = ?", id, userID).First(&session)
	if result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "match session not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		}
		return
	}

	var matchups []models.Matchup
	database.DB.
		Preload("Players").
		Where("match_session_id = ?", session.ID).
		Order("round ASC, id ASC").
		Find(&matchups)

	c.JSON(http.StatusOK, matchups)
}

// GET /api/matches/:id/matchups/:matchupId
func GetMatchup(c *gin.Context) {
	userID := c.MustGet("userID").(uint)
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	matchupID, err := strconv.Atoi(c.Param("matchupId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid matchup id"})
		return
	}

	// Verify session belongs to user
	var session models.MatchSession
	result := database.DB.Where("id = ? AND user_id = ?", id, userID).First(&session)
	if result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "match session not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		}
		return
	}

	// Find matchup belonging to this session
	var matchup models.Matchup
	result = database.DB.
		Preload("Players").
		Where("id = ? AND match_session_id = ?", matchupID, session.ID).
		First(&matchup)
	if result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "matchup not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		}
		return
	}

	c.JSON(http.StatusOK, matchup)
}

// PUT /api/matches/:id/matchups/:matchupId
func UpdateMatchup(c *gin.Context) {
	userID := c.MustGet("userID").(uint)
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	matchupID, err := strconv.Atoi(c.Param("matchupId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid matchup id"})
		return
	}

	// Verify session belongs to user
	var session models.MatchSession
	result := database.DB.Where("id = ? AND user_id = ?", id, userID).First(&session)
	if result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "match session not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		}
		return
	}

	// Find matchup belonging to this session
	var matchup models.Matchup
	result = database.DB.
		Preload("Players").
		Where("id = ? AND match_session_id = ?", matchupID, session.ID).
		First(&matchup)
	if result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "matchup not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		}
		return
	}

	var req UpdateMatchupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	// Apply court number update
	if req.CourtNumber != nil {
		matchup.CourtNumber = req.CourtNumber
	}

	// Apply notes update
	if req.Notes != nil {
		matchup.Notes = *req.Notes
	}

	// Validate and apply score if provided
	if req.ScoreSideA != nil && req.ScoreSideB != nil {
		scoreA := *req.ScoreSideA
		scoreB := *req.ScoreSideB

		if errMsg := validateScore(scoreA, scoreB, session.WinConditionType, session.WinConditionValue); errMsg != "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": errMsg})
			return
		}

		matchup.ScoreSideA = req.ScoreSideA
		matchup.ScoreSideB = req.ScoreSideB
	} else if req.ScoreSideA != nil || req.ScoreSideB != nil {
		// If only one score is provided, reject
		c.JSON(http.StatusBadRequest, gin.H{"error": "both score_side_a and score_side_b must be provided together"})
		return
	}

	// Save the matchup
	if err := database.DB.Save(&matchup).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	// If scores were provided, recalculate player stats and check round completion
	if req.ScoreSideA != nil && req.ScoreSideB != nil {
		if err := recalculatePlayerStats(session.ID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
			return
		}

		// Check if all matchups in the current round are complete and trigger next round if applicable
		if err := checkRoundCompletionAndGenerateNext(session, matchup.Round); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
			return
		}
	}

	// Reload matchup with players for response
	database.DB.Preload("Players").First(&matchup, matchup.ID)

	c.JSON(http.StatusOK, matchup)
}

// POST /api/matches/:id/matchups/:matchupId/start
func StartMatchup(c *gin.Context) {
	userID := c.MustGet("userID").(uint)
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	matchupID, err := strconv.Atoi(c.Param("matchupId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid matchup id"})
		return
	}

	var session models.MatchSession
	result := database.DB.Where("id = ? AND user_id = ?", id, userID).First(&session)
	if result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "match session not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		}
		return
	}

	var matchup models.Matchup
	result = database.DB.Preload("Players").Where("id = ? AND match_session_id = ?", matchupID, session.ID).First(&matchup)
	if result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "matchup not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		}
		return
	}

	if matchup.StartedAt != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "matchup already started"})
		return
	}

	now := time.Now()
	matchup.StartedAt = &now
	database.DB.Save(&matchup)

	c.JSON(http.StatusOK, matchup)
}

// POST /api/matches/:id/matchups/:matchupId/finish
func FinishMatchup(c *gin.Context) {
	userID := c.MustGet("userID").(uint)
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	matchupID, err := strconv.Atoi(c.Param("matchupId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid matchup id"})
		return
	}

	var session models.MatchSession
	result := database.DB.Where("id = ? AND user_id = ?", id, userID).First(&session)
	if result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "match session not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		}
		return
	}

	var matchup models.Matchup
	result = database.DB.Preload("Players").Where("id = ? AND match_session_id = ?", matchupID, session.ID).First(&matchup)
	if result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "matchup not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		}
		return
	}

	if matchup.FinishedAt != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "matchup already finished"})
		return
	}

	now := time.Now()
	matchup.FinishedAt = &now
	database.DB.Save(&matchup)

	c.JSON(http.StatusOK, matchup)
}

// validateScore validates scores against the session's win condition.
func validateScore(scoreA, scoreB int, winType models.WinConditionType, winValue int) string {
	// Both scores must be non-negative integers
	if scoreA < 0 || scoreB < 0 {
		return "scores must be non-negative integers"
	}

	// At least one side must equal the target value (one side must have "won")
	if scoreA != winValue && scoreB != winValue {
		return fmt.Sprintf("score does not conform to win condition: one side must equal %d", winValue)
	}

	// The losing side must be strictly less than the target
	if scoreA == winValue && scoreB >= winValue {
		return fmt.Sprintf("score does not conform to win condition: losing side must be less than %d", winValue)
	}
	if scoreB == winValue && scoreA >= winValue {
		return fmt.Sprintf("score does not conform to win condition: losing side must be less than %d", winValue)
	}

	return ""
}

// recalculatePlayerStats recalculates cumulative points and point_diff for all players in a session.
func recalculatePlayerStats(sessionID uint) error {
	// Get all players for this session
	var players []models.MatchPlayer
	if err := database.DB.Where("match_session_id = ?", sessionID).Find(&players).Error; err != nil {
		return err
	}

	// Get all matchups for this session with their players
	var matchups []models.Matchup
	if err := database.DB.
		Preload("Players").
		Where("match_session_id = ?", sessionID).
		Find(&matchups).Error; err != nil {
		return err
	}

	// Use the leaderboard calculator to get correct totals
	entries := services.CalculateLeaderboard(players, matchups)

	// Build a map of playerID -> leaderboard entry for quick lookup
	entryMap := make(map[uint]*services.LeaderboardEntry, len(entries))
	for i := range entries {
		entryMap[entries[i].PlayerID] = &entries[i]
	}

	// Update each player's stats in the database
	for _, player := range players {
		totalPoints := 0
		pointDiff := 0
		if entry, ok := entryMap[player.ID]; ok {
			totalPoints = entry.TotalPoints
			pointDiff = entry.PointDiff
		}
		if err := database.DB.Model(&models.MatchPlayer{}).
			Where("id = ?", player.ID).
			Updates(map[string]interface{}{
				"total_points": totalPoints,
				"point_diff":   pointDiff,
			}).Error; err != nil {
			return err
		}
	}

	return nil
}

// checkRoundCompletionAndGenerateNext checks if all matchups in a round are completed,
// and if the format is standings-based, generates the next round.
func checkRoundCompletionAndGenerateNext(session models.MatchSession, round int) error {
	// Only generate next round for standings-based formats
	format := session.Format
	if format != models.FormatMexicano && format != models.FormatTeamMexicano && format != models.FormatSuperMexicano {
		return nil
	}

	// Check if all matchups in this round are completed
	var totalInRound int64
	database.DB.Model(&models.Matchup{}).
		Where("match_session_id = ? AND round = ?", session.ID, round).
		Count(&totalInRound)

	var completedInRound int64
	database.DB.Model(&models.Matchup{}).
		Where("match_session_id = ? AND round = ? AND score_side_a IS NOT NULL AND score_side_b IS NOT NULL", session.ID, round).
		Count(&completedInRound)

	if totalInRound == 0 || completedInRound < totalInRound {
		return nil // Not all matchups in this round are done
	}

	// Check if next round already exists (avoid duplicate generation)
	var nextRoundCount int64
	database.DB.Model(&models.Matchup{}).
		Where("match_session_id = ? AND round = ?", session.ID, round+1).
		Count(&nextRoundCount)

	if nextRoundCount > 0 {
		return nil // Next round already generated
	}

	// Get all players and matchups for leaderboard calculation
	var players []models.MatchPlayer
	if err := database.DB.Where("match_session_id = ?", session.ID).Find(&players).Error; err != nil {
		return err
	}

	var allMatchups []models.Matchup
	if err := database.DB.
		Preload("Players").
		Where("match_session_id = ?", session.ID).
		Find(&allMatchups).Error; err != nil {
		return err
	}

	// Calculate current leaderboard
	standings := services.CalculateLeaderboard(players, allMatchups)

	// Generate next round matchups based on format
	svc := services.NewMatchmaking()
	var newMatchups []models.Matchup

	switch format {
	case models.FormatMexicano:
		newMatchups = svc.GenerateMexicanoRound(standings, string(session.MatchType))
	case models.FormatSuperMexicano:
		newMatchups = svc.GenerateSuperMexicanoRound(standings)
	case models.FormatTeamMexicano:
		pairStandings := buildPairStandingsFromPlayers(players, standings)
		newMatchups = svc.GenerateTeamMexicanoRound(pairStandings)
	}

	if len(newMatchups) == 0 {
		return nil
	}

	// Set round number, session ID, and auto-assign court numbers
	nextRound := round + 1
	for i := range newMatchups {
		newMatchups[i].MatchSessionID = session.ID
		newMatchups[i].Round = nextRound
		courtNum := (i % session.NumCourts) + 1
		if session.NumCourts > 0 {
			newMatchups[i].CourtNumber = &courtNum
		}
	}

	// Persist new matchups
	if err := database.DB.Create(&newMatchups).Error; err != nil {
		return err
	}

	return nil
}

// buildPairStandingsFromPlayers constructs PairStanding entries from players and their leaderboard data.
func buildPairStandingsFromPlayers(players []models.MatchPlayer, standings []services.LeaderboardEntry) []services.PairStanding {
	// Build a map of playerID -> leaderboard entry
	entryMap := make(map[uint]*services.LeaderboardEntry, len(standings))
	for i := range standings {
		entryMap[standings[i].PlayerID] = &standings[i]
	}

	// Group players by pair index
	pairMap := make(map[int][]models.MatchPlayer)
	for _, p := range players {
		idx := 0
		if p.PairIndex != nil {
			idx = *p.PairIndex
		}
		pairMap[idx] = append(pairMap[idx], p)
	}

	// Build PairStandings
	var pairStandings []services.PairStanding
	for pairIdx, pair := range pairMap {
		if len(pair) != 2 {
			continue
		}
		totalPoints := 0
		for _, p := range pair {
			if entry, ok := entryMap[p.ID]; ok {
				totalPoints += entry.TotalPoints
			}
		}
		pairStandings = append(pairStandings, services.PairStanding{
			Players:     [2]models.MatchPlayer{pair[0], pair[1]},
			TotalPoints: totalPoints,
			PairIndex:   pairIdx,
		})
	}

	// Sort by total points descending
	sort.Slice(pairStandings, func(i, j int) bool {
		return pairStandings[i].TotalPoints > pairStandings[j].TotalPoints
	})

	return pairStandings
}

// --- Helper functions ---

// buildFixedPairs groups players by their PairIndex into pairs for Team formats.
func buildFixedPairs(players []models.MatchPlayer) [][]models.MatchPlayer {
	pairMap := make(map[int][]models.MatchPlayer)
	for _, p := range players {
		idx := 0
		if p.PairIndex != nil {
			idx = *p.PairIndex
		}
		pairMap[idx] = append(pairMap[idx], p)
	}

	var pairs [][]models.MatchPlayer
	for _, pair := range pairMap {
		if len(pair) == 2 {
			pairs = append(pairs, pair)
		}
	}
	return pairs
}

