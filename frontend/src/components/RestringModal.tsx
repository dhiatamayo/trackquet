import { useState } from 'react'
import type { RestringPayload } from '../types'

const GAUGES = ['15', '15L', '16', '16L', '17', '17L', '18', 'Unknown'] as const

const GAUGE_DEFAULTS: Record<string, number> = {
  '15': 25, '15L': 22, '16': 20, '16L': 18, '17': 16, '17L': 14, '18': 12, 'Unknown': 20,
}

function hybridThreshold(mainGauge: string, crossGauge: string): number {
  const m = GAUGE_DEFAULTS[mainGauge] ?? 20
  const c = GAUGE_DEFAULTS[crossGauge] ?? 20
  return Math.round(m * 0.55 + c * 0.45)
}

interface Props {
  currentStringName: string
  currentGauge: string
  currentCrossStringName?: string
  currentCrossGauge?: string
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
  currentCrossStringName = '',
  currentCrossGauge = '',
  currentMainTension,
  currentCrossTension,
  currentThreshold,
  onClose,
  onSave,
  loading,
}: Props) {
  const [stringName, setStringName] = useState(currentStringName)
  const [gauge, setGauge] = useState(currentGauge)
  const [isHybrid, setIsHybrid] = useState(!!currentCrossStringName)
  const [crossStringName, setCrossStringName] = useState(currentCrossStringName)
  const [crossGauge, setCrossGauge] = useState(currentCrossGauge)
  const [mainTension, setMainTension] = useState(String(currentMainTension))
  const [crossTension, setCrossTension] = useState(String(currentCrossTension))
  const [thresholdHours, setThresholdHours] = useState(String(currentThreshold))

  const autoThreshold = (() => {
    if (isHybrid && gauge && crossGauge) return hybridThreshold(gauge, crossGauge)
    if (gauge) return GAUGE_DEFAULTS[gauge] ?? 20
    return currentThreshold
  })()

  const handleGaugeChange = (g: string) => {
    setGauge(g === gauge ? '' : g)
    setThresholdHours('')
  }

  const handleCrossGaugeChange = (g: string) => {
    setCrossGauge(g === crossGauge ? '' : g)
    setThresholdHours('')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      string_name: stringName,
      gauge,
      cross_string_name: isHybrid ? crossStringName : '',
      cross_gauge: isHybrid ? crossGauge : '',
      main_tension: parseFloat(mainTension) || 0,
      cross_tension: parseFloat(crossTension) || 0,
      threshold_hours: parseInt(thresholdHours) || autoThreshold,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 overflow-y-auto py-8">
      <div className="card w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold">🔗 Restring Racquet</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl">×</button>
        </div>
        <p className="text-sm text-gray-500 mb-5">
          This will archive the current string session and reset the usage counter.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Hybrid toggle */}
          <div className="flex items-center gap-3 py-1">
            <button
              type="button"
              onClick={() => { setIsHybrid(!isHybrid); setCrossStringName(''); setCrossGauge(''); setThresholdHours('') }}
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
              <input className="input" value={stringName} onChange={(e) => setStringName(e.target.value)} placeholder="e.g. Luxilon ALU Power 125" />
            </div>
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
                <input className="input" value={crossStringName} onChange={(e) => setCrossStringName(e.target.value)} placeholder="e.g. Babolat VS Touch" />
              </div>
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

          {/* Tensions */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Main Tension (lbs)</label>
              <input type="number" className="input" value={mainTension} onChange={(e) => setMainTension(e.target.value)} min="0" step="0.5" />
            </div>
            <div>
              <label className="label">Cross Tension (lbs)</label>
              <input type="number" className="input" value={crossTension} onChange={(e) => setCrossTension(e.target.value)} min="0" step="0.5" />
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
            <input type="number" className="input" value={thresholdHours} onChange={(e) => setThresholdHours(e.target.value)} placeholder={String(autoThreshold)} min="1" step="1" />
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
