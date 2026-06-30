package services

import (
	"math/rand"
	"trackquet/models"
)

// PairStanding represents a fixed partner pair's standing for Team Mexicano pairing.
type PairStanding struct {
	Players     [2]models.MatchPlayer
	TotalPoints int
	PairIndex   int
}

// MatchmakingService defines the interface for generating match schedules.
type MatchmakingService interface {
	GenerateAmericanoSchedule(players []models.MatchPlayer, matchType string) []models.Matchup
	GenerateMixedAmericanoSchedule(players []models.MatchPlayer) []models.Matchup
	GenerateRound1(players []models.MatchPlayer, matchType string, format models.MatchmakingFormat) []models.Matchup
	GenerateMexicanoRound(standings []LeaderboardEntry, matchType string) []models.Matchup
	GenerateSuperMexicanoRound(standings []LeaderboardEntry) []models.Matchup
	GenerateTeamAmericanoSchedule(pairs [][]models.MatchPlayer) []models.Matchup
	GenerateTeamMexicanoRound(pairStandings []PairStanding) []models.Matchup
}

// Matchmaking implements MatchmakingService with pure scheduling logic.
type Matchmaking struct{}

// NewMatchmaking creates a new Matchmaking service instance.
func NewMatchmaking() *Matchmaking {
	return &Matchmaking{}
}

// GenerateAmericanoSchedule produces a full round-robin schedule for the Americano format.
// For doubles: each pair of players partners exactly once across all rounds.
// For singles: each pair of players plays exactly once (standard round-robin).
func (m *Matchmaking) GenerateAmericanoSchedule(players []models.MatchPlayer, matchType string) []models.Matchup {
	if matchType == string(models.MatchTypeSingles) {
		return m.generateSinglesRoundRobin(players)
	}
	return m.generateDoublesAmericano(players)
}

// GenerateMixedAmericanoSchedule produces a full round-robin schedule for the Mixed Americano format.
// Each side in every matchup contains exactly one male and one female player.
// Partners and opponents rotate each round.
// Returns nil if: fewer than 4 players, odd total count, or unequal male/female split.
//
// Algorithm:
// - Separate players into males and females.
// - Use a round-robin rotation on males (circle method) to assign each male a female partner per round.
// - In each round, group consecutive male-female pairs into matchups (pair vs pair).
func (m *Matchmaking) GenerateMixedAmericanoSchedule(players []models.MatchPlayer) []models.Matchup {
	if len(players) < 4 {
		return nil
	}
	if len(players)%2 != 0 {
		return nil
	}

	// Separate by gender
	var males, females []models.MatchPlayer
	for _, p := range players {
		switch p.Gender {
		case models.GenderMale:
			males = append(males, p)
		case models.GenderFemale:
			females = append(females, p)
		default:
			return nil // invalid gender
		}
	}

	n := len(males)
	if n != len(females) {
		return nil
	}
	if n < 2 {
		return nil
	}

	// We need n males and n females (total 2n players).
	// Generate rounds by rotating which male partners with which female.
	// Use the "rotate females" approach:
	// - Fix male indices [0..n-1].
	// - For each round, assign male[i] with female[femaleIdx[i]].
	// - Rotate femaleIdx each round (simple circular shift).
	// This gives n rounds where each male-female combination partners exactly once.
	// In each round, we have n pairs; group them into n/2 matchups (2 pairs per matchup).

	// We need n rounds total (each male partners with each female exactly once).
	// n pairs per round, n/2 matchups per round.
	numRounds := n
	matchupsPerRound := n / 2

	// femaleIdx tracks which female index is assigned to which male index
	femaleIdx := make([]int, n)
	for i := range femaleIdx {
		femaleIdx[i] = i
	}

	var matchups []models.Matchup

	for r := 0; r < numRounds; r++ {
		for mi := 0; mi < matchupsPerRound; mi++ {
			// Take two consecutive pairs for each matchup
			maleIdxA := mi * 2
			maleIdxB := mi*2 + 1

			matchup := models.Matchup{
				Round: r + 1,
				Players: []models.MatchupPlayer{
					{MatchPlayerID: males[maleIdxA].ID, Side: models.SideA},
					{MatchPlayerID: females[femaleIdx[maleIdxA]].ID, Side: models.SideA},
					{MatchPlayerID: males[maleIdxB].ID, Side: models.SideB},
					{MatchPlayerID: females[femaleIdx[maleIdxB]].ID, Side: models.SideB},
				},
			}
			matchups = append(matchups, matchup)
		}

		// Rotate female indices: shift all by 1 (circular)
		last := femaleIdx[n-1]
		copy(femaleIdx[1:], femaleIdx[:n-1])
		femaleIdx[0] = last
	}

	return matchups
}

