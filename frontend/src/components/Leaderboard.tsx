import { useCallback, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Share2, ImageDown, Loader2 } from 'lucide-react'
import type { LeaderboardEntry } from '../types'
import {
  StoryFrame, StorySectionLabel, StoryThemeToggle,
  captureStory, PALETTES, type StoryTheme,
} from './StoryExport'

interface Props {
  entries: LeaderboardEntry[]
  loading?: boolean
  sessionName?: string
}

export default function Leaderboard({ entries, loading, sessionName }: Props) {
  const shareSupported = typeof navigator !== 'undefined' && !!navigator.share
  const cardRef = useRef<HTMLDivElement>(null)
  const [theme, setTheme] = useState<StoryTheme>('light')
  const [showExport, setShowExport] = useState(false)
  const [exporting, setExporting] = useState(false)

  const generateShareText = useCallback(() => {
    if (entries.length === 0) return ''
    const title = sessionName ? `${sessionName} — Leaderboard` : 'Match Leaderboard'
    const lines = entries.map(
      (e, i) => `${i + 1}. ${e.player_name}: ${e.total_points} pts (${formatDiff(e.point_diff)}) — ${e.games_played} games`
    )
    return `${title}\n\n${lines.join('\n')}\n\nTracked with Trackquet`
  }, [entries, sessionName])

  const handleExportImage = async () => {
    setExporting(true)
    try {
      // ensure the hidden card is mounted before capture
      if (!showExport) {
        setShowExport(true)
        await new Promise((r) => setTimeout(r, 60))
      }
      const blob = await captureStory(cardRef.current)
      const file = new File([blob], `leaderboard-${(sessionName || 'match').replace(/\s+/g, '-').toLowerCase()}.png`, { type: 'image/png' })
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: sessionName || 'Leaderboard', text: 'Match Leaderboard' })
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = file.name
        a.click()
        URL.revokeObjectURL(url)
        toast.success('Image saved!')
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') toast.error('Export failed')
    } finally {
      setExporting(false)
    }
  }

  const handleShareText = async () => {
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
  }

  if (loading) {
    return <div className="text-center py-8 text-caption text-ink-400">Loading standings…</div>
  }

  if (entries.length === 0) {
    return <div className="text-center py-8 text-caption text-ink-400">No standings yet</div>
  }

  return (
    <div>
      {/* In-app table */}
      <div className="overflow-x-auto">
        <table className="w-full text-caption">
          <thead>
            <tr className="border-b border-ink-200 text-left text-ink-500">
              <th className="py-2 px-2 w-10 font-medium">#</th>
              <th className="py-2 px-2 font-medium">Player</th>
              <th className="py-2 px-2 text-right font-medium">Pts</th>
              <th className="py-2 px-2 text-right font-medium">+/−</th>
              <th className="py-2 px-2 text-right font-medium">GP</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.player_id} className={`border-b border-ink-100 ${entry.rank <= 3 ? 'bg-ink-50/60' : ''}`}>
                <td className="py-2.5 px-2"><RankBadge rank={entry.rank} /></td>
                <td className="py-2.5 px-2 text-ink-900 font-medium">{entry.player_name}</td>
                <td className="py-2.5 px-2 text-right font-semibold text-ink-900 tnum">{entry.total_points}</td>
                <td className={`py-2.5 px-2 text-right tnum ${entry.point_diff > 0 ? 'text-court-600' : entry.point_diff < 0 ? 'text-red-600' : 'text-ink-400'}`}>
                  {formatDiff(entry.point_diff)}
                </td>
                <td className="py-2.5 px-2 text-right text-ink-500 tnum">{entry.games_played}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Actions */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button onClick={handleShareText} className="btn-secondary flex-1 min-w-[120px]">
          <Share2 className="h-4 w-4" />
          Copy Text
        </button>
        <button onClick={() => setShowExport((v) => !v)} className="btn-secondary flex-1 min-w-[120px]">
          <ImageDown className="h-4 w-4" />
          {showExport ? 'Hide Card' : 'Story Image'}
        </button>
      </div>

      {/* Export panel */}
      {showExport && (
        <div className="mt-4 flex flex-col items-center gap-3">
          <StoryThemeToggle theme={theme} onChange={setTheme} />
          <StoryFrame cardRef={cardRef} theme={theme} eyebrow="Leaderboard" title={sessionName || 'Standings'}>
            <LeaderboardBody entries={entries} theme={theme} />
          </StoryFrame>
          <button onClick={handleExportImage} disabled={exporting} className="btn-primary w-full max-w-[360px]">
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageDown className="h-4 w-4" />}
            {shareSupported ? 'Share / Save' : 'Save PNG'}
          </button>
          <p className="text-caption text-ink-400">Exported at 1080×1920 (Instagram Story)</p>
        </div>
      )}
    </div>
  )
}

