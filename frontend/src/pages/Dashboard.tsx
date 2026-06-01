import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
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

  // Build year options (3 years back from current)
  const yearOptions = Array.from({ length: 4 }, (_, i) => now.getFullYear() - i)

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Racquets</h1>
          <p className="text-sm text-gray-500 mt-1">Track string usage and restringing schedule</p>
        </div>
        <button className="btn-primary" onClick={() => setShowAdd(true)}>
          + Add Racquet
        </button>
      </div>

      {/* Stats summary */}
      {racquets.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Racquets" value={String(racquets.length)} emoji="🎾" />
          <StatCard
            label="Need Restring"
            value={String(racquets.filter((r) => r.needs_restring).length)}
            emoji="⚠️"
            highlight={racquets.some((r) => r.needs_restring)}
          />
          <StatCard
            label="Total Hours"
            value={racquets.reduce((s, r) => s + (r.lifetime_hours ?? r.total_hours), 0).toFixed(1) + 'h'}
            emoji="⏱️"
          />
          <StatCard
            label="Most Used"
            value={
              racquets.sort((a, b) => b.total_minutes - a.total_minutes)[0]?.name ?? '—'
            }
            emoji="🏆"
          />
        </div>
      )}

      {/* ── Monthly Report Panel ── */}
      <div className="card p-5 mb-8 bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Left: label */}
          <div className="flex items-center gap-3 flex-1">
            <div className="text-3xl">📊</div>
            <div>
              <h2 className="font-bold text-gray-900 text-base">Monthly Report</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Generate a shareable story card of your monthly stats
              </p>
            </div>
          </div>

          {/* Right: month/year selectors + button */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
              value={reportMonth}
              onChange={(e) => setReportMonth(Number(e.target.value))}
            >
              {MONTH_NAMES.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>

            <select
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
              value={reportYear}
              onChange={(e) => setReportYear(Number(e.target.value))}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            <button
              onClick={handleGenerateReport}
              disabled={reportLoading}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold disabled:opacity-60 transition-colors shadow-sm"
            >
              {reportLoading ? (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              ) : '✨'}
              Generate
            </button>
          </div>
        </div>
      </div>

      {/* Racquet grid */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading…</div>
      ) : racquets.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-5xl mb-4">🎾</p>
          <p className="text-gray-500 text-lg">No racquets yet.</p>
          <p className="text-gray-400 text-sm mt-1">Click "Add Racquet" to get started!</p>
          <button className="btn-primary mt-6" onClick={() => setShowAdd(true)}>
            + Add Your First Racquet
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {racquets.map((r) => (
            <RacquetCard
              key={r.id}
              racquet={r}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {showAdd && (
        <AddRacquetModal
          onClose={() => setShowAdd(false)}
          onSave={handleSave}
          loading={saving}
        />
      )}

      {report && (
        <MonthlyReportModal
          report={report}
          onClose={() => setReport(null)}
        />
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  emoji,
  highlight,
}: {
  label: string
  value: string
  emoji: string
  highlight?: boolean
}) {
  return (
    <div className={`card p-4 ${highlight ? 'border-red-200 bg-red-50' : ''}`}>
      <div className="text-2xl mb-1">{emoji}</div>
      <div className={`text-xl font-bold ${highlight ? 'text-red-600' : 'text-gray-900'}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  )
}