// GenerateRound1 produces random first-round matchups for any format.
// Players are shuffled randomly, then assigned to matchups.
// Singles: P/2 matchups with 1 player per side.
// Doubles: P/4 matchups with 2 players per side.
func (m *Matchmaking) GenerateRound1(players []models.MatchPlayer, matchType string, format models.MatchmakingFormat) []models.Matchup {
	shuffled := make([]models.MatchPlayer, len(players))
	copy(shuffled, players)
	rand.Shuffle(len(shuffled), func(i, j int) {
		shuffled[i], shuffled[j] = shuffled[j], shuffled[i]
	})

	var matchups []models.Matchup

	if matchType == string(models.MatchTypeSingles) {
		numMatchups := len(shuffled) / 2
		for i := 0; i < numMatchups; i++ {
			matchup := models.Matchup{
				Round: 1,
				Players: []models.MatchupPlayer{
					{MatchPlayerID: shuffled[i*2].ID, Side: models.SideA},
					{MatchPlayerID: shuffled[i*2+1].ID, Side: models.SideB},
				},
			}
			matchups = append(matchups, matchup)
		}
	} else {
		numMatchups := len(shuffled) / 4
		for i := 0; i < numMatchups; i++ {
			matchup := models.Matchup{
				Round: 1,
				Players: []models.MatchupPlayer{
					{MatchPlayerID: shuffled[i*4].ID, Side: models.SideA},
					{MatchPlayerID: shuffled[i*4+1].ID, Side: models.SideA},
					{MatchPlayerID: shuffled[i*4+2].ID, Side: models.SideB},
					{MatchPlayerID: shuffled[i*4+3].ID, Side: models.SideB},
				},
			}
			matchups = append(matchups, matchup)
		}
	}

	return matchups
}

// RedistributeMatchups takes a set of matchups and assigns them to rounds starting at startRound,
// with at most numCourts matches per round, no player appearing twice in the same round.
func (m *Matchmaking) RedistributeMatchups(matchups []models.Matchup, numCourts int, startRound int) []models.Matchup {
	if len(matchups) == 0 {
		return nil
	}

	var result []models.Matchup
	assigned := make([]bool, len(matchups))
	round := startRound

	for {
		playersInRound := make(map[uint]bool)
		matchesInRound := 0

		for i := range matchups {
			if assigned[i] {
				continue
			}
			if matchesInRound >= numCourts {
				break
			}
			conflict := false
			for _, mp := range matchups[i].Players {
				if playersInRound[mp.MatchPlayerID] {
					conflict = true
					break
				}
			}
			if conflict {
				continue
			}
			assigned[i] = true
			matchesInRound++
			for _, mp := range matchups[i].Players {
				playersInRound[mp.MatchPlayerID] = true
			}
			matchup := matchups[i]
			matchup.Round = round
			result = append(result, matchup)
		}

		if matchesInRound == 0 {
			break
		}
		round++
	}

	return result
}

