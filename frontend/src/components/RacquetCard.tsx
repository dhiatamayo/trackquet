import { Link } from 'react-router-dom'
import { Link2, Gauge, Calendar, Target, Weight, Trash2, AlertTriangle } from 'lucide-react'
import type { Racquet } from '../types'
import UsageBar from './UsageBar'

interface Props {
  racquet: Racquet
  onDelete: (id: number) => void
}

export default function RacquetCard({ racquet, onDelete }: Props) {
  const hours = racquet.total_hours.toFixed(1)
  const threshold = racquet.threshold_hours

  return (
    <div
      className={`card-interactive p-5 flex flex-col gap-4 ${
        racquet.needs_restring ? 'border-red-200 ring-1 ring-red-100' : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-h2 text-ink-900 leading-tight truncate">{racquet.name}</h3>
          {racquet.brand && <p className="text-caption text-ink-500 mt-0.5">{racquet.brand}</p>}
        </div>
        {racquet.needs_restring && (
          <span className="badge-alert shrink-0">
            <AlertTriangle className="h-3 w-3" />
            Restring
          </span>
        )}
      </div>

      {/* Specs */}
      <div className="flex flex-wrap gap-1.5">
        {racquet.string_name && (
          <span className="chip-brand">
            <Link2 className="h-3.5 w-3.5" />
            {racquet.string_name}
            {racquet.gauge ? ` · ${racquet.gauge}` : ''}
          </span>
        )}
        {racquet.main_tension > 0 && (
          <span className="chip tnum">
            <Gauge className="h-3.5 w-3.5 text-ink-400" />
            {racquet.main_tension}/{racquet.cross_tension} lbs
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

      {/* Usage */}
      <div className="space-y-1">
        <UsageBar percent={racquet.usage_percent} needsRestring={racquet.needs_restring} />
        <p className="text-caption text-ink-400 text-right tnum">
          {hours}h / {threshold}h threshold
        </p>
      </div>

      {/* Suggestion */}
      <p className="text-caption text-ink-600">{racquet.restring_suggestion}</p>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-3 border-t border-ink-100">
        <Link to={`/racquets/${racquet.id}`} className="btn-primary flex-1">
          View Details
        </Link>
        <button
          onClick={() => onDelete(racquet.id)}
          className="btn-icon hover:text-red-600 hover:bg-red-50"
          title="Delete racquet"
          aria-label="Delete racquet"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
