package handlers

import (
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
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

	// --- Notable results (up to 6) ---
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

// parseScoreMargin parses a score string like "6-3, 7-5" and returns the total
// absolute game margin across all sets. Scored matches with a higher margin are
// considered bigger wins (or harder losses). Returns -1 if the score is empty or
// cannot be parsed, so unscored matches sort after scored ones.
func parseScoreMargin(score string) int {
	if score == "" {
		return -1
	}
	total, parsed := 0, 0
	for _, set := range strings.Split(score, ",") {
		parts := strings.SplitN(strings.TrimSpace(set), "-", 2)
		if len(parts) != 2 {
			continue
		}
		a, err1 := strconv.Atoi(strings.TrimSpace(parts[0]))
		b, err2 := strconv.Atoi(strings.TrimSpace(parts[1]))
		if err1 != nil || err2 != nil {
			continue
		}
		if a > b {
			total += a - b
		} else {
			total += b - a
		}
		parsed++
	}
	if parsed == 0 {
		return -1
	}
	return total
}

// buildNotableResults returns up to 4 milestones: biggest win (by score margin),
// hardest loss (by score margin), longest match, longest training. Avoids duplicates.
// Scored matches always rank above unscored ones within each category.
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

	// Sort wins: scored wins first (higher margin = bigger win), then unscored by duration
	sort.SliceStable(wins, func(i, j int) bool {
		mi, mj := parseScoreMargin(wins[i].MatchScore), parseScoreMargin(wins[j].MatchScore)
		if mi >= 0 && mj < 0 {
			return true
		}
		if mi < 0 && mj >= 0 {
			return false
		}
		if mi != mj {
			return mi > mj
		}
		return wins[i].DurationMin > wins[j].DurationMin
	})

	// Sort losses: scored losses first (higher margin = harder loss), then unscored by duration
	sort.SliceStable(losses, func(i, j int) bool {
		mi, mj := parseScoreMargin(losses[i].MatchScore), parseScoreMargin(losses[j].MatchScore)
		if mi >= 0 && mj < 0 {
			return true
		}
		if mi < 0 && mj >= 0 {
			return false
		}
		if mi != mj {
			return mi > mj
		}
		return losses[i].DurationMin > losses[j].DurationMin
	})

	sort.Slice(matches, func(i, j int) bool { return matches[i].DurationMin > matches[j].DurationMin })
	sort.Slice(trainings, func(i, j int) bool { return trainings[i].DurationMin > trainings[j].DurationMin })

	seen := make(map[uint]bool)
	var result []NotableSession

	addSession := func(s models.Session, tag string) {
		if seen[s.ID] || len(result) >= 4 {
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

	// Biggest win (scored matches ranked first by margin)
	if len(wins) > 0 {
		addSession(wins[0], "Biggest Win")
	}

	// Hardest loss (scored matches ranked first by margin)
	if len(losses) > 0 {
		addSession(losses[0], "Hardest Loss")
	}

	// Longest match not already shown
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