// generateSinglesRoundRobin creates a standard round-robin for singles where each pair plays once.
// Uses the circle method: fix player 0, rotate the rest to produce n-1 rounds of n/2 matchups.
func (m *Matchmaking) generateSinglesRoundRobin(players []models.MatchPlayer) []models.Matchup {
	n := len(players)
	if n < 2 {
		return nil
	}

	var matchups []models.Matchup

	indices := make([]int, n)
	for i := range indices {
		indices[i] = i
	}

	numRounds := n - 1
	matchesPerRound := n / 2

	for r := 0; r < numRounds; r++ {
		for mi := 0; mi < matchesPerRound; mi++ {
			p1 := indices[mi]
			p2 := indices[n-1-mi]
			matchup := models.Matchup{
				Round: r + 1,
				Players: []models.MatchupPlayer{
					{MatchPlayerID: players[p1].ID, Side: models.SideA},
					{MatchPlayerID: players[p2].ID, Side: models.SideB},
				},
			}
			matchups = append(matchups, matchup)
		}
		// Rotate: fix position 0, rotate the rest clockwise
		last := indices[n-1]
		copy(indices[2:], indices[1:n-1])
		indices[1] = last
	}

	return matchups
}

// GenerateAmericanoScheduleWithCourts generates a court-aware Americano schedule.
// Each round has at most `numCourts` matchups. Players rotate with sit-outs so no one
// plays every round when there are more players than court slots allow.
func (m *Matchmaking) GenerateAmericanoScheduleWithCourts(players []models.MatchPlayer, matchType string, numCourts int) []models.Matchup {
	if numCourts < 1 {
		numCourts = 1
	}

	if matchType == string(models.MatchTypeSingles) {
		// Generate all pairings
		var allPairings [][2]uint
		for i := 0; i < len(players); i++ {
			for j := i + 1; j < len(players); j++ {
				allPairings = append(allPairings, [2]uint{players[i].ID, players[j].ID})
			}
		}
		// Shuffle for randomness
		rand.Shuffle(len(allPairings), func(i, j int) {
			allPairings[i], allPairings[j] = allPairings[j], allPairings[i]
		})
		return m.assignSinglesPairingsToRounds(allPairings, numCourts)
	}

	// Doubles: generate all possible 4-player matchups (2v2)
	// For even player counts, use the optimized round-robin algorithm then redistribute
	n := len(players)
	if n >= 4 && n%2 == 0 {
		schedule := m.generateDoublesAmericano(players)
		if schedule != nil {
			return m.redistributeIntoCourts(schedule, numCourts)
		}
	}

	// For odd player counts (or if the above failed), generate matchups by
	// creating all partnership pairs and combining them into 2v2 matchups
	if n < 4 {
		return nil
	}

	type doublesMatchup struct {
		sideA [2]uint
		sideB [2]uint
	}

	// Generate all unique 2v2 combinations where each partnership pair plays together
	// We want every pair of players to partner at least once
	// Strategy: generate all partnership pairs, then pair them up into matchups
	var partnerships [][2]int // indices into players
	for i := 0; i < n; i++ {
		for j := i + 1; j < n; j++ {
			partnerships = append(partnerships, [2]int{i, j})
		}
	}

	// Shuffle partnerships
	rand.Shuffle(len(partnerships), func(i, j int) {
		partnerships[i], partnerships[j] = partnerships[j], partnerships[i]
	})

	// Greedily pair partnerships into matchups (no player overlap within a matchup)
	var allMatchups []doublesMatchup
	used := make([]bool, len(partnerships))

	for i := 0; i < len(partnerships); i++ {
		if used[i] {
			continue
		}
		for j := i + 1; j < len(partnerships); j++ {
			if used[j] {
				continue
			}
			// Check no player overlap
			a := partnerships[i]
			b := partnerships[j]
			if a[0] == b[0] || a[0] == b[1] || a[1] == b[0] || a[1] == b[1] {
				continue
			}
			used[i] = true
			used[j] = true
			allMatchups = append(allMatchups, doublesMatchup{
				sideA: [2]uint{players[a[0]].ID, players[a[1]].ID},
				sideB: [2]uint{players[b[0]].ID, players[b[1]].ID},
			})
			break
		}
	}

	// Convert to Matchup structs
	var schedule []models.Matchup
	for _, dm := range allMatchups {
		schedule = append(schedule, models.Matchup{
			Players: []models.MatchupPlayer{
				{MatchPlayerID: dm.sideA[0], Side: models.SideA},
				{MatchPlayerID: dm.sideA[1], Side: models.SideA},
				{MatchPlayerID: dm.sideB[0], Side: models.SideB},
				{MatchPlayerID: dm.sideB[1], Side: models.SideB},
			},
		})
	}

	// Redistribute into court-limited rounds with balanced play counts
	return m.redistributeIntoCourtsBalanced(schedule, numCourts)
}

