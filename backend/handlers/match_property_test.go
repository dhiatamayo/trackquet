package handlers

import (
	"fmt"
	"strings"
	"testing"

	"trackquet/models"

	"pgregory.net/rapid"
)

// Feature: match-tracker, Property 17: Score validation against win condition
// **Validates: Requirements 10.1, 10.5**
//
// For any matchup score entry, the system SHALL accept the score if and only if:
// for points-based win conditions, the winning side's score equals the target value
// (16, 21, or 32) and both scores are non-negative integers; for set-based win
// conditions (Race to N), the winning side's score equals N and both scores are
// non-negative integers.

func TestPropertyScoreValidationAgainstWinCondition(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		// Generate random scores in the range [-5, 40]
		scoreA := rapid.IntRange(-5, 40).Draw(t, "scoreA")
		scoreB := rapid.IntRange(-5, 40).Draw(t, "scoreB")

		// Generate random win condition type
		winType := rapid.SampledFrom([]models.WinConditionType{
			models.WinConditionSets,
			models.WinConditionPoints,
		}).Draw(t, "winType")

		// Generate random win condition value based on type
		var winValue int
		if winType == models.WinConditionSets {
			winValue = rapid.SampledFrom([]int{2, 3, 4, 5}).Draw(t, "winValueSets")
		} else {
			winValue = rapid.SampledFrom([]int{16, 21, 32}).Draw(t, "winValuePoints")
		}

		// Call the function under test
		errMsg := validateScore(scoreA, scoreB, winType, winValue)

		// Determine expected acceptance based on the rules:
		// Accept: scoreA >= 0 AND scoreB >= 0 AND exactly one of (scoreA == winValue, scoreB == winValue)
		//         AND the non-winning score < winValue
		// Reject: otherwise
		bothNonNegative := scoreA >= 0 && scoreB >= 0
		aWins := scoreA == winValue && scoreB < winValue
		bWins := scoreB == winValue && scoreA < winValue
		shouldAccept := bothNonNegative && (aWins || bWins)

		isAccepted := errMsg == ""

		if shouldAccept && !isAccepted {
			t.Fatalf("Score should be accepted but was rejected: "+
				"scoreA=%d, scoreB=%d, winType=%s, winValue=%d, error=%q",
				scoreA, scoreB, winType, winValue, errMsg)
		}

		if !shouldAccept && isAccepted {
			t.Fatalf("Score should be rejected but was accepted: "+
				"scoreA=%d, scoreB=%d, winType=%s, winValue=%d",
				scoreA, scoreB, winType, winValue)
		}
	})
}

// Feature: match-tracker, Property 15: Player name validation and uniqueness
// **Validates: Requirements 9.1, 9.6**
//
// For any player name S within a match session, the system SHALL accept it if and only if
// 1 <= len(S) <= 50 AND no other player in the same session has the same name.
// Duplicate names or names outside the length bounds SHALL be rejected.

