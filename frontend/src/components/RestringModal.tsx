import { useState } from 'react'
import type { RestringPayload } from '../types'

const GAUGES = ['15', '15L', '16', '16L', '17', '17L', '18'] as const

const GAUGE_DEFAULTS: Record<string, number> = {
  '15': 25, '15L': 22, '16': 20, '16L': 18, '17': 16, '17L': 14, '18': 12,
}

interface Props {
  currentStringName: string
  currentGauge: string
  currentMainTension: number
  currentCrossTension: number
  currentThreshold: number
  onClose: () => void
  onSave: (payload: RestringPayload) => void
  loading?: boolean
}

export default function RestringModal({
  currentStringName,
  currentGauge,
  currentMainTension,
  currentCrossTension,
  currentThreshold,
  onClose,
  onSave,
  loading,
}: Props) {
  const [stringName, setStringName] = useState(currentStringName)
  const [gauge, setGauge] = useState(currentGauge)
  const [mainTension, setMainTension] = useState(String(currentMainTension))
  const [crossTension, setCrossTension] = useState(String(currentCrossTension))
  const [thresholdHours, setThresholdHours] = useState(String(currentThreshold))

  const handleGaugeChange = (g: string) => {
    setGauge(g)
    // Auto-fill threshold when gauge changes and user hasn't manually set one
    const gaugeDefault = GAUGE_DEFAULTS[g]
    if (gaugeDefault) setThresholdHours(String(gaugeDefault))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      string_name: stringName,
      gauge,
      main_tension: parseFloat(mainTension) || 0,
      cross_tension: parseFloat(crossTension) || 0,
      threshold_hours: parseFloat(thresholdHours) || currentThreshold,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="card w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold">🔗 Restring Racquet</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl">×</button>
        </div>
        <p className="text-sm text-gray-500 mb-5">
          This will archive the current string session and reset the usage counter.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* String name */}
          <div>
            <label className="label">String Name</label>
            <input
              className="input"
              value={stringName}
              onChange={(e) => setStringName(e.target.value)}
              placeholder="e.g. Luxilon ALU Power 125"
            />
          </div>

          {/* Gauge */}
          <div>
            <label className="label">String Gauge</label>
            <div className="flex flex-wrap gap-2">
              {GAUGES.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => handleGaugeChange(gauge === g ? '' : g)}
                  className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                    gauge === g
                      ? 'bg-court-600 text-white border-court-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {g}
                  {GAUGE_DEFAULTS[g] && gauge !== g && (
                    <span className="ml-1 text-xs opacity-60">{GAUGE_DEFAULTS[g]}h</span>
                  )}
                </button>
              ))}
            </div>
            {gauge && (
              <p className="text-xs text-court-600 mt-1.5">
                Gauge {gauge} → threshold auto-set to {GAUGE_DEFAULTS[gauge]}h
              </p>
            )}
          </div>

          {/* Tensions */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Main Tension (lbs)</label>
              <input
                type="number"
                className="input"
                value={mainTension}
                onChange={(e) => setMainTension(e.target.value)}
                min="0"
                step="0.5"
              />
            </div>
            <div>
              <label className="label">Cross Tension (lbs)</label>
              <input
                type="number"
                className="input"
                value={crossTension}
                onChange={(e) => setCrossTension(e.target.value)}
                min="0"
                step="0.5"
              />
            </div>
          </div>

          {/* Threshold */}
          <div>
            <label className="label">Restring Threshold (hours)</label>
            <input
              type="number"
              className="input"
              value={thresholdHours}
              onChange={(e) => setThresholdHours(e.target.value)}
              min="1"
              step="1"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn-primary flex-1" disabled={loading}>
              {loading ? 'Saving…' : 'Confirm Restring'}
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