// assignSinglesPairingsToRounds places pairings into rounds with at most numCourts matches
// per round, ensuring no player appears twice in the same round.
// Balances play counts so each player's match count differs by at most 1 from any other.
func (m *Matchmaking) assignSinglesPairingsToRounds(pairings [][2]uint, numCourts int) []models.Matchup {
	var matchups []models.Matchup
	assigned := make([]bool, len(pairings))
	playCounts := make(map[uint]int) // track how many matches each player has been assigned
	round := 1

	for {
		playersInRound := make(map[uint]bool)
		matchesInRound := 0

		// Find the minimum play count among all players in remaining pairings
		minPlays := -1
		for i, pairing := range pairings {
			if assigned[i] {
				continue
			}
			for _, pid := range pairing {
				if minPlays == -1 || playCounts[pid] < minPlays {
					minPlays = playCounts[pid]
				}
			}
		}

		// Prioritize pairings where both players have the lowest play counts
		for i, pairing := range pairings {
			if assigned[i] {
				continue
			}
			if matchesInRound >= numCourts {
				break
			}
			if playersInRound[pairing[0]] || playersInRound[pairing[1]] {
				continue
			}
			// Only allow this pairing if both players are within 1 of the minimum
			if playCounts[pairing[0]] > minPlays+1 || playCounts[pairing[1]] > minPlays+1 {
				continue
			}
			assigned[i] = true
			playersInRound[pairing[0]] = true
			playersInRound[pairing[1]] = true
			playCounts[pairing[0]]++
			playCounts[pairing[1]]++
			matchesInRound++

			matchups = append(matchups, models.Matchup{
				Round: round,
				Players: []models.MatchupPlayer{
					{MatchPlayerID: pairing[0], Side: models.SideA},
					{MatchPlayerID: pairing[1], Side: models.SideB},
				},
			})
		}

		// If we couldn't fill using balanced selection, fall back to any available pairing
		if matchesInRound < numCourts {
			for i, pairing := range pairings {
				if assigned[i] {
					continue
				}
				if matchesInRound >= numCourts {
					break
				}
				if playersInRound[pairing[0]] || playersInRound[pairing[1]] {
					continue
				}
				assigned[i] = true
				playersInRound[pairing[0]] = true
				playersInRound[pairing[1]] = true
				playCounts[pairing[0]]++
				playCounts[pairing[1]]++
				matchesInRound++

				matchups = append(matchups, models.Matchup{
					Round: round,
					Players: []models.MatchupPlayer{
						{MatchPlayerID: pairing[0], Side: models.SideA},
						{MatchPlayerID: pairing[1], Side: models.SideB},
					},
				})
			}
		}

		if matchesInRound == 0 {
			break
		}
		round++
	}

	return matchups
}

