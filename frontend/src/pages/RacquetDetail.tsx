import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import {
  fetchRacquet,
  fetchStringRecords,
  createSession,
  deleteSession,
  restringRacquet,
} from '../api/client'
import type { Racquet, Session, StringRecord, RestringPayload } from '../types'
import UsageBar from '../components/UsageBar'
import LogSessionModal from '../components/LogSessionModal'
import RestringModal from '../components/RestringModal'

export default function RacquetDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [racquet, setRacquet] = useState<Racquet | null>(null)
  const [loading, setLoading] = useState(true)
  const [showLog, setShowLog] = useState(false)
  const [showRestring, setShowRestring] = useState(false)
  const [saving, setSaving] = useState(false)
  const [stringRecords, setStringRecords] = useState<StringRecord[]>([])
  const [expandedRecord, setExpandedRecord] = useState<number | null>(null)

  // Compose display name for single or hybrid string setups
  const displayStringName = (name: string, gauge: string, crossName?: string, crossGauge?: string) => {
    if (!name) return null
    const main = gauge && gauge !== 'Unknown' ? `${name} ${gauge}` : name
    if (!crossName) return main
    const cross = crossGauge && crossGauge !== 'Unknown' ? `${crossName} ${crossGauge}` : crossName
    return `${main} X ${cross}`
  }

  const load = () => {
    fetchRacquet(Number(id))
      .then((data) => {
        setRacquet(data)
        setLoading(false)
      })
      .catch(() => {
        toast.error('Racquet not found')
        navigate('/')
      })
    fetchStringRecords(Number(id))
      .then(setStringRecords)
      .catch(() => {})
  }

  useEffect(() => {
    load()
  }, [id])

  const handleLogSession = async (data: {
    date: string
    durationMin: number
    type: 'match' | 'training'
    name: string
    notes: string
    stringRecordId?: number
  }) => {
    setSaving(true)
    try {
      await createSession(Number(id), {
        date: data.date,
        duration_min: data.durationMin,
        type: data.type,
        name: data.name,
        notes: data.notes,
        string_record_id: data.stringRecordId,
      })
      toast.success('Session logged!')
      setShowLog(false)
      load()
    } catch {
      toast.error('Failed to log session')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteSession = async (sessionId: number) => {
    if (!confirm('Delete this session?')) return
    try {
      await deleteSession(Number(id), sessionId)
      toast.success('Session removed')
      load()
    } catch {
      toast.error('Failed to delete session')
    }
  }

  const handleRestring = async (payload?: RestringPayload) => {
    try {
      const updated = await restringRacquet(Number(id), payload)
      setRacquet(updated)
      setShowRestring(false)
      toast.success('Racquet restrung — counter reset! 🎉')
      fetchStringRecords(Number(id)).then(setStringRecords).catch(() => {})
    } catch {
      toast.error('Failed to restring')
    }
  }

  if (loading) {
    return <div className="text-center py-16 text-gray-400">Loading…</div>
  }

  if (!racquet) return null

  const sessions: Session[] = racquet.sessions ?? []
  const lifetimeHours = stringRecords.reduce((s, r) => s + r.total_minutes, 0) / 60

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className={`card p-6 ${racquet.needs_restring ? 'border-red-300 bg-red-50' : ''}`}>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{racquet.name}</h1>
            {racquet.brand && <p className="text-gray-500">{racquet.brand}</p>}

            <div className="flex flex-wrap gap-2 mt-3 text-xs">
              {racquet.string_name && (
                <span className="bg-court-50 border border-court-200 text-court-800 px-3 py-1 rounded-full font-medium">
                  🔗 {displayStringName(racquet.string_name, racquet.gauge, racquet.cross_string_name, racquet.cross_gauge)}
                </span>
              )}
              {racquet.main_tension > 0 && (
                <span className="bg-gray-100 border border-gray-200 text-gray-700 px-3 py-1 rounded-full">
                  ⚡ {racquet.main_tension}/{racquet.cross_tension} lbs M/C
                </span>
              )}
              {racquet.year > 0 && (
                <span className="bg-gray-100 border border-gray-200 text-gray-700 px-3 py-1 rounded-full">
                  📅 {racquet.year}
                </span>
              )}
              {racquet.head_size > 0 && (
                <span className="bg-gray-100 border border-gray-200 text-gray-700 px-3 py-1 rounded-full">
                  🎯 {racquet.head_size} in²
                </span>
              )}
              {racquet.weight > 0 && (
                <span className="bg-gray-100 border border-gray-200 text-gray-700 px-3 py-1 rounded-full">
                  ⚖️ {racquet.weight}g
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-2 shrink-0">
            <button className="btn-primary" onClick={() => setShowLog(true)}>
              + Log Session
            </button>
            <button
              className={`btn ${racquet.needs_restring ? 'bg-red-600 text-white hover:bg-red-700' : 'btn-secondary'}`}
              onClick={() => setShowRestring(true)}
              title="Mark as restrung (resets counter)"
            >
              🔗 Restring
            </button>
          </div>
        </div>
      </div>

      {/* Usage stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard emoji="🔗" label="String Hours" value={`${racquet.total_hours.toFixed(1)}h`} tooltip="Hours on the current string setup" />
        <StatCard emoji="⏳" label="Racquet Total" value={`${lifetimeHours.toFixed(1)}h`} tooltip="Total play time across all string setups" />
        <StatCard emoji="🎯" label="Threshold" value={`${racquet.threshold_hours}h`} />
        <StatCard emoji="📋" label="Sessions" value={String(sessions.length)} />
        <StatCard
          emoji={racquet.needs_restring ? '⚠️' : racquet.usage_percent >= 85 ? '⚡' : '✅'}
          label="String Status"
          value={racquet.needs_restring ? 'Restring!' : racquet.usage_percent >= 85 ? 'Declining' : 'Good'}
          highlight={racquet.needs_restring ? 'red' : racquet.usage_percent >= 85 ? 'amber' : undefined}
          tooltip={
            racquet.needs_restring
              ? 'Generally a big drop in performance — time to restring.'
              : racquet.usage_percent >= 85
              ? 'Expect a slight drop in performance as tension fades.'
              : 'Most likely maintaining full string performance.'
          }
        />
      </div>

      {/* Usage bar */}
      <div className="card p-5">
        <div className="mb-3">
          <h2 className="font-semibold text-gray-900">String Usage</h2>
          <p className="text-sm text-gray-500 mt-1">{racquet.restring_suggestion}</p>
        </div>
        <UsageBar percent={racquet.usage_percent} needsRestring={racquet.needs_restring} />
        <p className="text-xs text-gray-400 mt-2">
          {racquet.total_hours.toFixed(1)}h on current strings out of {racquet.threshold_hours}h threshold
          {lifetimeHours > racquet.total_hours && (
            <span className="ml-2 text-gray-300">· {lifetimeHours.toFixed(1)}h total on this racquet</span>
          )}
        </p>
      </div>

      {/* Sessions list */}
      <div className="card">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Session History</h2>
          <button className="btn-primary text-xs py-1.5 px-3" onClick={() => setShowLog(true)}>
            + Log
          </button>
        </div>

        {sessions.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <p className="text-3xl mb-2">📋</p>
            <p>No sessions logged yet.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {[...sessions]
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .map((s) => (
                <SessionRow key={s.id} session={s} onDelete={handleDeleteSession} />
              ))}
          </ul>
        )}
      </div>

      {/* String History */}
      {stringRecords.length > 0 && (
        <div className="card">
          <div className="p-5 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">String History</h2>
          </div>
          <ul className="divide-y divide-gray-100">
            {stringRecords.map((rec, i) => {
              const isActive = !rec.ended_at
              const isExpanded = expandedRecord === rec.id
              const recHours = rec.total_minutes / 60
              const totalHours = recHours.toFixed(1)
              const usagePct = rec.threshold_hours > 0 ? Math.min(100, (recHours / rec.threshold_hours) * 100) : null
              const startDate = (() => { try { return format(new Date(rec.started_at), 'MMM d, yyyy') } catch { return rec.started_at } })()
              const endDate = rec.ended_at ? (() => { try { return format(new Date(rec.ended_at), 'MMM d, yyyy') } catch { return rec.ended_at } })() : null
              const usageColor = usagePct === null ? 'text-gray-400' : usagePct >= 100 ? 'text-red-600' : usagePct >= 85 ? 'text-amber-600' : 'text-green-600'
              return (
                <li key={rec.id}>
                  <button
                    className="w-full text-left px-5 py-4 hover:bg-gray-50 flex items-center justify-between gap-3"
                    onClick={() => setExpandedRecord(isExpanded ? null : rec.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isActive && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Active</span>}
                        {i === 0 && !isActive && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Latest</span>}
                        <span className="font-medium text-sm text-gray-900">{displayStringName(rec.string_name, rec.gauge, rec.cross_string_name, rec.cross_gauge) || 'Unknown String'}</span>
                        {usagePct !== null && (
                          <span className={`text-xs font-semibold ${usageColor}`}>
                            {usagePct.toFixed(0)}% · {totalHours}h/{rec.threshold_hours}h
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {rec.main_tension > 0 && <span>⚡ {rec.main_tension}/{rec.cross_tension} lbs · </span>}
                        {rec.gauge && <span>gauge {rec.gauge} · </span>}
                        <span>{startDate}{endDate ? ` → ${endDate}` : ' → now'} · {rec.sessions?.length ?? 0} sessions</span>
                      </div>
                    </div>
                    <span className="text-gray-400 text-xs">{isExpanded ? '▲' : '▼'}</span>
                  </button>
                  {isExpanded && rec.sessions && rec.sessions.length > 0 && (
                    <ul className="bg-gray-50 divide-y divide-gray-100 border-t border-gray-100">
                      {rec.sessions.map((s) => {
                        const sDate = (() => { try { return format(new Date(s.date), 'MMM d, yyyy') } catch { return s.date } })()
                        const h = Math.floor(s.duration_min / 60), m = s.duration_min % 60
                        const dur = h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`
                        return (
                          <li key={s.id} className="flex items-center gap-3 px-8 py-2.5 text-sm">
                            <span>{s.type === 'match' ? '🏆' : '🏋️'}</span>
                            <div className="flex-1 min-w-0">
                              <span className="text-gray-800 font-medium">{s.name || s.type}</span>
                              <span className="text-gray-400 text-xs ml-2">{sDate}</span>
                              {s.notes && <p className="text-xs text-gray-400 truncate">{s.notes}</p>}
                            </div>
                            <span className="text-court-700 font-semibold text-xs shrink-0">{dur}</span>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                  {isExpanded && (!rec.sessions || rec.sessions.length === 0) && (
                    <p className="text-xs text-gray-400 px-8 py-3 bg-gray-50">No sessions in this period.</p>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {showLog && (
        <LogSessionModal
          racquetName={racquet.name}
          stringRecords={stringRecords}
          onClose={() => setShowLog(false)}
          onSave={handleLogSession}
          loading={saving}
        />
      )}

      {showRestring && (
        <RestringModal
          currentStringName={racquet.string_name ?? ''}
          currentGauge={racquet.gauge ?? ''}
          currentCrossStringName={racquet.cross_string_name ?? ''}
          currentCrossGauge={racquet.cross_gauge ?? ''}
          currentMainTension={racquet.main_tension}
          currentCrossTension={racquet.cross_tension}
          currentThreshold={racquet.threshold_hours}
          onClose={() => setShowRestring(false)}
          onSave={handleRestring}
          loading={saving}
        />
      )}
    </div>
  )
}

function SessionRow({ session, onDelete }: { session: Session; onDelete: (id: number) => void }) {
  const dateStr = (() => {
    try {
      return format(new Date(session.date), 'MMM d, yyyy')
    } catch {
      return session.date
    }
  })()

  const hours = Math.floor(session.duration_min / 60)
  const mins = session.duration_min % 60
  const durationStr = hours > 0 ? `${hours}h ${mins > 0 ? mins + 'm' : ''}`.trim() : `${mins}m`

  return (
    <li className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50">
      <span className="text-xl">{session.type === 'match' ? '🏆' : '🏋️'}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm capitalize text-gray-800">{session.name || session.type}</span>
          <span className="text-xs text-gray-400">·</span>
          <span className="text-xs text-gray-500 capitalize">{session.type}</span>
          <span className="text-xs text-gray-400">·</span>
          <span className="text-xs text-gray-500">{dateStr}</span>
        </div>
        {session.notes && (
          <p className="text-xs text-gray-400 truncate mt-0.5">{session.notes}</p>
        )}
      </div>
      <span className="text-sm font-semibold text-court-700 shrink-0">{durationStr}</span>
      <button
        onClick={() => onDelete(session.id)}
        className="text-gray-300 hover:text-red-500 transition-colors ml-1 shrink-0"
        title="Delete session"
      >
        ✕
      </button>
    </li>
  )
}

function StatCard({
  emoji,
  label,
  value,
  highlight,
  tooltip,
}: {
  emoji: string
  label: string
  value: string
  highlight?: 'red' | 'amber'
  tooltip?: string
}) {
  const bg = highlight === 'red'
    ? 'border-red-200 bg-red-50'
    : highlight === 'amber'
    ? 'border-amber-200 bg-amber-50'
    : ''
  const textColor = highlight === 'red'
    ? 'text-red-600'
    : highlight === 'amber'
    ? 'text-amber-600'
    : 'text-gray-900'
  return (
    <div className={`card p-4 ${bg} ${tooltip ? 'relative group cursor-default' : ''}`}>
      <div className="text-2xl mb-1">{emoji}</div>
      <div className={`text-xl font-bold ${textColor}`}>{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
      {tooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 text-center leading-snug opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
          {tooltip}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  )
}
