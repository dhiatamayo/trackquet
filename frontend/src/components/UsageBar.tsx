interface Props {
  percent: number
  needsRestring: boolean
}

export default function UsageBar({ percent, needsRestring }: Props) {
  const clamped = Math.min(percent, 100)

  let barColor = 'bg-court-500'
  if (clamped >= 100) barColor = 'bg-red-500'
  else if (clamped >= 85) barColor = 'bg-orange-400'
  else if (clamped >= 60) barColor = 'bg-yellow-400'

  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>String usage</span>
        <span className={needsRestring ? 'text-red-600 font-semibold' : ''}>
          {clamped.toFixed(0)}%
        </span>
      </div>
      <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  )
}