// redistributeIntoCourts takes a schedule and re-assigns round numbers so each round
// has at most numCourts matchups and no player appears twice in the same round.
func (m *Matchmaking) redistributeIntoCourts(schedule []models.Matchup, numCourts int) []models.Matchup {
	rand.Shuffle(len(schedule), func(i, j int) {
		schedule[i], schedule[j] = schedule[j], schedule[i]
	})

	var result []models.Matchup
	assigned := make([]bool, len(schedule))
	round := 1

	for {
		playersInRound := make(map[uint]bool)
		matchesInRound := 0

		for i := range schedule {
			if assigned[i] {
				continue
			}
			if matchesInRound >= numCourts {
				break
			}
			conflict := false
			for _, mp := range schedule[i].Players {
				if playersInRound[mp.MatchPlayerID] {
					conflict = true
					break
				}
			}
			if conflict {
				continue
			}
			assigned[i] = true
			matchesInRound++
			for _, mp := range schedule[i].Players {
				playersInRound[mp.MatchPlayerID] = true
			}
			matchup := schedule[i]
			matchup.Round = round
			result = append(result, matchup)
		}

		if matchesInRound == 0 {
			break
		}
		round++
	}

	return result
}

// redistributeIntoCourtsBalanced redistributes matchups into court-limited rounds
// while balancing play counts so each player's match count differs by at most 1.
func (m *Matchmaking) redistributeIntoCourtsBalanced(schedule []models.Matchup, numCourts int) []models.Matchup {
	rand.Shuffle(len(schedule), func(i, j int) {
		schedule[i], schedule[j] = schedule[j], schedule[i]
	})

	var result []models.Matchup
	assigned := make([]bool, len(schedule))
	playCounts := make(map[uint]int)
	round := 1

	for {
		playersInRound := make(map[uint]bool)
		matchesInRound := 0

		// Find min play count among players in unassigned matchups
		minPlays := -1
		for i := range schedule {
			if assigned[i] {
				continue
			}
			for _, mp := range schedule[i].Players {
				if minPlays == -1 || playCounts[mp.MatchPlayerID] < minPlays {
					minPlays = playCounts[mp.MatchPlayerID]
				}
			}
		}

		// First pass: prioritize matchups where all players are within ±1 of min
		for i := range schedule {
			if assigned[i] {
				continue
			}
			if matchesInRound >= numCourts {
				break
			}
			conflict := false
			overPlayed := false
			for _, mp := range schedule[i].Players {
				if playersInRound[mp.MatchPlayerID] {
					conflict = true
					break
				}
				if playCounts[mp.MatchPlayerID] > minPlays+1 {
					overPlayed = true
				}
			}
			if conflict || overPlayed {
				continue
			}
			assigned[i] = true
			matchesInRound++
			for _, mp := range schedule[i].Players {
				playersInRound[mp.MatchPlayerID] = true
				playCounts[mp.MatchPlayerID]++
			}
			matchup := schedule[i]
			matchup.Round = round
			result = append(result, matchup)
		}

		// Second pass: fill remaining court slots with any available
		if matchesInRound < numCourts {
			for i := range schedule {
				if assigned[i] {
					continue
				}
				if matchesInRound >= numCourts {
					break
				}
				conflict := false
				for _, mp := range schedule[i].Players {
					if playersInRound[mp.MatchPlayerID] {
						conflict = true
						break
					}
				}
				if conflict {
					continue
				}
				assigned[i] = true
				matchesInRound++
				for _, mp := range schedule[i].Players {
					playersInRound[mp.MatchPlayerID] = true
					playCounts[mp.MatchPlayerID]++
				}
				matchup := schedule[i]
				matchup.Round = round
				result = append(result, matchup)
			}
		}

		if matchesInRound == 0 {
			break
		}
		round++
	}

	return result
}

