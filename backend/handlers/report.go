package handlers

import (
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"time"

	"trackquet/database"
	"trackquet/models"

	"github.com/gin-gonic/gin"
)

// --- Response types ---

type RacquetUsageStat struct {
	RacquetID   uint   `json:"racquet_id"`
	RacquetName string `json:"racquet_name"`
	Sessions    int    `json:"sessions"`
	TotalMin    int    `json:"total_min"`
	Wins        int    `json:"wins"`
	Losses      int    `json:"losses"`
}

type NotableSession struct {
	SessionID       uint   `json:"session_id"`
	RacquetName     string `json:"racquet_name"`
	Date            string `json:"date"`
	Name            string `json:"name"`
	DurationMin     int    `json:"duration_min"`
	Type            string `json:"type"`
	MatchResult     string `json:"match_result"`
	MatchScore      string `json:"match_score"`
	OpponentRacquet string `json:"opponent_racquet"`
	NotableTag      string `json:"notable_tag"` // e.g. "Biggest Win", "Hardest Loss", "Longest Session"
}

type MonthlyReportResponse struct {
	Month            string             `json:"month"` // e.g. "June 2026"
	Year             int                `json:"year"`
	MonthNum         int                `json:"month_num"`
	TotalSessions    int                `json:"total_sessions"`
	TotalMinutes     int                `json:"total_minutes"`
	AvgMinPerSession float64            `json:"avg_min_per_session"`
	WinRate          float64            `json:"win_rate"` // percentage 0-100
	TotalWins        int                `json:"total_wins"`
	TotalMatches     int                `json:"total_matches"`
	RacquetUsage     []RacquetUsageStat `json:"racquet_usage"`
	NotableResults   []NotableSession   `json:"notable_results"`
}

// GET /api/reports/monthly?year=2026&month=6
func GetMonthlyReport(c *gin.Context) {
	userID := c.MustGet("userID").(uint)

	// Parse year / month query params; default to current month
	now := time.Now()
	yearStr := c.DefaultQuery("year", strconv.Itoa(now.Year()))
	monthStr := c.DefaultQuery("month", strconv.Itoa(int(now.Month())))

	year, err := strconv.Atoi(yearStr)
	if err != nil || year < 2000 || year > 2100 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid year"})
		return
	}
	monthInt, err := strconv.Atoi(monthStr)
	if err != nil || monthInt < 1 || monthInt > 12 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid month"})
		return
	}
	month := time.Month(monthInt)

	// Date range [start, end)
	start := time.Date(year, month, 1, 0, 0, 0, 0, time.UTC)
	end := start.AddDate(0, 1, 0)

	// Fetch all racquets belonging to this user (for ownership + name lookup)
	var racquets []models.Racquet
	database.DB.Where("user_id = ?", userID).Find(&racquets)

	racquetMap := make(map[uint]string) // id -> name
	racquetIDs := make([]uint, 0, len(racquets))
	for _, rq := range racquets {
		racquetMap[rq.ID] = rq.Name
		racquetIDs = append(racquetIDs, rq.ID)
	}

	if len(racquetIDs) == 0 {
		c.JSON(http.StatusOK, emptyReport(year, monthInt))
		return
	}

	// Fetch all sessions for user's racquets in the month
	var sessions []models.Session
	database.DB.
		Where("racquet_id IN ? AND date >= ? AND date < ?", racquetIDs, start, end).
		Order("date asc").
		Find(&sessions)

	if len(sessions) == 0 {
		c.JSON(http.StatusOK, emptyReport(year, monthInt))
		return
	}

	// --- Aggregate stats ---
	totalMin := 0
	totalWins := 0
	totalMatches := 0
	usageMap := make(map[uint]*RacquetUsageStat)

	for _, s := range sessions {
		totalMin += s.DurationMin

		stat, ok := usageMap[s.RacquetID]
		if !ok {
			stat = &RacquetUsageStat{
				RacquetID:   s.RacquetID,
				RacquetName: racquetMap[s.RacquetID],
			}
			usageMap[s.RacquetID] = stat
		}
		stat.Sessions++
		stat.TotalMin += s.DurationMin
		if s.Type == models.SessionMatch {
			totalMatches++
			if s.MatchResult == models.MatchWin {
				totalWins++
				stat.Wins++
			} else if s.MatchResult == models.MatchLoss {
				stat.Losses++
			}
		}
	}

	// Sort racquet usage by session count desc
	usage := make([]RacquetUsageStat, 0, len(usageMap))
	for _, v := range usageMap {
		usage = append(usage, *v)
	}
	sort.Slice(usage, func(i, j int) bool {
		if usage[i].Sessions != usage[j].Sessions {
			return usage[i].Sessions > usage[j].Sessions
		}
		return usage[i].TotalMin > usage[j].TotalMin
	})

	// --- Notable results (up to 5) ---
	notable := buildNotableResults(sessions, racquetMap)

	// --- Assemble response ---
	totalSessions := len(sessions)
	avgMin := 0.0
	if totalSessions > 0 {
		avgMin = float64(totalMin) / float64(totalSessions)
	}
	winRate := 0.0
	if totalMatches > 0 {
		winRate = float64(totalWins) / float64(totalMatches) * 100.0
	}

	c.JSON(http.StatusOK, MonthlyReportResponse{
		Month:            fmt.Sprintf("%s %d", month.String(), year),
		Year:             year,
		MonthNum:         monthInt,
		TotalSessions:    totalSessions,
		TotalMinutes:     totalMin,
		AvgMinPerSession: roundTo1(avgMin),
		WinRate:          roundTo1(winRate),
		TotalWins:        totalWins,
		TotalMatches:     totalMatches,
		RacquetUsage:     usage,
		NotableResults:   notable,
	})
}

