import { useState, useMemo } from 'react'
import type { SessionType, StringRecord } from '../types'
import { format, parseISO, isWithinInterval, startOfDay } from 'date-fns'

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

  const selectedRecord = useMemo(
    () => stringRecords.find((r) => r.id === selectedRecordId),
    [stringRecords, selectedRecordId]
  )

  const minDate = selectedRecord
    ? format(new Date(selectedRecord.started_at), 'yyyy-MM-dd')
    : undefined
  const maxDate = selectedRecord?.ended_at
    ? format(new Date(selectedRecord.ended_at), 'yyyy-MM-dd')
    : format(new Date(), 'yyyy-MM-dd')

  const dateError = useMemo(() => {
    if (!date || !selectedRecord) return null
    const d = startOfDay(parseISO(date))
    const start = startOfDay(new Date(selectedRecord.started_at))
    const end = selectedRecord.ended_at
      ? startOfDay(new Date(selectedRecord.ended_at))
      : startOfDay(new Date())
    if (!isWithinInterval(d, { start, end })) {
      const fmt = (s: string) => format(new Date(s), 'MMM d, yyyy')
      return `Date must be between ${fmt(selectedRecord.started_at)} and ${
        selectedRecord.ended_at ? fmt(selectedRecord.ended_at) : 'today'
      }`
    }
    return null
  }, [date, selectedRecord])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (dateError) return
    const totalMin = Math.max(1, parseInt(hours || '0') * 60 + parseInt(minutes || '0'))
    onSave({ date, durationMin: totalMin, type, name, notes, stringRecordId: selectedRecordId })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 overflow-y-auto py-8">
      <div className="card w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold">Log Session</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl">×</button>
        </div>
        <p className="text-sm text-gray-500 mb-4">Racquet: <strong>{racquetName}</strong></p>

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
                      className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                        isSelected
                          ? isActive
                            ? 'border-green-500 bg-green-50 text-green-800'
                            : 'border-red-400 bg-red-50 text-red-800'
                          : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${
                          isActive ? 'bg-green-500' : 'bg-red-400'
                        }`} />
                        <span className="font-medium">
                          {r.string_name || 'Unknown'}{r.gauge ? ` (${r.gauge})` : ''}
                        </span>
                        <span className={`ml-auto text-xs ${
                          isActive ? 'text-green-600' : 'text-red-500'
                        }`}>
                          {isActive ? 'Active' : 'Retired'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5 pl-4">
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
            {dateError && <p className="text-xs text-red-500 mt-1">{dateError}</p>}
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
              <span className="text-sm text-gray-500">h</span>
              <input
                type="number"
                className="input w-20 text-center"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                min="0"
                max="59"
                step="5"
              />
              <span className="text-sm text-gray-500">min</span>
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
                  className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    type === t
                      ? 'bg-court-600 text-white border-court-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {t === 'training' ? '🏋️ Training' : '🏆 Match'}
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
  )
}