// ─── Story body (plugs into shared StoryFrame) ───────────────────────────────

function LeaderboardBody({ entries, theme }: { entries: LeaderboardEntry[]; theme: StoryTheme }) {
  const p = PALETTES[theme]
  const top = entries.slice(0, 10)
  return (
    <>
      <StorySectionLabel theme={theme}>
        {new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
      </StorySectionLabel>
      <div style={{ flex: 1, minHeight: 0 }}>
        {/* header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 6px 6px', fontSize: 9, fontWeight: 700, color: p.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: `1px solid ${p.divider}` }}>
          <span style={{ width: 24 }}>#</span>
          <span style={{ flex: 1 }}>Player</span>
          <span style={{ width: 44, textAlign: 'right' }}>Pts</span>
          <span style={{ width: 40, textAlign: 'right' }}>+/−</span>
          <span style={{ width: 28, textAlign: 'right' }}>GP</span>
        </div>
        {top.map((e) => {
          const medal =
            e.rank === 1 ? { bg: p.brand, fg: '#fff' } :
            e.rank === 2 ? { bg: p.panel, fg: p.textMuted } :
            e.rank === 3 ? { bg: p.brandSoft, fg: p.brand } :
            null
          return (
            <div key={e.player_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 6px', borderBottom: `1px solid ${p.divider}` }}>
              <span style={{ width: 24 }}>
                <span style={{ display: 'inline-flex', width: 20, height: 20, alignItems: 'center', justifyContent: 'center', borderRadius: '50%', fontSize: 10, fontWeight: 800, fontVariantNumeric: 'tabular-nums', background: medal ? medal.bg : 'transparent', color: medal ? medal.fg : p.textMuted, border: medal ? 'none' : `1px solid ${p.panelBorder}` }}>
                  {e.rank}
                </span>
              </span>
              <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: p.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.player_name}</span>
              <span style={{ width: 44, textAlign: 'right', fontSize: 12, fontWeight: 700, color: p.text, fontVariantNumeric: 'tabular-nums' }}>{e.total_points}</span>
              <span style={{ width: 40, textAlign: 'right', fontSize: 11, color: e.point_diff > 0 ? p.pos : e.point_diff < 0 ? p.neg : p.textFaint, fontVariantNumeric: 'tabular-nums' }}>{formatDiff(e.point_diff)}</span>
              <span style={{ width: 28, textAlign: 'right', fontSize: 11, color: p.textMuted, fontVariantNumeric: 'tabular-nums' }}>{e.games_played}</span>
            </div>
          )
        })}
      </div>
    </>
  )
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-ace-100 text-ace-600 text-caption font-bold tnum ring-1 ring-ace-200">1</span>
  if (rank === 2) return <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-ink-100 text-ink-600 text-caption font-bold tnum ring-1 ring-ink-200">2</span>
  if (rank === 3) return <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 text-orange-600 text-caption font-bold tnum ring-1 ring-orange-200">3</span>
  return <span className="inline-flex h-6 w-6 items-center justify-center text-ink-500 text-caption font-semibold tnum">{rank}</span>
}

function formatDiff(diff: number): string {
  if (diff > 0) return `+${diff}`
  return `${diff}`
}