// Each pair of players partners exactly once across all rounds.
// With P players: P-1 rounds, P/4 matchups per round, each player has 1 partner per round.
//
// The algorithm uses the circle-method round-robin to generate partnerships (each pair
// partners exactly once), then groups consecutive partnership pairs within each round
// into matchups (pair[0] vs pair[1], pair[2] vs pair[3], etc.).
func (m *Matchmaking) generateDoublesAmericano(players []models.MatchPlayer) []models.Matchup {
	n := len(players)
	if n < 4 || n%2 != 0 {
		return nil
	}

	// Generate round-robin partnerships: n-1 rounds, n/2 partnership pairs per round
	rrRounds := m.roundRobinPairs(n)

	var matchups []models.Matchup
	for roundIdx, round := range rrRounds {
		// Group consecutive pairs into doubles matchups
		for j := 0; j+1 < len(round); j += 2 {
			matchup := models.Matchup{
				Round: roundIdx + 1,
				Players: []models.MatchupPlayer{
					{MatchPlayerID: players[round[j][0]].ID, Side: models.SideA},
					{MatchPlayerID: players[round[j][1]].ID, Side: models.SideA},
					{MatchPlayerID: players[round[j+1][0]].ID, Side: models.SideB},
					{MatchPlayerID: players[round[j+1][1]].ID, Side: models.SideB},
				},
			}
			matchups = append(matchups, matchup)
		}
	}

	return matchups
}

// GenerateMexicanoRound produces matchups for the next round based on current standings.
// For doubles: groups of 4 from standings, positions i&i+3 vs i+1&i+2 within each group.
// For singles: groups of 2 from standings, position i vs position i+1.
// The standings slice must be pre-sorted by rank (index 0 = rank 1).
// Round is set to 0; the caller assigns the actual round number.
func (m *Matchmaking) GenerateMexicanoRound(standings []LeaderboardEntry, matchType string) []models.Matchup {
	if matchType == string(models.MatchTypeSingles) {
		return m.generateMexicanoSinglesRound(standings)
	}
	return m.generateMexicanoDoublesRound(standings)
}

// generateMexicanoSinglesRound pairs adjacent players: position i vs position i+1.
func (m *Matchmaking) generateMexicanoSinglesRound(standings []LeaderboardEntry) []models.Matchup {
	n := len(standings)
	if n < 2 {
		return nil
	}

	var matchups []models.Matchup
	numMatchups := n / 2
	for i := 0; i < numMatchups; i++ {
		idx := i * 2
		matchup := models.Matchup{
			Round: 0,
			Players: []models.MatchupPlayer{
				{MatchPlayerID: standings[idx].PlayerID, Side: models.SideA},
				{MatchPlayerID: standings[idx+1].PlayerID, Side: models.SideB},
			},
		}
		matchups = append(matchups, matchup)
	}
	return matchups
}

// generateMexicanoDoublesRound takes groups of 4 from standings and pairs:
// positions i and i+3 on Side A vs positions i+1 and i+2 on Side B.
func (m *Matchmaking) generateMexicanoDoublesRound(standings []LeaderboardEntry) []models.Matchup {
	n := len(standings)
	if n < 4 {
		return nil
	}

	var matchups []models.Matchup
	numMatchups := n / 4
	for i := 0; i < numMatchups; i++ {
		base := i * 4
		matchup := models.Matchup{
			Round: 0,
			Players: []models.MatchupPlayer{
				{MatchPlayerID: standings[base].PlayerID, Side: models.SideA},
				{MatchPlayerID: standings[base+3].PlayerID, Side: models.SideA},
				{MatchPlayerID: standings[base+1].PlayerID, Side: models.SideB},
				{MatchPlayerID: standings[base+2].PlayerID, Side: models.SideB},
			},
		}
		matchups = append(matchups, matchup)
	}
	return matchups
}

// GenerateSuperMexicanoRound produces matchups rotating both partners and opponents
// based on individual standings. Uses the same positional logic as Mexicano doubles:
// groups of 4 from standings, positions i&i+3 vs i+1&i+2.
// The standings slice must be pre-sorted by rank (index 0 = rank 1).
// Round is set to 0; the caller assigns the actual round number.
func (m *Matchmaking) GenerateSuperMexicanoRound(standings []LeaderboardEntry) []models.Matchup {
	n := len(standings)
	if n < 4 {
		return nil
	}

	var matchups []models.Matchup
	numMatchups := n / 4
	for i := 0; i < numMatchups; i++ {
		base := i * 4
		matchup := models.Matchup{
			Round: 0,
			Players: []models.MatchupPlayer{
				{MatchPlayerID: standings[base].PlayerID, Side: models.SideA},
				{MatchPlayerID: standings[base+3].PlayerID, Side: models.SideA},
				{MatchPlayerID: standings[base+1].PlayerID, Side: models.SideB},
				{MatchPlayerID: standings[base+2].PlayerID, Side: models.SideB},
			},
		}
		matchups = append(matchups, matchup)
	}
	return matchups
}

