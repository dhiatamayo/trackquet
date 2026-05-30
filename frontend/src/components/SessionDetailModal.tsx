import { useState } from 'react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import type { Session } from '../types'
import { updateSession } from '../api/client'

interface Props {
  session: Session
  racquetId: number
  onClose: () => void
  onUpdated: (session: Session) => void
}

export default function SessionDetailModal({ session, racquetId, onClose, onUpdated }: Props) {
  const isMatch = session.type === 'match'
  const [matchResult, setMatchResult] = useState<'win' | 'loss' | ''>(
    (session.match_result as 'win' | 'loss' | '') ?? ''
  )
  const [matchScore, setMatchScore] = useState(session.match_score ?? '')
  const [opponentRacquet, setOpponentRacquet] = useState(session.opponent_racquet ?? '')
  const [notes, setNotes] = useState(session.notes ?? '')
  const [saving, setSaving] = useState(false)

  const hasChanges =
    matchResult !== (session.match_result ?? '') ||
    matchScore !== (session.match_score ?? '') ||
    opponentRacquet !== (session.opponent_racquet ?? '') ||
    notes !== (session.notes ?? '')

  const dateStr = (() => {
    try {
      return format(new Date(session.date), 'EEEE, MMMM d, yyyy')
    } catch {
      return session.date
    }
  })()

  const hours = Math.floor(session.duration_min / 60)
  const mins = session.duration_min % 60
  const durationStr = hours > 0 ? `${hours}h${mins > 0 ? ` ${mins}m` : ''}` : `${mins}m`

  const handleSave = async () => {
    setSaving(true)
    try {
      const updated = await updateSession(racquetId, session.id, {
        notes,
        match_result: isMatch ? matchResult : undefined,
        match_score: isMatch ? matchScore : undefined,
        opponent_racquet: isMatch ? opponentRacquet : undefined,
      })
      toast.success('Session updated')
      onUpdated(updated)
      onClose()
    } catch {
      toast.error('Failed to update session')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40">
      <div className="flex min-h-full items-center justify-center px-4 py-8">
        <div className="card w-full max-w-md p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">{isMatch ? '🏆' : '🏋️'}</span>
                <h2 className="text-lg font-bold text-gray-900">
                  {session.name || (isMatch ? 'Match' : 'Training')}
                </h2>
              </div>
              <p className="text-sm text-gray-500">{dateStr}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-700 text-xl ml-4 mt-1 shrink-0"
            >
              ×
            </button>
          </div>

          {/* Quick-info chips */}
          <div className="flex flex-wrap gap-2 mb-5">
            <span className="bg-gray-100 rounded-lg px-3 py-1.5 text-sm">
              <span className="font-semibold text-gray-800">{durationStr}</span>
              <span className="text-gray-500 ml-1">duration</span>
            </span>
            <span className="bg-gray-100 rounded-lg px-3 py-1.5 text-sm capitalize">
              <span className="font-semibold text-gray-800">{session.type}</span>
            </span>
            {isMatch && session.match_result && (
              <span
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold capitalize ${
                  session.match_result === 'win'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}
              >
                {session.match_result === 'win' ? '🏅' : '😤'} {session.match_result}
              </span>
            )}
            {isMatch && session.match_score && (
              <span className="bg-gray-100 rounded-lg px-3 py-1.5 text-sm text-gray-700">
                {session.match_score}
              </span>
            )}
          </div>

          {/* Opponent's racquet display (read-only chip) */}
          {isMatch && session.opponent_racquet && !opponentRacquet && (
            <div className="mb-4 text-sm text-gray-600">
              <span className="font-medium">Opponent's racquet:</span> {session.opponent_racquet}
            </div>
          )}

          {/* Editable match fields */}
          {isMatch && (
            <div className="space-y-3 border border-amber-200 bg-amber-50 rounded-xl p-4 mb-4">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Match Details</p>

              <div>
                <label className="label">Result</label>
                <div className="flex gap-2">
                  {(['win', 'loss'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setMatchResult(matchResult === r ? '' : r)}
                      className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        matchResult === r
                          ? r === 'win'
                            ? 'bg-green-600 text-white border-green-600'
                            : 'bg-red-600 text-white border-red-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {r === 'win' ? '🏅 Win' : '😤 Loss'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Score (optional)</label>
                <input
                  className="input"
                  value={matchScore}
                  onChange={(e) => setMatchScore(e.target.value)}
                  placeholder="e.g. 6-3, 7-5"
                />
              </div>

              <div>
                <label className="label">Opponent's Racquet (optional)</label>
                <input
                  className="input"
                  value={opponentRacquet}
                  onChange={(e) => setOpponentRacquet(e.target.value)}
                  placeholder="e.g. Babolat Pure Drive 16"
                />
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="mb-5">
            <label className="label">Notes</label>
            <textarea
              className="input resize-none"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Session notes…"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            {hasChanges && (
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
                {saving ? 'Saving…' : 'Save Changes'}
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
