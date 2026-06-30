import { useState, useCallback } from 'react'
import type { WinConditionType } from '../types'

export interface ScoreInputProps {
  scoreSideA: number | null
  scoreSideB: number | null
  onChange: (scoreA: number | null, scoreB: number | null) => void
  winConditionType: WinConditionType
  winConditionValue: number
}

/**
 * Validates a score pair against the win condition rules.
 * Returns an error message if invalid, or null if valid.
 *
 * Rules:
 * - Points-based (16/21/32): one side must equal the target, the other must be >= 0 and < target
 * - Set-based (Race to N): one side must equal N, the other must be >= 0 and < N
 */
export function validateScore(
  scoreA: number | null,
  scoreB: number | null,
  winConditionType: WinConditionType,
  winConditionValue: number
): string | null {
  // Don't validate if either score is not filled
  if (scoreA === null || scoreB === null) return null

  // Both scores must be non-negative integers
  if (scoreA < 0 || scoreB < 0) {
    return 'Scores must be non-negative'
  }
  if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB)) {
    return 'Scores must be whole numbers'
  }

  const target = winConditionValue

  if (winConditionType === 'points') {
    // Points-based: one side must equal the target, the other must be >= 0 and < target
    const aWins = scoreA === target && scoreB >= 0 && scoreB < target
    const bWins = scoreB === target && scoreA >= 0 && scoreA < target
    if (!aWins && !bWins) {
      return `One side must score exactly ${target} points and the other must be less than ${target}`
    }
  } else {
    // Set-based (Race to N): one side must equal N, the other must be >= 0 and < N
    const aWins = scoreA === target && scoreB >= 0 && scoreB < target
    const bWins = scoreB === target && scoreA >= 0 && scoreA < target
    if (!aWins && !bWins) {
      return `One side must win exactly ${target} sets and the other must have fewer than ${target}`
    }
  }

  return null
}

export default function ScoreInput({
  scoreSideA,
  scoreSideB,
  onChange,
  winConditionType,
  winConditionValue,
}: ScoreInputProps) {
  const [error, setError] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)

  const handleScoreChange = useCallback(
    (side: 'A' | 'B', rawValue: string) => {
      const parsed = rawValue === '' ? null : parseInt(rawValue, 10)
      const value = parsed !== null && isNaN(parsed) ? null : parsed

      const newA = side === 'A' ? value : scoreSideA
      const newB = side === 'B' ? value : scoreSideB

      onChange(newA, newB)

      // Clear error while typing
      if (touched) {
        const validationError = validateScore(newA, newB, winConditionType, winConditionValue)
        setError(validationError)
      }
    },
    [scoreSideA, scoreSideB, onChange, winConditionType, winConditionValue, touched]
  )

  const handleBlur = useCallback(() => {
    setTouched(true)
    const validationError = validateScore(scoreSideA, scoreSideB, winConditionType, winConditionValue)
    setError(validationError)
  }, [scoreSideA, scoreSideB, winConditionType, winConditionValue])

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <input
          type="number"
          min="0"
          step="1"
          className={`input w-20 text-center ${error ? 'border-red-400 focus:ring-red-300' : ''}`}
          value={scoreSideA ?? ''}
          onChange={(e) => handleScoreChange('A', e.target.value)}
          onBlur={handleBlur}
          placeholder="A"
          aria-label="Score Side A"
        />
        <span className="text-sm text-gray-500 font-medium">-</span>
        <input
          type="number"
          min="0"
          step="1"
          className={`input w-20 text-center ${error ? 'border-red-400 focus:ring-red-300' : ''}`}
          value={scoreSideB ?? ''}
          onChange={(e) => handleScoreChange('B', e.target.value)}
          onBlur={handleBlur}
          placeholder="B"
          aria-label="Score Side B"
        />
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}
