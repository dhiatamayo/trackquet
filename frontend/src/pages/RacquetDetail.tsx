import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import {
  Plus, Link2, Gauge, Calendar, Target, Weight, RefreshCw,
  Hourglass, ClipboardList, AlertTriangle, Zap, CheckCircle2,
  User, Users, Trophy, Dumbbell, ChevronDown, ChevronUp, X,
  type LucideIcon,
} from 'lucide-react'
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
import SessionDetailModal from '../components/SessionDetailModal'

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
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)

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
    matchResult?: 'win' | 'loss' | ''
    matchScore?: string
    opponentRacquet?: string
    matchType?: 'singles' | 'doubles'
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
        match_result: data.matchResult,
        match_score: data.matchScore,
        opponent_racquet: data.opponentRacquet,
        match_type: data.matchType,
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
      toast.success('Racquet restrung — counter reset!')
      fetchStringRecords(Number(id)).then(setStringRecords).catch(() => {})
    } catch {
      toast.error('Failed to restring')
    }
  }

  if (loading) {
    return <div className="text-center py-16 text-caption text-ink-400">Loading…</div>
  }

  if (!racquet) return null

  const sessions: Session[] = racquet.sessions ?? []
  const lifetimeHours = stringRecords.reduce((s, r) => s + r.total_minutes, 0) / 60

  const stringStatus = racquet.needs_restring
    ? { icon: AlertTriangle, label: 'Restring!', tone: 'red' as const }
    : racquet.usage_percent >= 85
    ? { icon: Zap, label: 'Declining', tone: 'amber' as const }
    : { icon: CheckCircle2, label: 'Good', tone: undefined }

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className={`card p-6 ${racquet.needs_restring ? 'border-red-200 ring-1 ring-red-100' : ''}`}>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-h1 text-ink-900">{racquet.name}</h1>
            {racquet.brand && <p className="text-body text-ink-500">{racquet.brand}</p>}

            <div className="flex flex-wrap gap-1.5 mt-3">
              {racquet.string_name && (
                <span className="chip-brand">
                  <Link2 className="h-3.5 w-3.5" />
                  {displayStringName(racquet.string_name, racquet.gauge, racquet.cross_string_name, racquet.cross_gauge)}
                </span>
              )}
              {racquet.main_tension > 0 && (
                <span className="chip tnum">
                  <Gauge className="h-3.5 w-3.5 text-ink-400" />
                  {racquet.main_tension}/{racquet.cross_tension} lbs M/C
                </span>
              )}
              {racquet.year > 0 && (
                <span className="chip tnum">
                  <Calendar className="h-3.5 w-3.5 text-ink-400" />
                  {racquet.year}
                </span>
              )}
              {racquet.head_size > 0 && (
                <span className="chip tnum">
                  <Target className="h-3.5 w-3.5 text-ink-400" />
                  {racquet.head_size} in²
                </span>
              )}
              {racquet.weight > 0 && (
                <span className="chip tnum">
                  <Weight className="h-3.5 w-3.5 text-ink-400" />
                  {racquet.weight}g
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-2 shrink-0">
            <button className="btn-primary" onClick={() => setShowLog(true)}>
              <Plus className="h-4 w-4" />
              Log Session
            </button>
            <button
              className={racquet.needs_restring ? 'btn-danger' : 'btn-secondary'}
              onClick={() => setShowRestring(true)}
              title="Mark as restrung (resets counter)"
            >
              <RefreshCw className="h-4 w-4" />
              Restring
            </button>
          </div>
        </div>
      </div>

      {/* Usage stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon={Link2} label="String Hours" value={`${racquet.total_hours.toFixed(1)}h`} tooltip="Hours on the current string setup" />
        <StatCard icon={Hourglass} label="Racquet Total" value={`${lifetimeHours.toFixed(1)}h`} tooltip="Total play time across all string setups" />
        <StatCard icon={Target} label="Threshold" value={`${racquet.threshold_hours}h`} />
        <StatCard icon={ClipboardList} label="Sessions" value={String(sessions.length)} />
        <StatCard
          icon={stringStatus.icon}
          label="String Status"
          value={stringStatus.label}
          highlight={stringStatus.tone}
          tooltip={
            racquet.needs_restring
              ? 'Generally a big drop in performance — time to restring.'
              : racquet.usage_percent >= 85
              ? 'Expect a slight drop in performance as tension fades.'
              : 'Most likely maintaining full string performance.'
          }
        />
        <StatCard
          icon={User}
          label="Singles"
          value={racquet.total_matches_singles > 0 ? `${racquet.win_ratio_singles.toFixed(0)}%` : '—'}
          highlight={racquet.total_matches_singles > 0 && racquet.win_ratio_singles < 40 ? 'red' : undefined}
          tooltip={
            racquet.total_matches_singles > 0
              ? `${racquet.win_matches_singles}W / ${racquet.total_matches_singles - racquet.win_matches_singles}L across ${racquet.total_matches_singles} match${racquet.total_matches_singles !== 1 ? 'es' : ''}`
              : 'No singles matches logged yet'
          }
        />
        <StatCard
          icon={Users}
          label="Doubles"
          value={racquet.total_matches_doubles > 0 ? `${racquet.win_ratio_doubles.toFixed(0)}%` : '—'}
          highlight={racquet.total_matches_doubles > 0 && racquet.win_ratio_doubles < 40 ? 'red' : undefined}
          tooltip={
            racquet.total_matches_doubles > 0
              ? `${racquet.win_matches_doubles}W / ${racquet.total_matches_doubles - racquet.win_matches_doubles}L across ${racquet.total_matches_doubles} match${racquet.total_matches_doubles !== 1 ? 'es' : ''}`
              : 'No doubles matches logged yet'
          }
        />
      </div>

      {/* Usage bar */}
      <div className="card p-5">
        <div className="mb-3">
          <h2 className="text-h2 text-ink-900">String Usage</h2>
          <p className="text-caption text-ink-500 mt-1">{racquet.restring_suggestion}</p>
        </div>
        <UsageBar percent={racquet.usage_percent} needsRestring={racquet.needs_restring} />
        <p className="text-caption text-ink-400 mt-2 tnum">
          {racquet.total_hours.toFixed(1)}h on current strings out of {racquet.threshold_hours}h threshold
          {lifetimeHours > racquet.total_hours && (
            <span className="ml-2 text-ink-300">· {lifetimeHours.toFixed(1)}h total on this racquet</span>
          )}
        </p>
      </div>

      {/* Sessions list */}
      <div className="card">
        <div className="flex items-center justify-between p-5 border-b border-ink-100">
          <h2 className="text-h2 text-ink-900">Session History</h2>
          <button className="btn-secondary" onClick={() => setShowLog(true)}>
            <Plus className="h-4 w-4" />
            Log
          </button>
        </div>

        {sessions.length === 0 ? (
          <div className="flex flex-col items-center text-center py-12 text-ink-400">
            <ClipboardList className="h-8 w-8 mb-2 text-ink-300" />
            <p className="text-caption">No sessions logged yet.</p>
          </div>
        ) : (
          <ul className="divide-y divide-ink-100">
            {[...sessions]
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .map((s) => (
                <SessionRow key={s.id} session={s} onDelete={handleDeleteSession} onView={setSelectedSession} />
              ))}
          </ul>
        )}
      </div>

      {/* String History */}
      {stringRecords.length > 0 && (
        <div className="card">
          <div className="p-5 border-b border-ink-100">
            <h2 className="text-h2 text-ink-900">String History</h2>
          </div>
          <ul className="divide-y divide-ink-100">
            {stringRecords.map((rec, i) => {
              const isActive = !rec.ended_at
              const isExpanded = expandedRecord === rec.id
              const recHours = rec.total_minutes / 60
              const totalHours = recHours.toFixed(1)
              const usagePct = rec.threshold_hours > 0 ? Math.min(100, (recHours / rec.threshold_hours) * 100) : null
              const startDate = (() => { try { return format(new Date(rec.started_at), 'MMM d, yyyy') } catch { return rec.started_at } })()
              const endDate = rec.ended_at ? (() => { try { return format(new Date(rec.ended_at), 'MMM d, yyyy') } catch { return rec.ended_at } })() : null
              const usageColor = usagePct === null ? 'text-ink-400' : usagePct >= 100 ? 'text-red-600' : usagePct >= 85 ? 'text-amber-600' : 'text-court-600'
              return (
                <li key={rec.id}>
                  <button
                    className="w-full text-left px-5 py-4 hover:bg-ink-50 flex items-center justify-between gap-3 transition-colors"
                    onClick={() => setExpandedRecord(isExpanded ? null : rec.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isActive && <span className="chip-brand py-0.5">Active</span>}
                        {i === 0 && !isActive && <span className="chip py-0.5">Latest</span>}
                        <span className="font-medium text-caption text-ink-900">{displayStringName(rec.string_name, rec.gauge, rec.cross_string_name, rec.cross_gauge) || 'Unknown String'}</span>
                        {usagePct !== null && (
                          <span className={`text-caption font-semibold tnum ${usageColor}`}>
                            {usagePct.toFixed(0)}% · {totalHours}h/{rec.threshold_hours}h
                          </span>
                        )}
                      </div>
                      <div className="text-caption text-ink-500 mt-1 tnum">
                        {rec.main_tension > 0 && <span>{rec.main_tension}/{rec.cross_tension} lbs · </span>}
                        {rec.gauge && <span>gauge {rec.gauge} · </span>}
                        <span>{startDate}{endDate ? ` → ${endDate}` : ' → now'} · {rec.sessions?.length ?? 0} sessions</span>
                      </div>
                    </div>
                    {isExpanded
                      ? <ChevronUp className="h-4 w-4 text-ink-400 shrink-0" />
                      : <ChevronDown className="h-4 w-4 text-ink-400 shrink-0" />}
                  </button>
                  {isExpanded && rec.sessions && rec.sessions.length > 0 && (
                    <ul className="bg-ink-50 divide-y divide-ink-100 border-t border-ink-100">
                      {rec.sessions.map((s) => {
                        const sDate = (() => { try { return format(new Date(s.date), 'MMM d, yyyy') } catch { return s.date } })()
                        const h = Math.floor(s.duration_min / 60), m = s.duration_min % 60
                        const dur = h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`
                        return (
                          <li
                            key={s.id}
                            className="flex items-center gap-3 px-8 py-2.5 text-caption hover:bg-ink-100 cursor-pointer transition-colors"
                            onClick={() => setSelectedSession(s)}
                          >
                            {s.type === 'match'
                              ? <Trophy className="h-4 w-4 text-court-500 shrink-0" />
                              : <Dumbbell className="h-4 w-4 text-ink-400 shrink-0" />}
                            <div className="flex-1 min-w-0">
                              <span className="text-ink-800 font-medium">{s.name || s.type}</span>
                              <span className="text-ink-400 ml-2">{sDate}</span>
                              {s.match_result && (
                                <span className={`ml-2 font-semibold ${s.match_result === 'win' ? 'text-court-600' : 'text-red-500'}`}>
                                  {s.match_result === 'win' ? 'W' : 'L'}
                                  {s.match_score && ` ${s.match_score}`}
                                </span>
                              )}
                              {s.notes && <p className="text-ink-400 truncate">{s.notes}</p>}
                            </div>
                            <span className="text-court-700 font-semibold shrink-0 tnum">{dur}</span>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                  {isExpanded && (!rec.sessions || rec.sessions.length === 0) && (
                    <p className="text-caption text-ink-400 px-8 py-3 bg-ink-50">No sessions in this period.</p>
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

      {selectedSession && (
        <SessionDetailModal
          session={selectedSession}
          racquetId={Number(id)}
          onClose={() => setSelectedSession(null)}
          onUpdated={() => {
            setSelectedSession(null)
            load()
          }}
        />
      )}
    </div>
  )
}

function SessionRow({ session, onDelete, onView }: { session: Session; onDelete: (id: number) => void; onView: (s: Session) => void }) {
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
    <li
      className="flex items-center gap-4 px-5 py-3 hover:bg-ink-50 cursor-pointer transition-colors group"
      onClick={() => onView(session)}
    >
      <span className={`flex h-9 w-9 items-center justify-center rounded-control shrink-0 ${session.type === 'match' ? 'bg-court-50 text-court-600' : 'bg-ink-100 text-ink-500'}`}>
        {session.type === 'match' ? <Trophy className="h-4 w-4" /> : <Dumbbell className="h-4 w-4" />}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-caption capitalize text-ink-800">{session.name || session.type}</span>
          <span className="text-ink-300">·</span>
          <span className="text-caption text-ink-500 capitalize">{session.type}</span>
          {session.type === 'match' && session.match_type && (
            <>
              <span className="text-ink-300">·</span>
              <span className="text-caption text-court-600 font-medium capitalize">{session.match_type}</span>
            </>
          )}
          <span className="text-ink-300">·</span>
          <span className="text-caption text-ink-500">{dateStr}</span>
          {session.match_result && (
            <span className={`text-caption font-semibold ${session.match_result === 'win' ? 'text-court-600' : 'text-red-500'}`}>
              {session.match_result === 'win' ? 'W' : 'L'}
              {session.match_score && ` · ${session.match_score}`}
            </span>
          )}
        </div>
        {session.notes && (
          <p className="text-caption text-ink-400 truncate mt-0.5">{session.notes}</p>
        )}
      </div>
      <span className="text-caption font-semibold text-court-700 shrink-0 tnum">{durationStr}</span>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(session.id) }}
        className="text-ink-300 hover:text-red-500 transition-colors ml-1 shrink-0 opacity-0 group-hover:opacity-100"
        title="Delete session"
        aria-label="Delete session"
      >
        <X className="h-4 w-4" />
      </button>
    </li>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  highlight,
  tooltip,
}: {
  icon: LucideIcon
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
  const iconTone = highlight === 'red'
    ? 'bg-red-100 text-red-600'
    : highlight === 'amber'
    ? 'bg-amber-100 text-amber-600'
    : 'bg-ink-100 text-ink-500'
  const textColor = highlight === 'red'
    ? 'text-red-600'
    : highlight === 'amber'
    ? 'text-amber-600'
    : 'text-ink-900'
  return (
    <div className={`card p-4 ${bg} ${tooltip ? 'relative group cursor-default' : ''}`}>
      <span className={`flex h-8 w-8 items-center justify-center rounded-control mb-2 ${iconTone}`}>
        <Icon className="h-4 w-4" />
      </span>
      <div className={`text-h2 font-bold tnum ${textColor}`}>{value}</div>
      <div className="stat-label mt-0.5">{label}</div>
      {tooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 bg-ink-900 text-white text-caption rounded-control px-3 py-2 text-center leading-snug opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
          {tooltip}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-ink-900" />
        </div>
      )}
    </div>
  )
}