// buildNotableResults returns up to 6 milestones: top wins (by duration), top losses (by duration),
// longest match session, longest training session. Avoids duplicates.
func buildNotableResults(sessions []models.Session, racquetMap map[uint]string) []NotableSession {
	var wins, losses, matches, trainings []models.Session
	for _, s := range sessions {
		cp := s
		if s.Type == models.SessionMatch {
			matches = append(matches, cp)
			if s.MatchResult == models.MatchWin {
				wins = append(wins, cp)
			} else if s.MatchResult == models.MatchLoss {
				losses = append(losses, cp)
			}
		} else {
			trainings = append(trainings, cp)
		}
	}

	byDurationDesc := func(a, b models.Session) int {
		return b.DurationMin - a.DurationMin
	}
	sort.Slice(wins, func(i, j int) bool { return byDurationDesc(wins[i], wins[j]) < 0 })
	sort.Slice(losses, func(i, j int) bool { return byDurationDesc(losses[i], losses[j]) < 0 })
	sort.Slice(matches, func(i, j int) bool { return byDurationDesc(matches[i], matches[j]) < 0 })
	sort.Slice(trainings, func(i, j int) bool { return byDurationDesc(trainings[i], trainings[j]) < 0 })

	seen := make(map[uint]bool)
	var result []NotableSession

	addSession := func(s models.Session, tag string) {
		if seen[s.ID] || len(result) >= 6 {
			return
		}
		seen[s.ID] = true
		result = append(result, NotableSession{
			SessionID:       s.ID,
			RacquetName:     racquetMap[s.RacquetID],
			Date:            s.Date.Format("2006-01-02"),
			Name:            s.Name,
			DurationMin:     s.DurationMin,
			Type:            string(s.Type),
			MatchResult:     string(s.MatchResult),
			MatchScore:      s.MatchScore,
			OpponentRacquet: s.OpponentRacquet,
			NotableTag:      tag,
		})
	}

	// Up to 2 biggest wins
	for i := 0; i < 2 && i < len(wins); i++ {
		tag := "Biggest Win"
		if i == 1 {
			tag = "Notable Win"
		}
		addSession(wins[i], tag)
	}

	// Up to 2 hardest losses
	for i := 0; i < 2 && i < len(losses); i++ {
		tag := "Hardest Loss"
		if i == 1 {
			tag = "Notable Loss"
		}
		addSession(losses[i], tag)
	}

	// Longest match (not already shown as win/loss above)
	for _, s := range matches {
		if !seen[s.ID] {
			addSession(s, "Longest Match")
			break
		}
	}

	// Longest training session
	if len(trainings) > 0 {
		addSession(trainings[0], "Longest Training")
	}

	return result
}

func emptyReport(year, month int) MonthlyReportResponse {
	t := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC)
	return MonthlyReportResponse{
		Month:          fmt.Sprintf("%s %d", t.Month().String(), year),
		Year:           year,
		MonthNum:       month,
		RacquetUsage:   []RacquetUsageStat{},
		NotableResults: []NotableSession{},
	}
}

func roundTo1(f float64) float64 {
	return float64(int(f*10+0.5)) / 10.0
}