func TestPropertyPlayerNameValidationAndUniqueness(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		// Choose a scenario to test
		scenario := rapid.SampledFrom([]string{
			"valid_unique",
			"empty_name",
			"too_long_name",
			"duplicate_name",
		}).Draw(t, "scenario")

		var players []CreateMatchPlayerRequest
		var shouldReject bool

		switch scenario {
		case "valid_unique":
			// Generate 2-8 unique valid names (1-50 chars each)
			count := rapid.IntRange(2, 8).Draw(t, "playerCount")
			nameSet := make(map[string]bool)
			validChars := []rune("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")
			for i := 0; i < count; i++ {
				var name string
				for {
					nameLen := rapid.IntRange(1, 50).Draw(t, fmt.Sprintf("nameLen_%d", i))
					name = rapid.StringOfN(rapid.RuneFrom(validChars),
						nameLen, nameLen, -1).Draw(t, fmt.Sprintf("name_%d", i))
					// Ensure name is not all whitespace (trimmed must be non-empty)
					if strings.TrimSpace(name) == "" {
						continue
					}
					// Ensure case-insensitive uniqueness
					if !nameSet[strings.ToLower(strings.TrimSpace(name))] {
						break
					}
				}
				nameSet[strings.ToLower(strings.TrimSpace(name))] = true
				players = append(players, CreateMatchPlayerRequest{Name: name})
			}
			shouldReject = false

		case "empty_name":
			// Include at least one empty name among valid players
			players = []CreateMatchPlayerRequest{
				{Name: "ValidPlayer1"},
				{Name: ""},
				{Name: "ValidPlayer3"},
			}
			shouldReject = true

		case "too_long_name":
			// Generate a name > 50 characters
			longLen := rapid.IntRange(51, 100).Draw(t, "longNameLen")
			longName := rapid.StringOfN(rapid.RuneFrom([]rune("abcdefghijklmnopqrstuvwxyz")),
				longLen, longLen, -1).Draw(t, "longName")
			players = []CreateMatchPlayerRequest{
				{Name: "ValidPlayer1"},
				{Name: longName},
				{Name: "ValidPlayer3"},
			}
			shouldReject = true

		case "duplicate_name":
			// Generate a valid name and duplicate it (case-insensitive)
			baseNameLen := rapid.IntRange(1, 50).Draw(t, "baseNameLen")
			baseName := rapid.StringOfN(rapid.RuneFrom([]rune("abcdefghijklmnopqrstuvwxyz")),
				baseNameLen, baseNameLen, -1).Draw(t, "baseName")
			if strings.TrimSpace(baseName) == "" {
				baseName = "player"
			}
			// Create the duplicate with different casing
			dupName := strings.ToUpper(baseName)
			players = []CreateMatchPlayerRequest{
				{Name: "UniquePlayer1"},
				{Name: baseName},
				{Name: dupName},
				{Name: "UniquePlayer4"},
			}
			shouldReject = true
		}

		// Ensure we have enough players for the match type (need at least 4 for doubles)
		for len(players) < 4 {
			players = append(players, CreateMatchPlayerRequest{
				Name: fmt.Sprintf("ExtraPlayer%d", len(players)+100),
			})
		}
		// Ensure even count for doubles
		if len(players)%2 != 0 {
			players = append(players, CreateMatchPlayerRequest{
				Name: fmt.Sprintf("PadPlayer%d", len(players)+200),
			})
		}

		req := &CreateMatchSessionRequest{
			Name:              "Test Match",
			Date:              "2025-01-15T10:00:00Z",
			SportType:         "tennis",
			MatchType:         "doubles",
			Format:            "americano",
			WinConditionType:  "sets",
			WinConditionValue: 2,
			Players:           players,
		}

		errMsg := validateCreateMatchSession(req)

		if shouldReject {
			if errMsg == "" {
				t.Fatalf("Expected rejection for scenario=%q but request was accepted. Players: %v",
					scenario, playerNames(players))
			}
			// Verify error message is relevant to player name validation
			switch scenario {
			case "empty_name":
				if errMsg != "player name is required" {
					t.Fatalf("Expected 'player name is required' for empty name, got: %q", errMsg)
				}
			case "too_long_name":
				if errMsg != "player name must be between 1 and 50 characters" {
					t.Fatalf("Expected length error for too-long name, got: %q", errMsg)
				}
			case "duplicate_name":
				if !strings.Contains(errMsg, "duplicate player name") {
					t.Fatalf("Expected duplicate name error, got: %q", errMsg)
				}
			}
		} else {
			if errMsg != "" {
				t.Fatalf("Expected acceptance for scenario=%q but got error: %q. Players: %v",
					scenario, errMsg, playerNames(players))
			}
		}
	})
}

// playerNames extracts the names from a list of CreateMatchPlayerRequest for debug output.
func playerNames(players []CreateMatchPlayerRequest) []string {
	names := make([]string, len(players))
	for i, p := range players {
		names[i] = p.Name
	}
	return names
}
