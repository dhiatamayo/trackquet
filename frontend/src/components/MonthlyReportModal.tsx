import { useState, useRef } from 'react'
import ModalPortal from './ModalPortal'
import { Download, Share2, Loader2, X, Trophy, Target, Dumbbell } from 'lucide-react'
import type { MonthlyReport, NotableSession } from '../types'
import {
  StoryFrame, StoryStat, StorySectionLabel, StoryThemeToggle,
  captureStory, PALETTES, type StoryTheme,
} from './StoryExport'

interface Props {
  report: MonthlyReport
  onClose: () => void
}

function fmtMin(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function notableTone(tag: string, p: ReturnType<() => typeof PALETTES.light>) {
  const t = tag.toLowerCase()
  if (t.includes('win')) return p.pos
  if (t.includes('loss')) return p.neg
  return p.warn
}

// ─── Body: the monthly content that plugs into StoryFrame ────────────────────

function MonthlyBody({ report, theme }: { report: MonthlyReport; theme: StoryTheme }) {
  const p = PALETTES[theme]
  const totalHours = (report.total_minutes / 60).toFixed(1)
  const usageTop = report.racquet_usage.slice(0, 3)

  return (
    <>
      {/* Primary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 8 }}>
        <StoryStat label="Sessions" value={String(report.total_sessions)} theme={theme} accent />
        <StoryStat label="Hours" value={totalHours} theme={theme} accent />
        <StoryStat label="Avg/Session" value={`${report.avg_min_per_session}m`} theme={theme} />
      </div>

      {/* Win rates */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 16 }}>
        <StoryStat label="Singles Win" value={report.total_matches_singles > 0 ? `${report.win_rate_singles}%` : '—'} theme={theme} />
        <StoryStat label="Doubles Win" value={report.total_matches_doubles > 0 ? `${report.win_rate_doubles}%` : '—'} theme={theme} />
      </div>

      {/* Racquet usage */}
      <div style={{ marginBottom: 16 }}>
        <StorySectionLabel theme={theme}>Racquet Usage</StorySectionLabel>
        {usageTop.length === 0 ? (
          <div style={{ fontSize: 11, color: p.textFaint }}>No sessions this month</div>
        ) : usageTop.map((rq, i) => {
          const pct = usageTop[0].sessions > 0 ? (rq.sessions / usageTop[0].sessions) * 100 : 0
          return (
            <div key={rq.racquet_id} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, background: i === 0 ? p.brand : p.panel, color: i === 0 ? '#fff' : p.textMuted, borderRadius: 4, padding: '1px 5px', border: i === 0 ? 'none' : `1px solid ${p.panelBorder}` }}>#{i + 1}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: p.text, maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rq.racquet_name}</span>
                </span>
                <span style={{ fontSize: 10, color: p.textMuted, fontVariantNumeric: 'tabular-nums' }}>{rq.sessions}s · {fmtMin(rq.total_min)}</span>
              </div>
              <div style={{ height: 5, background: p.panel, borderRadius: 3, overflow: 'hidden', border: `1px solid ${p.panelBorder}` }}>
                <div style={{ height: '100%', width: `${pct}%`, background: i === 0 ? p.brand : p.accent, borderRadius: 3 }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Milestones */}
      {report.notable_results.length > 0 && (
        <div style={{ flex: 1, minHeight: 0 }}>
          <StorySectionLabel theme={theme}>Milestones</StorySectionLabel>
          {report.notable_results.slice(0, 4).map((s: NotableSession) => {
            const tone = notableTone(s.notable_tag, p)
            return (
              <div key={`${s.session_id}-${s.notable_tag}`} style={{ display: 'flex', alignItems: 'center', gap: 8, background: p.panel, border: `1px solid ${p.panelBorder}`, borderRadius: 8, padding: '7px 10px', marginBottom: 5 }}>
                <span style={{ display: 'inline-flex', width: 22, height: 22, alignItems: 'center', justifyContent: 'center', borderRadius: 6, background: p.brandSoft, color: p.brand }}>
                  {s.notable_tag.toLowerCase().includes('training')
                    ? <Dumbbell size={12} />
                    : s.notable_tag.toLowerCase().includes('win')
                    ? <Trophy size={12} />
                    : <Target size={12} />}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.25, color: p.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name || s.racquet_name}</div>
                  <div style={{ fontSize: 9, lineHeight: 1.2, color: p.textMuted }}>{s.date} · {fmtMin(s.duration_min)}{s.match_score ? ` · ${s.match_score}` : ''}</div>
                </div>
                <span style={{ fontSize: 8, fontWeight: 700, lineHeight: 1.2, color: tone, border: `1px solid ${tone}`, borderRadius: 5, padding: '2px 6px', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.notable_tag}</span>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

// ─── Modal ───────────────────────────────────────────────────────────────────

export default function MonthlyReportModal({ report, onClose }: Props) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [theme, setTheme] = useState<StoryTheme>('light')
  const [exporting, setExporting] = useState(false)
  const [shareSupported] = useState(() => {
    if (typeof navigator === 'undefined' || !navigator.share) return false
    if (!navigator.canShare) return true
    try {
      return navigator.canShare({ files: [new File([], 'trackquet.png', { type: 'image/png' })] })
    } catch {
      return false
    }
  })

  const handleSave = async () => {
    setExporting(true)
    try {
      const blob = await captureStory(cardRef.current)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `trackquet-${report.month.replace(' ', '-').toLowerCase()}-${theme}.png`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  const handleShare = async () => {
    setExporting(true)
    try {
      const blob = await captureStory(cardRef.current)
      const file = new File([blob], `trackquet-${report.month.replace(' ', '-').toLowerCase()}.png`, { type: 'image/png' })
      if (!navigator.share) throw new Error('Share is not supported')
      if (navigator.canShare && !navigator.canShare({ files: [file] })) throw new Error('Sharing files not supported')
      await navigator.share({ title: `Trackquet — ${report.month}`, text: `My wrap-up for ${report.month}`, files: [file] })
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') console.error('Share failed:', err)
    } finally {
      setExporting(false)
    }
  }

  return (
    <ModalPortal>
    <div
      className="modal-overlay"
      onClick={onClose}
    >
      <div className="flex min-h-full items-center justify-center p-4 py-6">
        <div className="relative flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onClose}
            className="absolute -top-2 -right-2 z-10 h-8 w-8 rounded-full bg-ink-700 hover:bg-ink-600 text-white flex items-center justify-center shadow-lift"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>

          <StoryThemeToggle theme={theme} onChange={setTheme} />

          <StoryFrame cardRef={cardRef} theme={theme} eyebrow="Monthly Wrap-Up" title={report.month}>
            <MonthlyBody report={report} theme={theme} />
          </StoryFrame>

          <div className="flex gap-3 w-full max-w-[360px]">
            <button onClick={handleSave} disabled={exporting} className="btn-primary flex-1">
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Save PNG
            </button>
            {shareSupported && (
              <button onClick={handleShare} disabled={exporting} className="btn-secondary flex-1">
                <Share2 className="h-4 w-4" />
                Share
              </button>
            )}
          </div>

          <p className="text-caption text-ink-400 text-center">Exported at 1080×1920 (Instagram Story)</p>
        </div>
      </div>
    </div>
    </ModalPortal>
  )
}
