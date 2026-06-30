import type { Matchup, MatchPlayer, MatchupPlayer } from '../types'

interface DrawScheduleProps {
  matchups: Matchup[]
  players: MatchPlayer[]
  onMatchupClick: (matchup: Matchup) => void
}

/**
 * Groups matchups by round number and displays them as clickable cards.
 * Shows player names by side and score (or placeholder).
 */
export default function DrawSchedule({ matchups, players, onMatchupClick }: DrawScheduleProps) {
  // Group matchups by round
  const roundsMap = matchups.reduce<Record<number, Matchup[]>>((acc, matchup) => {
    const round = matchup.round
    if (!acc[round]) {
      acc[round] = []
    }
    acc[round].push(matchup)
    return acc
  }, {})

  const sortedRounds = Object.keys(roundsMap)
    .map(Number)
    .sort((a, b) => a - b)

  // Resolve player name from ID
  const getPlayerName = (matchPlayerId: number): string => {
    const player = players.find((p) => p.id === matchPlayerId)
    return player?.name ?? 'Unknown'
  }

  // Get player names for a given side
  const getSideNames = (matchupPlayers: MatchupPlayer[] | undefined, side: 'A' | 'B'): string => {
    if (!matchupPlayers || matchupPlayers.length === 0) return 'TBD'
    const sidePlayers = matchupPlayers.filter((mp) => mp.side === side)
    if (sidePlayers.length === 0) return 'TBD'
    return sidePlayers.map((mp) => getPlayerName(mp.match_player_id)).join(' & ')
  }

  // Format score display
  const formatScore = (matchup: Matchup): string | null => {
    if (matchup.score_side_a != null && matchup.score_side_b != null) {
      return `${matchup.score_side_a} - ${matchup.score_side_b}`
    }
    return null
  }

  if (matchups.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        <p>No matchups scheduled yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {sortedRounds.map((round) => (
        <section key={round}>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Round {round}
          </h3>
          <div className="space-y-2">
            {roundsMap[round].map((matchup) => {
              const score = formatScore(matchup)
              const sideA = getSideNames(matchup.players, 'A')
              const sideB = getSideNames(matchup.players, 'B')

              return (
                <button
                  key={matchup.id}
                  type="button"
                  onClick={() => onMatchupClick(matchup)}
                  className="w-full text-left card p-4 hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-gray-900 truncate block">{sideA}</span>
                    </div>
                    <div className="shrink-0 text-center px-3">
                      {score ? (
                        <span className="font-bold text-gray-900 text-sm">{score}</span>
                      ) : (
                        <span className="text-xs text-gray-400">No score</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-right">
                      <span className="font-medium text-gray-900 truncate block">{sideB}</span>
                    </div>
                  </div>
                  {matchup.court_number != null && (
                    <p className="text-xs text-gray-500 mt-1">Court {matchup.court_number}</p>
                  )}
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