// GenerateTeamAmericanoSchedule produces a full round-robin schedule for Team Americano format.
// Each pair faces every other pair exactly once. Pairs are kept as fixed partners across all rounds.
// The input is a slice of pairs, where each pair is a []models.MatchPlayer of length 2.
// Returns matchups with proper Round numbers (1-indexed).
func (m *Matchmaking) GenerateTeamAmericanoSchedule(pairs [][]models.MatchPlayer) []models.Matchup {
	n := len(pairs)
	if n < 2 {
		return nil
	}

	// Use round-robin on pairs (treating each pair as a single entity)
	rrRounds := m.roundRobinPairs(n)

	var matchups []models.Matchup
	for roundIdx, round := range rrRounds {
		for _, pairing := range round {
			pairA := pairs[pairing[0]]
			pairB := pairs[pairing[1]]
			matchup := models.Matchup{
				Round: roundIdx + 1,
				Players: []models.MatchupPlayer{
					{MatchPlayerID: pairA[0].ID, Side: models.SideA},
					{MatchPlayerID: pairA[1].ID, Side: models.SideA},
					{MatchPlayerID: pairB[0].ID, Side: models.SideB},
					{MatchPlayerID: pairB[1].ID, Side: models.SideB},
				},
			}
			matchups = append(matchups, matchup)
		}
	}

	return matchups
}

// GenerateTeamMexicanoRound produces matchups for the next round of Team Mexicano format.
// Uses positional pairing on fixed partner pairs: top pair vs 2nd pair, 3rd pair vs 4th pair, etc.
// The pairStandings slice must be pre-sorted by rank (index 0 = best pair).
// Round is set to 0; the caller assigns the actual round number.
func (m *Matchmaking) GenerateTeamMexicanoRound(pairStandings []PairStanding) []models.Matchup {
	n := len(pairStandings)
	if n < 2 {
		return nil
	}

	var matchups []models.Matchup
	numMatchups := n / 2
	for i := 0; i < numMatchups; i++ {
		idx := i * 2
		pairA := pairStandings[idx]
		pairB := pairStandings[idx+1]
		matchup := models.Matchup{
			Round: 0,
			Players: []models.MatchupPlayer{
				{MatchPlayerID: pairA.Players[0].ID, Side: models.SideA},
				{MatchPlayerID: pairA.Players[1].ID, Side: models.SideA},
				{MatchPlayerID: pairB.Players[0].ID, Side: models.SideB},
				{MatchPlayerID: pairB.Players[1].ID, Side: models.SideB},
			},
		}
		matchups = append(matchups, matchup)
	}
	return matchups
}

// roundRobinPairs generates a standard round-robin schedule using the circle method.
// Returns n-1 rounds, each containing n/2 pairs of player indices.
// Guarantees every pair of indices appears exactly once across all rounds.
func (m *Matchmaking) roundRobinPairs(n int) [][][2]int {
	rounds := make([][][2]int, 0, n-1)

	indices := make([]int, n)
	for i := range indices {
		indices[i] = i
	}

	for r := 0; r < n-1; r++ {
		round := make([][2]int, 0, n/2)
		for j := 0; j < n/2; j++ {
			p1 := indices[j]
			p2 := indices[n-1-j]
			round = append(round, [2]int{p1, p2})
		}
		rounds = append(rounds, round)

		// Rotate: fix position 0, shift the rest
		last := indices[n-1]
		copy(indices[2:], indices[1:n-1])
		indices[1] = last
	}

	return rounds
}
