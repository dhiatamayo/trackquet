package services

import (
	"sort"

	"trackquet/models"
)

// LeaderboardEntry represents a single player's standing in the leaderboard.
type LeaderboardEntry struct {
	PlayerID    uint   `json:"player_id"`
	PlayerName  string `json:"player_name"`
	TotalPoints int    `json:"total_points"`
	PointDiff   int    `json:"point_diff"`
	GamesPlayed int    `json:"games_played"`
	Rank        int    `json:"rank"`
}

// CalculateLeaderboard computes ranked standings from players and completed matchups.
// It is a pure function with no database access.
// Only matchups with both ScoreSideA and ScoreSideB non-nil are considered (completed matchups).
// Sorting: total_points descending, then point_diff descending, then head-to-head results.
// Ties share the same rank.
func CalculateLeaderboard(players []models.MatchPlayer, matchups []models.Matchup) []LeaderboardEntry {
	if len(players) == 0 {
		return []LeaderboardEntry{}
	}

	// Build a map of playerID -> entry for accumulating points
	type playerStats struct {
		playerID    uint
		playerName  string
		totalPoints int
		pointDiff   int
		gamesPlayed int
	}

	statsMap := make(map[uint]*playerStats, len(players))
	for _, p := range players {
		statsMap[p.ID] = &playerStats{
			playerID:   p.ID,
			playerName: p.Name,
		}
	}

	// Build head-to-head record: h2h[playerA][playerB] = net points scored by A against B
	h2h := make(map[uint]map[uint]int)
	for _, p := range players {
		h2h[p.ID] = make(map[uint]int)
	}

	// Process only completed matchups (both scores non-nil)
	for i := range matchups {
		m := &matchups[i]
		if m.ScoreSideA == nil || m.ScoreSideB == nil {
			continue
		}

		scoreA := *m.ScoreSideA
		scoreB := *m.ScoreSideB

		// Determine which players are on each side
		var sideAPlayers []uint
		var sideBPlayers []uint

		for _, mp := range m.Players {
			if mp.Side == models.SideA {
				sideAPlayers = append(sideAPlayers, mp.MatchPlayerID)
			} else if mp.Side == models.SideB {
				sideBPlayers = append(sideBPlayers, mp.MatchPlayerID)
			}
		}

		// Update stats for side A players
		for _, pid := range sideAPlayers {
			if s, ok := statsMap[pid]; ok {
				s.totalPoints += scoreA
				s.pointDiff += scoreA - scoreB
				s.gamesPlayed++
			}
			// Update head-to-head: A players scored scoreA against B players, conceded scoreB
			for _, oppID := range sideBPlayers {
				h2h[pid][oppID] += scoreA - scoreB
			}
		}

		// Update stats for side B players
		for _, pid := range sideBPlayers {
			if s, ok := statsMap[pid]; ok {
				s.totalPoints += scoreB
				s.pointDiff += scoreB - scoreA
				s.gamesPlayed++
			}
			// Update head-to-head: B players scored scoreB against A players, conceded scoreA
			for _, oppID := range sideAPlayers {
				h2h[pid][oppID] += scoreB - scoreA
			}
		}
	}

	// Build entries slice
	entries := make([]LeaderboardEntry, 0, len(players))
	for _, p := range players {
		s := statsMap[p.ID]
		entries = append(entries, LeaderboardEntry{
			PlayerID:    s.playerID,
			PlayerName:  s.playerName,
			TotalPoints: s.totalPoints,
			PointDiff:   s.pointDiff,
			GamesPlayed: s.gamesPlayed,
		})
	}

	// Sort by total_points desc, then point_diff desc, then head-to-head
	sort.SliceStable(entries, func(i, j int) bool {
		if entries[i].TotalPoints != entries[j].TotalPoints {
			return entries[i].TotalPoints > entries[j].TotalPoints
		}
		if entries[i].PointDiff != entries[j].PointDiff {
			return entries[i].PointDiff > entries[j].PointDiff
		}
		// Head-to-head tiebreaker: if player i has a positive net score against player j, i ranks higher
		netScore := h2h[entries[i].PlayerID][entries[j].PlayerID]
		return netScore > 0
	})

	// Assign ranks (1-indexed, ties share rank)
	for i := range entries {
		if i == 0 {
			entries[i].Rank = 1
		} else {
			prev := entries[i-1]
			curr := entries[i]
			if curr.TotalPoints == prev.TotalPoints &&
				curr.PointDiff == prev.PointDiff &&
				h2h[curr.PlayerID][prev.PlayerID] == 0 {
				// Tied: same rank
				entries[i].Rank = prev.Rank
			} else {
				entries[i].Rank = i + 1
			}
		}
	}

	return entries
}
