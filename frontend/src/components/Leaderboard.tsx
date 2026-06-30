import type { LeaderboardEntry } from '../types'

interface Props {
  entries: LeaderboardEntry[]
  loading?: boolean
}

export default function Leaderboard({ entries, loading }: Props) {
  if (loading) {
    return (
      <div className="text-center py-8 text-gray-500">
        Loading standings...
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No standings yet
      </div>
    )
  }

  function formatDiff(diff: number): string {
    if (diff > 0) return `+${diff}`
    return `${diff}`
  }

  function rankStyle(rank: number): string {
    if (rank === 1) return 'bg-yellow-50 font-semibold'
    if (rank === 2) return 'bg-gray-50 font-semibold'
    if (rank === 3) return 'bg-orange-50 font-semibold'
    return ''
  }

  function rankBadge(rank: number): string {
    if (rank === 1) return '🥇'
    if (rank === 2) return '🥈'
    if (rank === 3) return '🥉'
    return `${rank}`
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-600">
            <th className="py-2 px-3 w-12">#</th>
            <th className="py-2 px-3">Player</th>
            <th className="py-2 px-3 text-right">Points</th>
            <th className="py-2 px-3 text-right">+/−</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr
              key={entry.player_id}
              className={`border-b border-gray-100 ${rankStyle(entry.rank)}`}
            >
              <td className="py-2 px-3 text-center">{rankBadge(entry.rank)}</td>
              <td className="py-2 px-3 text-gray-900">{entry.player_name}</td>
              <td className="py-2 px-3 text-right font-medium">{entry.total_points}</td>
              <td className={`py-2 px-3 text-right ${entry.point_diff > 0 ? 'text-green-600' : entry.point_diff < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                {formatDiff(entry.point_diff)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
