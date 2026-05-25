import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { fetchRacquets, createRacquet, deleteRacquet } from '../api/client'
import type { Racquet } from '../types'
import RacquetCard from '../components/RacquetCard'
import AddRacquetModal from '../components/AddRacquetModal'

export default function Dashboard() {
  const [racquets, setRacquets] = useState<Racquet[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)

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
