import { useState, useMemo } from 'react'
import { X } from 'lucide-react'
import type { SessionType, MatchType, StringRecord } from '../types'
import { format, parseISO, startOfDay } from 'date-fns'

interface Props {
  racquetName: string
  stringRecords: StringRecord[]
  onClose: () => void
  onSave: (data: {
    date: string
    durationMin: number
    type: SessionType
    name: string
    notes: string
    stringRecordId?: number
    matchResult?: 'win' | 'loss' | ''
    matchScore?: string
    opponentRacquet?: string
    matchType?: MatchType
  }) => void
  loading?: boolean
}

export default function LogSessionModal({ racquetName, stringRecords, onClose, onSave, loading }: Props) {
  const activeRecord = stringRecords.find((r) => !r.ended_at)
  const [selectedRecordId, setSelectedRecordId] = useState<number | undefined>(activeRecord?.id)
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [hours, setHours] = useState('1')
  const [minutes, setMinutes] = useState('0')
  const [type, setType] = useState<SessionType>('training')
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [matchResult, setMatchResult] = useState<'win' | 'loss' | ''>('')
  const [matchScore, setMatchScore] = useState('')
  const [opponentRacquet, setOpponentRacquet] = useState('')
  const [matchType, setMatchType] = useState<MatchType>('singles')

  const selectedRecord = useMemo(
    () => stringRecords.find((r) => r.id === selectedRecordId),
    [stringRecords, selectedRecordId]
  )

  const minDate = undefined
  const maxDate = selectedRecord?.ended_at
    ? format(new Date(selectedRecord.ended_at), 'yyyy-MM-dd')
    : format(new Date(), 'yyyy-MM-dd')

  const dateError = useMemo(() => {
    if (!date || !selectedRecord) return null
    const d = startOfDay(parseISO(date))
    const end = selectedRecord.ended_at
      ? startOfDay(new Date(selectedRecord.ended_at))
      : startOfDay(new Date())
    if (d > end) {
      const fmt = (s: string) => format(new Date(s), 'MMM d, yyyy')
      return `Date must be on or before ${
        selectedRecord.ended_at ? fmt(selectedRecord.ended_at) : 'today'
      }`
    }
    return null
  }, [date, selectedRecord])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (dateError) return
    const totalMin = Math.max(1, parseInt(hours || '0') * 60 + parseInt(minutes || '0'))
    onSave({ date, durationMin: totalMin, type, name, notes, stringRecordId: selectedRecordId, matchResult, matchScore, opponentRacquet, matchType })
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40">
      <div className="flex min-h-full items-center justify-center px-4 py-8">
      <div className="card w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-h2 text-ink-900">Log Session</h2>
          <button onClick={onClose} className="btn-icon" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <p className="text-body text-ink-500 mb-4">Racquet: <strong>{racquetName}</strong></p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* String configuration */}
          {stringRecords.length > 1 && (
            <div>
              <label className="label">String Configuration</label>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {stringRecords.map((r) => {
                  const isSelected = selectedRecordId === r.id
                  const isActive = !r.ended_at
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        setSelectedRecordId(r.id)
                        setDate(format(new Date(), 'yyyy-MM-dd'))
                      }}
                      className={`w-full text-left px-3 py-2 rounded-control border text-caption transition-colors ${
                        isSelected
                          ? isActive
                            ? 'border-court-500 bg-court-50 text-court-800'
                            : 'border-red-400 bg-red-50 text-red-800'
                          : 'border-ink-200 bg-white text-ink-700 hover:bg-ink-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${
                          isActive ? 'bg-court-500' : 'bg-red-400'
                        }`} />
                        <span className="font-medium">
                          {r.string_name || 'Unknown'}{r.gauge ? ` (${r.gauge})` : ''}
                        </span>
                        <span className={`ml-auto text-xs ${
                          isActive ? 'text-court-600' : 'text-red-500'
                        }`}>
                          {isActive ? 'Active' : 'Retired'}
                        </span>
                      </div>
                      <div className="text-caption text-ink-400 mt-0.5 pl-4">
                        {format(new Date(r.started_at), 'MMM d, yyyy')} →{' '}
                        {r.ended_at ? format(new Date(r.ended_at), 'MMM d, yyyy') : 'now'}
                        {' · '}{(r.total_minutes / 60).toFixed(1)}h
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Session name */}
          <div>
            <label className="label">Session Name *</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Coaching at Cinere / Match vs Ahmad"
              required
            />
          </div>

          {/* Date */}
          <div>
            <label className="label">Date</label>
            <input
              type="date"
              className={`input ${dateError ? 'border-red-400 focus:ring-red-300' : ''}`}
              value={date}
              min={minDate}
              max={maxDate}
              onChange={(e) => setDate(e.target.value)}
              required
            />
            {dateError && <p className="text-caption text-red-500 mt-1">{dateError}</p>}
          </div>

          {/* Duration */}
          <div>
            <label className="label">Duration</label>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                className="input w-20 text-center"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                min="0"
                max="12"
              />
              <span className="text-caption text-ink-500">h</span>
              <input
                type="number"
                className="input w-20 text-center"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                min="0"
                max="59"
                step="5"
              />
              <span className="text-caption text-ink-500">min</span>
            </div>
          </div>

          {/* Type */}
          <div>
            <label className="label">Session Type</label>
            <div className="flex gap-3">
              {(['training', 'match'] as SessionType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`flex-1 py-2 rounded-control border text-caption font-medium transition-colors ${
                    type === t
                      ? 'bg-court-600 text-white border-court-600'
                      : 'bg-white text-ink-700 border-ink-300 hover:bg-ink-50'
                  }`}
                >
                  {t === 'training' ? 'Training' : 'Match'}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="label">Notes (optional)</label>
            <textarea
              className="input resize-none"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How did it go? String feedback, conditions..."
            />
          </div>

          {/* Match-specific fields */}
          {type === 'match' && (
            <div className="space-y-3 border border-amber-200 bg-amber-50 rounded-card p-4">
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

          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn-primary flex-1" disabled={loading || !!dateError}>
              {loading ? 'Saving…' : 'Log Session'}
            </button>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
      </div>
    </div>
  )
}
