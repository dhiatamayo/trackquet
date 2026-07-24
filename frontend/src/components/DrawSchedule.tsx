import { useState, useMemo } from 'react'
import type { Matchup, MatchPlayer, MatchupPlayer } from '../types'

interface DrawScheduleProps {
  matchups: Matchup[]
  players: MatchPlayer[]
  onMatchupClick: (matchup: Matchup) => void
}

export default function DrawSchedule({ matchups, players, onMatchupClick }: DrawScheduleProps) {
  const [currentRoundIdx, setCurrentRoundIdx] = useState(0)

  // Group matchups by round
  const { sortedRounds, roundsMap } = useMemo(() => {
    const map = matchups.reduce<Record<number, Matchup[]>>((acc, matchup) => {
      if (!acc[matchup.round]) acc[matchup.round] = []
      acc[matchup.round].push(matchup)
      return acc
    }, {})
    const sorted = Object.keys(map).map(Number).sort((a, b) => a - b)
    return { sortedRounds: sorted, roundsMap: map }
  }, [matchups])

  const totalRounds = sortedRounds.length
  const currentRound = sortedRounds[currentRoundIdx] ?? 1
  const currentMatchups = roundsMap[currentRound] ?? []

  // Determine which players are playing and waiting in this round
  const { playingIds, waitingPlayers } = useMemo(() => {
    const playing = new Set<number>()
    for (const m of currentMatchups) {
      for (const mp of m.players ?? []) {
        playing.add(mp.match_player_id)
      }
    }
    const waiting = players.filter((p) => !playing.has(p.id))
    return { playingIds: playing, waitingPlayers: waiting }
  }, [currentMatchups, players])

  // Determine who played in the previous round
  const prevRoundPlayers = useMemo(() => {
    if (currentRoundIdx === 0) return []
    const prevRound = sortedRounds[currentRoundIdx - 1]
    const prevMatchups = roundsMap[prevRound] ?? []
    const ids = new Set<number>()
    for (const m of prevMatchups) {
      for (const mp of m.players ?? []) {
        ids.add(mp.match_player_id)
      }
    }
    return players.filter((p) => ids.has(p.id))
  }, [currentRoundIdx, sortedRounds, roundsMap, players])

  const getPlayerName = (id: number): string => {
    return players.find((p) => p.id === id)?.name ?? 'Unknown'
  }

  const getSideNames = (mps: MatchupPlayer[] | undefined, side: 'A' | 'B'): string[] => {
    if (!mps || mps.length === 0) return ['TBD']
    const sidePlayers = mps.filter((mp) => mp.side === side)
    if (sidePlayers.length === 0) return ['TBD']
    return sidePlayers.map((mp) => getPlayerName(mp.match_player_id))
  }

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
    <div>
      {/* Round navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setCurrentRoundIdx((i) => Math.max(0, i - 1))}
          disabled={currentRoundIdx === 0}
          className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ← Prev
        </button>
        <span className="text-sm font-semibold text-gray-700">
          Round {currentRound} of {totalRounds}
        </span>
        <button
          onClick={() => setCurrentRoundIdx((i) => Math.min(totalRounds - 1, i + 1))}
          disabled={currentRoundIdx >= totalRounds - 1}
          className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Next →
        </button>
      </div>

      {/* Matchups for current round */}
      <div className="space-y-2 mb-4">
        {currentMatchups.map((matchup) => {
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
              <div className="flex items-start justify-between gap-2 sm:gap-4">
                <div className="flex-1 min-w-0 space-y-0.5">
                  {sideA.map((name, idx) => (
                    <span key={idx} className="font-medium text-gray-900 text-sm sm:text-base block">
                      {name}
                    </span>
                  ))}
                </div>
                <div className="shrink-0 text-center px-1 sm:px-3 pt-0.5">
                  {score ? (
                    <span className="font-bold text-gray-900 text-sm">{score}</span>
                  ) : (
                    <span className="text-xs text-gray-400">No score</span>
                  )}
                </div>
                <div className="flex-1 min-w-0 text-right space-y-0.5">
                  {sideB.map((name, idx) => (
                    <span key={idx} className="font-medium text-gray-900 text-sm sm:text-base block">
                      {name}
                    </span>
                  ))}
                </div>
              </div>
              {matchup.court_number != null && (
                <p className="text-xs text-gray-500 mt-1">Court {matchup.court_number}</p>
              )}
            </button>
          )
        })}
      </div>

      {/* Waiting players */}
      {waitingPlayers.length > 0 && (
        <div className="border-t border-gray-200 pt-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Waiting ({waitingPlayers.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {waitingPlayers.map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600"
              >
                {p.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Played previous round */}
      {prevRoundPlayers.length > 0 && (
        <div className="border-t border-gray-200 pt-3 mt-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Played Previous Round ({prevRoundPlayers.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {prevRoundPlayers.map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-600"
              >
                {p.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
