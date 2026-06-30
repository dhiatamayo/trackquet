import { useState, useRef } from 'react'
import type { Gender } from '../types'

export interface PlayerEntry {
  name: string
  gender?: Gender
  pair_index?: number | null
}

interface Props {
  players: PlayerEntry[]
  onPlayersChange: (players: PlayerEntry[]) => void
  showGender: boolean
  showPairIndex: boolean
}

function getValidationError(
  name: string,
  index: number,
  allPlayers: PlayerEntry[]
): string | null {
  if (name.length === 0) return 'Name is required'
  if (name.length > 50) return 'Name must be 50 characters or less'
  const duplicate = allPlayers.findIndex(
    (p, i) => i !== index && p.name.trim().toLowerCase() === name.trim().toLowerCase()
  )
  if (duplicate !== -1) return 'Duplicate player name'
  return null
}

export default function PlayerInput({ players, onPlayersChange, showGender, showPairIndex }: Props) {
  const [touched, setTouched] = useState<Record<number, boolean>>({})
  const listRef = useRef<HTMLDivElement>(null)

  const updatePlayer = (index: number, updates: Partial<PlayerEntry>) => {
    const updated = players.map((p, i) => (i === index ? { ...p, ...updates } : p))
    onPlayersChange(updated)
  }

  const addPlayer = () => {
    const newPlayer: PlayerEntry = { name: '', gender: showGender ? 'male' : undefined, pair_index: null }
    onPlayersChange([...players, newPlayer])
    // Scroll to bottom after React renders the new player
    setTimeout(() => {
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight
      }
    }, 0)
  }

  const removePlayer = (index: number) => {
    const updated = players.filter((_, i) => i !== index)
    onPlayersChange(updated)
    // Clean up touched state
    setTouched((prev) => {
      const next: Record<number, boolean> = {}
      Object.keys(prev).forEach((key) => {
        const k = parseInt(key)
        if (k < index) next[k] = prev[k]
        else if (k > index) next[k - 1] = prev[k]
      })
      return next
    })
  }

  const markTouched = (index: number) => {
    setTouched((prev) => ({ ...prev, [index]: true }))
  }

  // Calculate pair numbers for display
  const getPairOptions = (): number[] => {
    const maxPairs = Math.floor(players.length / 2)
    return Array.from({ length: maxPairs }, (_, i) => i + 1)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="label mb-0">Players</label>
        <span className="text-xs text-gray-500">{players.length} player{players.length !== 1 ? 's' : ''}</span>
      </div>

      <div ref={listRef} className="space-y-2 max-h-64 overflow-y-auto px-0.5 py-0.5">
        {players.map((player, index) => {
          const error = touched[index] ? getValidationError(player.name, index, players) : null
          return (
            <div key={index} className="flex items-start gap-2">
              {/* Player name */}
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  className={`input w-full ${error ? 'border-red-400 focus:ring-red-300' : ''}`}
                  value={player.name}
                  onChange={(e) => updatePlayer(index, { name: e.target.value })}
                  onBlur={() => markTouched(index)}
                  placeholder={`Player ${index + 1}`}
                  maxLength={50}
                />
                {error && (
                  <p className="text-xs text-red-500 mt-0.5">{error}</p>
                )}
              </div>

              {/* Gender select (only for Mixed Americano) */}
              {showGender && (
                <select
                  className="input w-24 shrink-0"
                  value={player.gender || 'male'}
                  onChange={(e) => updatePlayer(index, { gender: e.target.value as Gender })}
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              )}

              {/* Pair index (only for fixed partners) */}
              {showPairIndex && (
                <select
                  className="input w-20 shrink-0"
                  value={player.pair_index ?? ''}
                  onChange={(e) =>
                    updatePlayer(index, {
                      pair_index: e.target.value ? parseInt(e.target.value) : null,
                    })
                  }
                >
                  <option value="">Pair</option>
                  {getPairOptions().map((pairNum) => (
                    <option key={pairNum} value={pairNum}>
                      P{pairNum}
                    </option>
                  ))}
                </select>
              )}

              {/* Remove button */}
              <button
                type="button"
                onClick={() => removePlayer(index)}
                className="shrink-0 p-2 text-gray-400 hover:text-red-500 transition-colors"
                title="Remove player"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          )
        })}
      </div>

      {/* Add player button */}
      <button
        type="button"
        onClick={addPlayer}
        className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-court-400 hover:text-court-600 transition-colors"
      >
        + Add Player
      </button>
    </div>
  )
}
