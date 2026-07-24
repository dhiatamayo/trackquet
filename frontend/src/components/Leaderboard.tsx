import { useCallback } from 'react'
import toast from 'react-hot-toast'
import type { LeaderboardEntry } from '../types'

interface Props {
  entries: LeaderboardEntry[]
  loading?: boolean
  sessionName?: string
}

export default function Leaderboard({ entries, loading, sessionName }: Props) {
  const shareSupported = typeof navigator !== 'undefined' && !!navigator.share

  const generateShareText = useCallback(() => {
    if (entries.length === 0) return ''
    const title = sessionName ? `🏆 ${sessionName} — Leaderboard` : '🏆 Match Leaderboard'
    const lines = entries.map(
      (e) => `${rankBadge(e.rank)} ${e.player_name}: ${e.total_points} pts (${formatDiff(e.point_diff)}) — ${e.games_played} games`
    )
    return `${title}\n\n${lines.join('\n')}\n\n📊 Tracked with Trackquet`
  }, [entries, sessionName])

  const handleShare = async () => {
    const text = generateShareText()
    if (!text) return

    if (shareSupported) {
      try {
        await navigator.share({ title: 'Leaderboard', text })
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          await navigator.clipboard.writeText(text)
          toast.success('Copied to clipboard')
        }
      }
    } else {
      // Desktop: generate a PDF via print dialog
      handlePDF()
    }
  }

  const handlePDF = () => {
    // Generate a 1080x1920 (9:16) Instagram Story image using canvas
    const canvas = document.createElement('canvas')
    canvas.width = 1080
    canvas.height = 1920
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, 1920)
    grad.addColorStop(0, '#065f46')
    grad.addColorStop(1, '#064e3b')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 1080, 1920)

    // Title
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 56px -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('🏆 ' + (sessionName || 'Leaderboard'), 540, 160)

    // Subtitle
    ctx.font = '32px -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.fillStyle = '#a7f3d0'
    ctx.fillText(new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }), 540, 220)

    // Table header
    const startY = 310
    const rowH = 72
    const colX = { rank: 100, name: 200, pts: 620, diff: 780, gp: 940 }

    ctx.fillStyle = '#d1fae5'
    ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('#', colX.rank, startY)
    ctx.fillText('Player', colX.name, startY)
    ctx.textAlign = 'right'
    ctx.fillText('Pts', colX.pts, startY)
    ctx.fillText('+/−', colX.diff, startY)
    ctx.fillText('GP', colX.gp, startY)

    // Divider line
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(80, startY + 20)
    ctx.lineTo(1000, startY + 20)
    ctx.stroke()

    // Rows
    const maxRows = entries.length
    const availableHeight = 1920 - startY - 160 // leave room for footer
    const dynamicRowH = Math.min(rowH, Math.floor(availableHeight / maxRows))
    for (let i = 0; i < maxRows; i++) {
      const e = entries[i]
      const y = startY + 60 + i * dynamicRowH

      // Highlight top 3
      if (e.rank <= 3) {
        ctx.fillStyle = 'rgba(255,255,255,0.06)'
        ctx.fillRect(80, y - 40, 920, dynamicRowH - 4)
      }

      ctx.textAlign = 'left'
      ctx.font = 'bold 32px -apple-system, BlinkMacSystemFont, sans-serif'
      ctx.fillStyle = '#ffffff'
      const badge = e.rank === 1 ? '🥇' : e.rank === 2 ? '🥈' : e.rank === 3 ? '🥉' : `${e.rank}`
      ctx.fillText(badge, colX.rank, y)

      ctx.font = '32px -apple-system, BlinkMacSystemFont, sans-serif'
      ctx.fillStyle = '#ffffff'
      ctx.fillText(e.player_name, colX.name, y)

      ctx.textAlign = 'right'
      ctx.font = 'bold 32px -apple-system, BlinkMacSystemFont, sans-serif'
      ctx.fillText(`${e.total_points}`, colX.pts, y)

      ctx.fillStyle = e.point_diff > 0 ? '#4ade80' : e.point_diff < 0 ? '#f87171' : '#9ca3af'
      ctx.font = '30px -apple-system, BlinkMacSystemFont, sans-serif'
      ctx.fillText(formatDiff(e.point_diff), colX.diff, y)

      ctx.fillStyle = '#9ca3af'
      ctx.fillText(`${e.games_played}`, colX.gp, y)
    }

    // Footer
    ctx.textAlign = 'center'
    ctx.fillStyle = '#6ee7b7'
    ctx.font = '26px -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.fillText('📊 Tracked with Trackquet', 540, 1840)

    // Export as PNG and trigger download/share
    canvas.toBlob((blob) => {
      if (!blob) return
      const file = new File([blob], 'leaderboard.png', { type: 'image/png' })

      // Try native share with file (mobile)
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        navigator.share({
          files: [file],
          title: sessionName || 'Leaderboard',
          text: '🏆 Match Leaderboard',
        }).catch(() => {
          downloadBlob(blob)
        })
      } else {
        downloadBlob(blob)
      }
    }, 'image/png')
  }

  const downloadBlob = (blob: Blob) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `leaderboard-${(sessionName || 'match').replace(/\s+/g, '-').toLowerCase()}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Image saved!')
  }

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading standings...</div>
  }

  if (entries.length === 0) {
    return <div className="text-center py-8 text-gray-500">No standings yet</div>
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-600">
              <th className="py-2 px-2 w-10">#</th>
              <th className="py-2 px-2">Player</th>
              <th className="py-2 px-2 text-right">Pts</th>
              <th className="py-2 px-2 text-right">+/−</th>
              <th className="py-2 px-2 text-right">GP</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr
                key={entry.player_id}
                className={`border-b border-gray-100 ${rankStyle(entry.rank)}`}
              >
                <td className="py-2 px-2 text-center">{rankBadge(entry.rank)}</td>
                <td className="py-2 px-2 text-gray-900">{entry.player_name}</td>
                <td className="py-2 px-2 text-right font-medium">{entry.total_points}</td>
                <td className={`py-2 px-2 text-right ${entry.point_diff > 0 ? 'text-green-600' : entry.point_diff < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                  {formatDiff(entry.point_diff)}
                </td>
                <td className="py-2 px-2 text-right text-gray-500">{entry.games_played}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Share / PDF buttons */}
      <div className="mt-4 flex gap-2">
        <button
          onClick={async () => {
            const text = generateShareText()
            if (!text) return
            if (shareSupported) {
              try { await navigator.share({ title: 'Leaderboard', text }) }
              catch (err) {
                if (err instanceof Error && err.name !== 'AbortError') {
                  await navigator.clipboard.writeText(text)
                  toast.success('Copied to clipboard')
                }
              }
            } else {
              await navigator.clipboard.writeText(text)
              toast.success('Copied to clipboard')
            }
          }}
          className="flex-1 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2 transition-colors"
        >
          📤 Share
        </button>
        <button
          onClick={handlePDF}
          className="flex-1 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2 transition-colors"
        >
          📄 Story Image
        </button>
      </div>
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
