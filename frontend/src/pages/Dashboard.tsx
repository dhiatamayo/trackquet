import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import {
  Plus, Target, AlertTriangle, Clock, Trophy,
  BarChart3, Sparkles, Loader2,
} from 'lucide-react'
import { fetchRacquets, createRacquet, deleteRacquet, fetchMonthlyReport } from '../api/client'
import type { Racquet, MonthlyReport } from '../types'
import RacquetCard from '../components/RacquetCard'
import AddRacquetModal from '../components/AddRacquetModal'
import MonthlyReportModal from '../components/MonthlyReportModal'

export default function Dashboard() {
  const [racquets, setRacquets] = useState<Racquet[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)

  // Monthly report state
  const now = new Date()
  const [reportYear, setReportYear] = useState(now.getFullYear())
  const [reportMonth, setReportMonth] = useState(now.getMonth() + 1)
  const [report, setReport] = useState<MonthlyReport | null>(null)
  const [reportLoading, setReportLoading] = useState(false)

  const load = () => {
    fetchRacquets()
      .then(setRacquets)
      .catch(() => toast.error('Failed to load racquets'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const handleSave = async (data: {
    name: string
    brand: string
    year: number
    headSize: number
    weight: number
    stringName: string
    gauge: string
    crossStringName: string
    crossGauge: string
    mainTension: number
    crossTension: number
    thresholdHours: number
  }) => {
    setSaving(true)
    try {
      await createRacquet({
        name: data.name,
        brand: data.brand,
        year: data.year,
        head_size: data.headSize,
        weight: data.weight,
        string_name: data.stringName,
        gauge: data.gauge,
        cross_string_name: data.crossStringName,
        cross_gauge: data.crossGauge,
        main_tension: data.mainTension,
        cross_tension: data.crossTension,
        threshold_hours: data.thresholdHours,
      })
      toast.success('Racquet added!')
      setShowAdd(false)
      load()
    } catch {
      toast.error('Failed to add racquet')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this racquet and all its sessions?')) return
    try {
      await deleteRacquet(id)
      toast.success('Racquet deleted')
      setRacquets((prev) => prev.filter((r) => r.id !== id))
    } catch {
      toast.error('Failed to delete racquet')
    }
  }

  const handleGenerateReport = async () => {
    setReportLoading(true)
    try {
      const data = await fetchMonthlyReport(reportYear, reportMonth)
      setReport(data)
    } catch {
      toast.error('Failed to generate report')
    } finally {
      setReportLoading(false)
    }
  }

  const MONTH_NAMES = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
  ]

  const yearOptions = Array.from({ length: 4 }, (_, i) => now.getFullYear() - i)
  const needRestringCount = racquets.filter((r) => r.needs_restring).length
  const totalHours = racquets.reduce((s, r) => s + (r.lifetime_hours ?? r.total_hours), 0)
  const mostUsed = [...racquets].sort((a, b) => b.total_minutes - a.total_minutes)[0]?.name ?? '—'

  return (
    <div>
      {/* Page header */}
      <div className="flex items-end justify-between mb-6 gap-4">
        <div>
          <h1 className="text-h1 text-ink-900">My Racquets</h1>
          <p className="text-caption text-ink-500 mt-1">
            Track string usage and restringing schedule
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4" />
          Add Racquet
        </button>
      </div>

      {/* Stats summary */}
      {racquets.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard label="Total Racquets" value={String(racquets.length)} icon={Target} />
          <StatCard
            label="Need Restring"
            value={String(needRestringCount)}
            icon={AlertTriangle}
            highlight={needRestringCount > 0}
          />
          <StatCard label="Total Hours" value={`${totalHours.toFixed(1)}h`} icon={Clock} />
          <StatCard label="Most Used" value={mostUsed} icon={Trophy} compact />
        </div>
      )}

      {/* ── Monthly Report Panel ── on-system, no more indigo/purple slop ── */}
      <div className="card p-5 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3 flex-1">
            <span className="flex h-11 w-11 items-center justify-center rounded-control bg-court-50 text-court-600 ring-1 ring-court-100">
              <BarChart3 className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-h2 text-ink-900">Monthly Report</h2>
              <p className="text-caption text-ink-500 mt-0.5">
                Generate a shareable story card of your monthly stats
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              className="select"
              value={reportMonth}
              onChange={(e) => setReportMonth(Number(e.target.value))}
            >
              {MONTH_NAMES.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>

            <select
              className="select tnum"
              value={reportYear}
              onChange={(e) => setReportYear(Number(e.target.value))}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            <button onClick={handleGenerateReport} disabled={reportLoading} className="btn-primary">
              {reportLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Generate
            </button>
          </div>
        </div>
      </div>

      {/* Racquet grid */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-ink-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-caption">Loading…</span>
        </div>
      ) : racquets.length === 0 ? (
        <div className="card flex flex-col items-center text-center py-16 px-6">
          <span className="flex h-14 w-14 items-center justify-center rounded-card bg-court-50 text-court-600 ring-1 ring-court-100 mb-4">
            <Target className="h-7 w-7" />
          </span>
          <p className="text-h2 text-ink-900">No racquets yet</p>
          <p className="text-caption text-ink-500 mt-1">
            Add your first racquet to start tracking string usage.
          </p>
          <button className="btn-primary mt-6" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4" />
            Add Your First Racquet
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {racquets.map((r) => (
            <RacquetCard key={r.id} racquet={r} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {showAdd && (
        <AddRacquetModal onClose={() => setShowAdd(false)} onSave={handleSave} loading={saving} />
      )}

      {report && <MonthlyReportModal report={report} onClose={() => setReport(null)} />}
    </div>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
  highlight,
  compact,
}: {
  label: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  highlight?: boolean
  compact?: boolean
}) {
  return (
    <div className={`card p-4 ${highlight ? 'border-red-200 bg-red-50' : ''}`}>
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-control mb-2 ${
          highlight ? 'bg-red-100 text-red-600' : 'bg-ink-100 text-ink-500'
        }`}
      >
        <Icon className="h-4 w-4" />
      </span>
      {compact ? (
        <div
          className={`flex items-center text-body font-bold leading-tight line-clamp-2 min-h-[2.25rem] ${highlight ? 'text-red-600' : 'text-ink-900'}`}
          title={value}
        >
          {value}
        </div>
      ) : (
        <div className={`flex items-center stat-value truncate min-h-[2.25rem] ${highlight ? 'text-red-600' : ''}`}>{value}</div>
      )}
      <div className="stat-label mt-0.5">{label}</div>
    </div>
  )
}
