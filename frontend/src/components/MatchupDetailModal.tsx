import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import ScoreInput, { validateScore } from './ScoreInput'
import { updateMatchup, startMatchup, finishMatchup } from '../api/matches'
import type { Matchup, MatchPlayer, WinConditionType, MatchType } from '../types'

interface MatchupDetailModalProps {
  isOpen: boolean
  onClose: () => void
  matchup: Matchup | null
  players: MatchPlayer[]
  winConditionType: WinConditionType
  winConditionValue: number
  matchType: MatchType
  sessionId: number
  numCourts: number
  onUpdated: (matchup: Matchup) => void
}

export default function MatchupDetailModal({
  isOpen,
  onClose,
  matchup,
  players,
  winConditionType,
  winConditionValue,
  matchType,
  sessionId,
  numCourts,
  onUpdated,
}: MatchupDetailModalProps) {
  const [scoreSideA, setScoreSideA] = useState<number | null>(null)
  const [scoreSideB, setScoreSideB] = useState<number | null>(null)
  const [courtNumber, setCourtNumber] = useState<string>('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [startingMatchup, setStartingMatchup] = useState(false)
  const [finishingMatchup, setFinishingMatchup] = useState(false)

  // Local timing state so UI updates immediately
  const [localStartedAt, setLocalStartedAt] = useState<string | null>(null)
  const [localFinishedAt, setLocalFinishedAt] = useState<string | null>(null)

  // Running timer
  const [elapsed, setElapsed] = useState('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Sync local state when matchup prop changes
  useEffect(() => {
    if (matchup) {
      setScoreSideA(matchup.score_side_a ?? null)
      setScoreSideB(matchup.score_side_b ?? null)
      setCourtNumber(matchup.court_number != null ? String(matchup.court_number) : '')
      setNotes(matchup.notes ?? '')
      setLocalStartedAt(matchup.started_at ?? null)
      setLocalFinishedAt(matchup.finished_at ?? null)
    }
  }, [matchup?.id, matchup?.started_at, matchup?.finished_at])

  // Running timer effect
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    if (localStartedAt && !localFinishedAt) {
      const updateElapsed = () => {
        const start = new Date(localStartedAt).getTime()
        const now = Date.now()
        const diffSec = Math.floor((now - start) / 1000)
        const mins = Math.floor(diffSec / 60)
        const secs = diffSec % 60
        setElapsed(`${mins}:${secs.toString().padStart(2, '0')}`)
      }
      updateElapsed()
      timerRef.current = setInterval(updateElapsed, 1000)
    } else {
      setElapsed('')
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [localStartedAt, localFinishedAt])

  // Resolve player names by side
  const { sideAPlayers, sideBPlayers } = useMemo(() => {
    if (!matchup?.players) return { sideAPlayers: [], sideBPlayers: [] }
    const sideA = matchup.players
      .filter((mp) => mp.side === 'A')
      .map((mp) => players.find((p) => p.id === mp.match_player_id))
      .filter(Boolean) as MatchPlayer[]
    const sideB = matchup.players
      .filter((mp) => mp.side === 'B')
      .map((mp) => players.find((p) => p.id === mp.match_player_id))
      .filter(Boolean) as MatchPlayer[]
    return { sideAPlayers: sideA, sideBPlayers: sideB }
  }, [matchup, players])

  // Final duration (only when finished)
  const finalDuration = useMemo(() => {
    if (!localStartedAt || !localFinishedAt) return null
    const start = new Date(localStartedAt).getTime()
    const end = new Date(localFinishedAt).getTime()
    const diffMs = end - start
    if (diffMs < 0) return 'N/A'
    const totalMin = Math.floor(diffMs / 60000)
    const hours = Math.floor(totalMin / 60)
    const mins = totalMin % 60
    if (hours > 0) return `${hours}h ${mins}m`
    return `${mins}m`
  }, [localStartedAt, localFinishedAt])

  const winConditionLabel = useMemo(() => {
    if (winConditionType === 'points') return `Play to ${winConditionValue} points`
    const bestOf = winConditionValue * 2 - 1
    return `Race to ${winConditionValue} (Best of ${bestOf})`
  }, [winConditionType, winConditionValue])

  const scoreError = useMemo(() => {
    return validateScore(scoreSideA, scoreSideB, winConditionType, winConditionValue)
  }, [scoreSideA, scoreSideB, winConditionType, winConditionValue])

  const handleScoreChange = useCallback((a: number | null, b: number | null) => {
    setScoreSideA(a)
    setScoreSideB(b)
  }, [])

  const hasChanges = useMemo(() => {
    if (!matchup) return false
    const origCourt = matchup.court_number != null ? String(matchup.court_number) : ''
    const origNotes = matchup.notes ?? ''
    return (
      scoreSideA !== (matchup.score_side_a ?? null) ||
      scoreSideB !== (matchup.score_side_b ?? null) ||
      courtNumber !== origCourt ||
      notes !== origNotes
    )
  }, [matchup, scoreSideA, scoreSideB, courtNumber, notes])

  const handleSave = async () => {
    if (!matchup) return
    if (scoreSideA !== null && scoreSideB !== null && scoreError) {
      toast.error(scoreError)
      return
    }
    setSaving(true)
    try {
      const courtVal = courtNumber.trim() === '' ? null : parseInt(courtNumber, 10)
      const updated = await updateMatchup(sessionId, matchup.id, {
        score_side_a: scoreSideA,
        score_side_b: scoreSideB,
        court_number: isNaN(courtVal as number) ? null : courtVal,
        notes,
      })
      toast.success('Matchup updated')
      onUpdated(updated)
      onClose()
    } catch {
      toast.error('Failed to update matchup')
    } finally {
      setSaving(false)
    }
  }

  const handleStart = async () => {
    if (!matchup) return
    setStartingMatchup(true)
    try {
      const updated = await startMatchup(sessionId, matchup.id)
      setLocalStartedAt(updated.started_at ?? new Date().toISOString())
      onUpdated(updated)
    } catch {
      toast.error('Failed to start matchup')
    } finally {
      setStartingMatchup(false)
    }
  }

  const handleFinish = async () => {
    if (!matchup) return
    setFinishingMatchup(true)
    try {
      const updated = await finishMatchup(sessionId, matchup.id)
      setLocalFinishedAt(updated.finished_at ?? new Date().toISOString())
      onUpdated(updated)
    } catch {
      toast.error('Failed to finish matchup')
    } finally {
      setFinishingMatchup(false)
    }
  }

  if (!isOpen || !matchup) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40">
      <div className="flex min-h-full items-center justify-center px-4 py-8">
        <div className="card w-full max-w-md p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">🎾</span>
                <h2 className="text-lg font-bold text-gray-900">Matchup Details</h2>
              </div>
              <p className="text-sm text-gray-500">Round {matchup.round}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-700 text-xl ml-4 mt-1 shrink-0"
              aria-label="Close matchup detail"
            >
              ×
            </button>
          </div>

          {/* Quick-info chips */}
          <div className="flex flex-wrap gap-2 mb-5">
            <span className="bg-gray-100 rounded-lg px-3 py-1.5 text-sm capitalize">
              <span className="font-semibold text-gray-800">
                {matchType === 'singles' ? '👤 Singles' : '👥 Doubles'}
              </span>
            </span>
            <span className="bg-indigo-100 rounded-lg px-3 py-1.5 text-sm">
              <span className="font-semibold text-indigo-700">{winConditionLabel}</span>
            </span>
          </div>

          {/* Players */}
          <div className="border border-gray-200 rounded-xl p-4 mb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Players</p>
            <div className="flex items-center gap-3">
              <div className="flex-1 text-center">
                <p className="text-xs text-gray-500 mb-1 font-medium">Side A</p>
                {sideAPlayers.map((p) => (
                  <p key={p.id} className="text-sm font-semibold text-gray-800">{p.name}</p>
                ))}
              </div>
              <span className="text-gray-400 font-bold text-lg">vs</span>
              <div className="flex-1 text-center">
                <p className="text-xs text-gray-500 mb-1 font-medium">Side B</p>
                {sideBPlayers.map((p) => (
                  <p key={p.id} className="text-sm font-semibold text-gray-800">{p.name}</p>
                ))}
              </div>
            </div>
          </div>

          {/* Score */}
          <div className="mb-4">
            <label className="label">Score</label>
            <ScoreInput
              scoreSideA={scoreSideA}
              scoreSideB={scoreSideB}
              onChange={handleScoreChange}
              winConditionType={winConditionType}
              winConditionValue={winConditionValue}
            />
          </div>

          {/* Court */}
          <div className="mb-4">
            <label className="label">Court</label>
            <select
              className="input w-28"
              value={courtNumber}
              onChange={(e) => setCourtNumber(e.target.value)}
            >
              {Array.from({ length: numCourts }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>Court {n}</option>
              ))}
            </select>
          </div>

          {/* Timing */}
          <div className="mb-4">
            <label className="label">Timing</label>
            {!localStartedAt ? (
              <button
                type="button"
                className="btn-primary text-sm py-1.5 px-3"
                disabled={startingMatchup}
                onClick={handleStart}
              >
                {startingMatchup ? 'Starting…' : '▶ Start'}
              </button>
            ) : !localFinishedAt ? (
              <div className="flex items-center gap-3">
                <span className="text-sm font-mono font-semibold text-green-600 bg-green-50 px-2 py-1 rounded">
                  ⏱ {elapsed}
                </span>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold disabled:opacity-60"
                  disabled={finishingMatchup}
                  onClick={handleFinish}
                >
                  {finishingMatchup ? 'Finishing…' : '⏹ Finish'}
                </button>
              </div>
            ) : (
              <span className="text-sm text-gray-500">✓ Completed ({finalDuration})</span>
            )}
          </div>

          {/* Notes */}
          <div className="mb-5">
            <label className="label">Notes</label>
            <textarea
              className="input resize-none"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Match notes or highlights…"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            {hasChanges && (
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
                {saving ? 'Saving…' : 'Save'}
              </button>
            )}
            <button onClick={onClose} className={`btn-secondary ${hasChanges ? '' : 'flex-1'}`}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
