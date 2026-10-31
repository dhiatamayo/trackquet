import { useState } from 'react'
import ModalPortal from './ModalPortal'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { X, Trophy, Dumbbell } from 'lucide-react'
import type { Session, MatchType } from '../types'
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
  const [matchType, setMatchType] = useState<MatchType>((session.match_type as MatchType) ?? 'singles')
  const [notes, setNotes] = useState(session.notes ?? '')
  const [saving, setSaving] = useState(false)

  const hasChanges =
    matchResult !== (session.match_result ?? '') ||
    matchScore !== (session.match_score ?? '') ||
    opponentRacquet !== (session.opponent_racquet ?? '') ||
    matchType !== (session.match_type ?? 'singles') ||
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
        match_type: isMatch ? matchType : undefined,
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
    <ModalPortal>
    <div className="modal-overlay">
      <div className="modal-shell">
        <div className="card w-full max-w-md p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-start gap-3">
              <span className={`flex h-10 w-10 items-center justify-center rounded-control shrink-0 ${isMatch ? 'bg-court-50 text-court-600' : 'bg-ink-100 text-ink-500'}`}>
                {isMatch ? <Trophy className="h-5 w-5" /> : <Dumbbell className="h-5 w-5" />}
              </span>
              <div>
                <h2 className="text-h2 text-ink-900">
                  {session.name || (isMatch ? 'Match' : 'Training')}
                </h2>
                <p className="text-caption text-ink-500 mt-0.5">{dateStr}</p>
              </div>
            </div>
            <button onClick={onClose} className="btn-icon shrink-0" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Quick-info chips */}
          <div className="flex flex-wrap gap-2 mb-5">
            <span className="bg-ink-100 rounded-control px-3 py-1.5 text-caption">
              <span className="font-semibold text-ink-800">{durationStr}</span>
              <span className="text-ink-500 ml-1">duration</span>
            </span>
            <span className="bg-ink-100 rounded-control px-3 py-1.5 text-caption capitalize">
              <span className="font-semibold text-ink-800">{session.type}</span>
            </span>
            {isMatch && session.match_type && (
              <span className="bg-court-50 rounded-control px-3 py-1.5 text-sm capitalize">
                <span className="font-semibold text-court-700">
                  {session.match_type === 'singles' ? 'Singles' : 'Doubles'}
                </span>
              </span>
            )}
            {isMatch && session.match_result && (
              <span
                className={`rounded-control px-3 py-1.5 text-caption font-semibold capitalize ${
                  session.match_result === 'win'
                    ? 'bg-court-50 text-court-700'
                    : 'bg-red-100 text-red-700'
                }`}
              >
                {session.match_result}
              </span>
            )}
            {isMatch && session.match_score && (
              <span className="bg-ink-100 rounded-control px-3 py-1.5 text-caption text-ink-700">
                {session.match_score}
              </span>
            )}
          </div>

          {/* Opponent's racquet display (read-only chip) */}
          {isMatch && session.opponent_racquet && !opponentRacquet && (
            <div className="mb-4 text-caption text-ink-600">
              <span className="font-medium">Opponent's racquet:</span> {session.opponent_racquet}
            </div>
          )}

          {/* Editable match fields */}
          {isMatch && (
            <div className="space-y-3 border border-amber-200 bg-amber-50 rounded-card p-4 mb-4">
              <p className="text-caption font-semibold text-amber-700 uppercase tracking-wide">Match Details</p>

              <div>
                <label className="label">Match Type</label>
                <div className="flex gap-2">
                  {(['singles', 'doubles'] as MatchType[]).map((mt) => (
                    <button
                      key={mt}
                      type="button"
                      onClick={() => setMatchType(mt)}
                      className={`flex-1 py-2 rounded-control border text-caption font-medium transition-colors ${
                        matchType === mt
                          ? 'bg-court-600 text-white border-court-600'
                          : 'bg-white text-ink-700 border-ink-300 hover:bg-ink-50'
                      }`}
                    >
                      {mt === 'singles' ? 'Singles' : 'Doubles'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Result</label>
                <div className="flex gap-2">
                  {(['win', 'loss'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setMatchResult(matchResult === r ? '' : r)}
                      className={`flex-1 py-2 rounded-control border text-caption font-medium transition-colors ${
                        matchResult === r
                          ? r === 'win'
                            ? 'bg-court-600 text-white border-court-600'
                            : 'bg-red-600 text-white border-red-600'
                          : 'bg-white text-ink-700 border-ink-300 hover:bg-ink-50'
                      }`}
                    >
                      {r === 'win' ? 'Win' : 'Loss'}
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
    </ModalPortal>
  )
}
