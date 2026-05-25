import { useState, useEffect } from 'react'
import type { StringPreset } from '../types'
import { fetchStringPresets } from '../api/client'

interface Props {
  onClose: () => void
  onSave: (data: {
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
  }) => void
  loading?: boolean
}

const GAUGES = ['15', '15L', '16', '16L', '17', '17L', '18'] as const

const GAUGE_DEFAULTS: Record<string, number> = {
  '15': 25, '15L': 22, '16': 20, '16L': 18, '17': 16, '17L': 14, '18': 12,
}

export default function AddRacquetModal({ onClose, onSave, loading }: Props) {
  const [name, setName] = useState('')
  const [brand, setBrand] = useState('')
  const [year, setYear] = useState('')
  const [headSize, setHeadSize] = useState('')
  const [weight, setWeight] = useState('')
  const [stringName, setStringName] = useState('')
  const [customString, setCustomString] = useState('')
  const [gauge, setGauge] = useState('')
  const [mainTension, setMainTension] = useState('')
  const [crossTension, setCrossTension] = useState('')
  const [thresholdHours, setThresholdHours] = useState('')
  const [presets, setPresets] = useState<StringPreset[]>([])
  const [autoThreshold, setAutoThreshold] = useState(0)

  useEffect(() => {
    fetchStringPresets().then(setPresets).catch(() => {})
  }, [])

  const handleStringChange = (val: string) => {
    setStringName(val)
    const preset = presets.find((p) => p.name === val)
    if (preset) {
      setAutoThreshold(preset.threshold_hours)
      if (!thresholdHours) setThresholdHours(String(preset.threshold_hours))
    }
  }

  const handleGaugeChange = (val: string) => {
    setGauge(val)
    if (val && !thresholdHours) {
      const gaugeDefault = GAUGE_DEFAULTS[val]
      if (gaugeDefault) setAutoThreshold(gaugeDefault)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const gaugeDefault = gauge ? (GAUGE_DEFAULTS[gauge] ?? 20) : 0
    onSave({
      name,
      brand,
      year: parseInt(year) || 0,
      headSize: parseFloat(headSize) || 0,
      weight: parseFloat(weight) || 0,
      stringName: stringName === '__custom__' ? customString : stringName,
      gauge,
      mainTension: parseFloat(mainTension) || 0,
      crossTension: parseFloat(crossTension) || 0,
      thresholdHours: parseInt(thresholdHours) || autoThreshold || gaugeDefault || 20,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 overflow-y-auto py-8">
      <div className="card w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold">Add New Racquet</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl">×</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="label">Racquet Name *</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Wilson Pro Staff 97"
              required
            />
          </div>

          {/* Brand & Year */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Brand</label>
              <input
                className="input"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g. Wilson"
              />
            </div>
            <div>
              <label className="label">Year / Version</label>
              <input
                type="number"
                className="input"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder={String(new Date().getFullYear())}
                min="1980"
                max={new Date().getFullYear() + 1}
              />
            </div>
          </div>

          {/* Head size & weight */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Head Size (in²)</label>
              <input
                type="number"
                className="input"
                value={headSize}
                onChange={(e) => setHeadSize(e.target.value)}
                placeholder="97"
                min="50"
                max="140"
              />
            </div>
            <div>
              <label className="label">Weight (g)</label>
              <input
                type="number"
                className="input"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="315"
                min="200"
                max="500"
              />
            </div>
          </div>

          {/* String name */}
          <div>
            <label className="label">String</label>
            <select
              className="input"
              value={stringName}
              onChange={(e) => handleStringChange(e.target.value)}
            >
              <option value="">Select a string (optional)</option>
              {presets.map((p) => (
                <option key={p.id} value={p.name}>
                  {p.name} ({p.brand}) — {p.threshold_hours}h threshold
                </option>
              ))}
              <option value="__custom__">Custom / Other…</option>
            </select>
          </div>

          {stringName === '__custom__' && (
            <div>
              <label className="label">Custom String Name</label>
              <input
                className="input"
                value={customString}
                onChange={(e) => setCustomString(e.target.value)}
                placeholder="e.g. Dunlop Black Widow"
              />
            </div>
          )}

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
                Gauge {gauge} → suggested threshold: {GAUGE_DEFAULTS[gauge]}h
              </p>
            )}
          </div>

          {/* Main & Cross Tension */}
          <div>
            <label className="label">String Tension (lbs)</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <input
                  type="number"
                  className="input"
                  value={mainTension}
                  onChange={(e) => setMainTension(e.target.value)}
                  placeholder="Main (e.g. 52)"
                  min="20"
                  max="80"
                  step="0.5"
                />
                <p className="text-xs text-gray-400 mt-1 text-center">Main</p>
              </div>
              <div>
                <input
                  type="number"
                  className="input"
                  value={crossTension}
                  onChange={(e) => setCrossTension(e.target.value)}
                  placeholder="Cross (e.g. 50)"
                  min="20"
                  max="80"
                  step="0.5"
                />
                <p className="text-xs text-gray-400 mt-1 text-center">Cross</p>
              </div>
            </div>
          </div>

          {/* Threshold */}
          <div>
            <label className="label">
              Restring Threshold (hours)
              {(autoThreshold > 0 || (gauge && !thresholdHours)) && !thresholdHours && (
                <span className="ml-1 text-court-600 text-xs">
                  (auto: {autoThreshold || GAUGE_DEFAULTS[gauge] || 20}h)
                </span>
              )}
            </label>
            <input
              type="number"
              className="input"
              value={thresholdHours}
              onChange={(e) => setThresholdHours(e.target.value)}
              placeholder={String(autoThreshold || 20)}
              min="1"
              max="200"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn-primary flex-1" disabled={loading}>
              {loading ? 'Saving…' : 'Add Racquet'}
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
