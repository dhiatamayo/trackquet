import { Link } from 'react-router-dom'
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
    <div className={`card p-5 flex flex-col gap-4 ${racquet.needs_restring ? 'border-red-300 bg-red-50' : ''}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-bold text-gray-900 text-lg leading-tight">{racquet.name}</h3>
          {racquet.brand && (
            <p className="text-sm text-gray-500">{racquet.brand}</p>
          )}
        </div>
        {racquet.needs_restring && (
          <span className="shrink-0 text-xs font-semibold bg-red-100 text-red-700 px-2 py-1 rounded-full">
            Restring!
          </span>
        )}
      </div>

      {/* String info */}
      <div className="flex flex-wrap gap-2 text-xs">
        {racquet.string_name && (
          <span className="bg-court-50 border border-court-200 text-court-800 px-2 py-1 rounded-full">
            🔗 {racquet.string_name}{racquet.gauge ? ` · ${racquet.gauge}` : ''}
          </span>
        )}
        {racquet.main_tension > 0 && (
          <span className="bg-gray-100 border border-gray-200 text-gray-700 px-2 py-1 rounded-full">
            ⚡ {racquet.main_tension}/{racquet.cross_tension} lbs
          </span>
        )}
        {racquet.year > 0 && (
          <span className="bg-gray-100 border border-gray-200 text-gray-700 px-2 py-1 rounded-full">
            📅 {racquet.year}
          </span>
        )}
        {racquet.head_size > 0 && (
          <span className="bg-gray-100 border border-gray-200 text-gray-700 px-2 py-1 rounded-full">
            🎯 {racquet.head_size} in²
          </span>
        )}
        {racquet.weight > 0 && (
          <span className="bg-gray-100 border border-gray-200 text-gray-700 px-2 py-1 rounded-full">
            ⚖️ {racquet.weight}g
          </span>
        )}
      </div>

      {/* Usage */}
      <div className="space-y-1">
        <UsageBar percent={racquet.usage_percent} needsRestring={racquet.needs_restring} />
        <p className="text-xs text-gray-500 text-right">
          {hours}h / {threshold}h threshold
        </p>
      </div>

      {/* Suggestion */}
      <p className="text-sm text-gray-600">{racquet.restring_suggestion}</p>

      {/* Actions */}
      <div className="flex gap-2 pt-1 border-t border-gray-100">
        <Link
          to={`/racquets/${racquet.id}`}
          className="btn-primary flex-1 text-center text-sm py-2"
        >
          View Details
        </Link>
        <button
          onClick={() => onDelete(racquet.id)}
          className="btn-secondary text-sm px-3"
          title="Delete racquet"
        >
          🗑️
        </button>
      </div>
    </div>
  )
}
