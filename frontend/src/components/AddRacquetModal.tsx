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
    crossStringName: string
    crossGauge: string
    mainTension: number
    crossTension: number
    thresholdHours: number
  }) => void
  loading?: boolean
}

const GAUGES = ['15', '15L', '16', '16L', '17', '17L', '18', 'Unknown'] as const

const GAUGE_DEFAULTS: Record<string, number> = {
  '15': 25, '15L': 22, '16': 20, '16L': 18, '17': 16, '17L': 14, '18': 12, 'Unknown': 20,
}

function hybridThreshold(mainGauge: string, crossGauge: string): number {
  const m = GAUGE_DEFAULTS[mainGauge] ?? 20
  const c = GAUGE_DEFAULTS[crossGauge] ?? 20
  return Math.round(m * 0.55 + c * 0.45)
}

export default function AddRacquetModal({ onClose, onSave, loading }: Props) {
  const [name, setName] = useState('')
  const [brand, setBrand] = useState('')
  const [year, setYear] = useState('')
  const [headSize, setHeadSize] = useState('')
  const [weight, setWeight] = useState('')
  // Main string
  const [stringName, setStringName] = useState('')
  const [customString, setCustomString] = useState('')
  const [gauge, setGauge] = useState('')
  // Cross string (hybrid)
  const [isHybrid, setIsHybrid] = useState(false)
  const [crossStringName, setCrossStringName] = useState('')
  const [customCrossString, setCustomCrossString] = useState('')
  const [crossGauge, setCrossGauge] = useState('')
  // Tensions & threshold
  const [mainTension, setMainTension] = useState('')
  const [crossTension, setCrossTension] = useState('')
  const [thresholdHours, setThresholdHours] = useState('')
  const [presets, setPresets] = useState<StringPreset[]>([])

  useEffect(() => {
    fetchStringPresets().then(setPresets).catch(() => {})
  }, [])

  // Auto-compute threshold whenever gauge/hybrid/crossGauge changes
  const autoThreshold = (() => {
    if (isHybrid && gauge && crossGauge) return hybridThreshold(gauge, crossGauge)
    if (gauge) return GAUGE_DEFAULTS[gauge] ?? 20
    const preset = presets.find((p) => p.name === (stringName === '__custom__' ? '' : stringName))
    return preset?.threshold_hours ?? 20
  })()

  const handleStringChange = (val: string) => {
    setStringName(val)
    if (val !== '__custom__') {
      const preset = presets.find((p) => p.name === val)
      if (preset && !thresholdHours) setThresholdHours(String(preset.threshold_hours))
    }
  }

  const handleGaugeChange = (val: string) => {
    setGauge(val === gauge ? '' : val)
    setThresholdHours('') // let auto-threshold recalculate
  }

  const handleCrossGaugeChange = (val: string) => {
    setCrossGauge(val === crossGauge ? '' : val)
    setThresholdHours('')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const mainStr = stringName === '__custom__' ? customString : stringName
    const crossStr = isHybrid ? (crossStringName === '__custom__' ? customCrossString : crossStringName) : ''
    const cg = isHybrid ? crossGauge : ''
    const finalThreshold = parseInt(thresholdHours) || autoThreshold
    onSave({
      name,
      brand,
      year: parseInt(year) || 0,
      headSize: parseFloat(headSize) || 0,
      weight: parseFloat(weight) || 0,
      stringName: mainStr,
      gauge,
      crossStringName: crossStr,
      crossGauge: cg,
      mainTension: parseFloat(mainTension) || 0,
      crossTension: parseFloat(crossTension) || 0,
      thresholdHours: finalThreshold,
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

          {/* Hybrid toggle */}
          <div className="flex items-center gap-3 py-1">
            <button
              type="button"
              onClick={() => { setIsHybrid(!isHybrid); setThresholdHours('') }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isHybrid ? 'bg-court-600' : 'bg-gray-200'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isHybrid ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
            <span className="text-sm font-medium text-gray-700">Hybrid setup (two different strings)</span>
          </div>

          {/* Main string */}
          <div className="rounded-xl border border-gray-200 p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{isHybrid ? 'Main Strings' : 'String'}</p>
            <div>
              <label className="label">String Name</label>
              <select className="input" value={stringName} onChange={(e) => handleStringChange(e.target.value)}>
                <option value="">Select a string (optional)</option>
                {presets.map((p) => (
                  <option key={p.id} value={p.name}>{p.name} ({p.brand}) — {p.threshold_hours}h</option>
                ))}
                <option value="__custom__">Custom / Other…</option>
              </select>
            </div>
            {stringName === '__custom__' && (
              <input className="input" value={customString} onChange={(e) => setCustomString(e.target.value)} placeholder="e.g. Dunlop Black Widow" />
            )}
            <div>
              <label className="label">Gauge</label>
              <div className="flex flex-wrap gap-2">
                {GAUGES.map((g) => (
                  <button key={g} type="button" onClick={() => handleGaugeChange(g)}
                    className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${gauge === g ? 'bg-court-600 text-white border-court-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
                    {g}
                    {gauge !== g && <span className="ml-1 text-xs opacity-60">{GAUGE_DEFAULTS[g]}h</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Cross string (hybrid only) */}
          {isHybrid && (
            <div className="rounded-xl border border-court-200 bg-court-50/40 p-4 space-y-3">
              <p className="text-xs font-semibold text-court-700 uppercase tracking-wide">Cross Strings</p>
              <div>
                <label className="label">String Name</label>
                <select className="input" value={crossStringName} onChange={(e) => { setCrossStringName(e.target.value); setThresholdHours('') }}>
                  <option value="">Select a string (optional)</option>
                  {presets.map((p) => (
                    <option key={p.id} value={p.name}>{p.name} ({p.brand}) — {p.threshold_hours}h</option>
                  ))}
                  <option value="__custom__">Custom / Other…</option>
                </select>
              </div>
              {crossStringName === '__custom__' && (
                <input className="input" value={customCrossString} onChange={(e) => setCustomCrossString(e.target.value)} placeholder="e.g. Babolat VS Touch" />
              )}
              <div>
                <label className="label">Gauge</label>
                <div className="flex flex-wrap gap-2">
                  {GAUGES.map((g) => (
                    <button key={g} type="button" onClick={() => handleCrossGaugeChange(g)}
                      className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${crossGauge === g ? 'bg-court-600 text-white border-court-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
                      {g}
                      {crossGauge !== g && <span className="ml-1 text-xs opacity-60">{GAUGE_DEFAULTS[g]}h</span>}
                    </button>
                  ))}
                </div>
              </div>
              {gauge && crossGauge && (
                <p className="text-xs text-court-700 font-medium">
                  ⚡ Hybrid threshold auto-set to {hybridThreshold(gauge, crossGauge)}h
                  <span className="text-gray-400 font-normal ml-1">(main {GAUGE_DEFAULTS[gauge]}h × 55% + cross {GAUGE_DEFAULTS[crossGauge]}h × 45%)</span>
                </p>
              )}
            </div>
          )}

          {/* Main & Cross Tension */}
          <div>
            <label className="label">String Tension (lbs)</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <input type="number" className="input" value={mainTension} onChange={(e) => setMainTension(e.target.value)} placeholder="Main (e.g. 52)" min="20" max="80" step="0.5" />
                <p className="text-xs text-gray-400 mt-1 text-center">Main</p>
              </div>
              <div>
                <input type="number" className="input" value={crossTension} onChange={(e) => setCrossTension(e.target.value)} placeholder="Cross (e.g. 50)" min="20" max="80" step="0.5" />
                <p className="text-xs text-gray-400 mt-1 text-center">Cross</p>
              </div>
            </div>
          </div>

          {/* Threshold */}
          <div>
            <label className="label">
              Restring Threshold (hours)
              {!thresholdHours && (
                <span className="ml-1 text-court-600 text-xs">(auto: {autoThreshold}h)</span>
              )}
            </label>
            <input
              type="number"
              className="input"
              value={thresholdHours}
              onChange={(e) => setThresholdHours(e.target.value)}
              placeholder={String(autoThreshold)}
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
