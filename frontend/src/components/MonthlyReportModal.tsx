import { useState, useRef, useCallback } from 'react'
import type React from 'react'
import html2canvas from 'html2canvas'
import type { MonthlyReport, NotableSession } from '../types'

interface Props {
  report: MonthlyReport
  onClose: () => void
}

// ─── helpers ────────────────────────────────────────────────────────────────

function fmtMin(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function resultBadge(tag: string) {
  if (tag.toLowerCase().includes('win')) return { bg: '#22c55e', text: '#ffffff' }
  if (tag.toLowerCase().includes('loss')) return { bg: '#ef4444', text: '#ffffff' }
  return { bg: '#f59e0b', text: '#ffffff' }
}

function notableIcon(tag: string) {
  if (tag.toLowerCase().includes('win')) return '🏆'
  if (tag.toLowerCase().includes('loss')) return '😤'
  return '⏱️'
}

function NotableRow({ s }: { s: NotableSession }) {
  const { bg, text } = resultBadge(s.notable_tag)
  const icon = notableIcon(s.notable_tag)
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'rgba(255,255,255,0.06)',
        borderRadius: 8,
        padding: '7px 10px',
        marginBottom: 5,
      }}
    >
      <span style={{ fontSize: 15 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: '#f1f5f9',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {s.name || s.racquet_name}
        </div>
        <div style={{ fontSize: 10, color: '#94a3b8' }}>
          {s.date} · {fmtMin(s.duration_min)}
          {s.match_score ? ` · ${s.match_score}` : ''}
        </div>
      </div>
      <span
        style={{
          fontSize: 9,
          fontWeight: 700,
          background: bg,
          color: text,
          borderRadius: 5,
          padding: '2px 6px',
          whiteSpace: 'nowrap',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {s.notable_tag}
      </span>
    </div>
  )
}

// ─── Story Card (the actual PNG content) ────────────────────────────────────

interface CardProps {
  report: MonthlyReport
  cardRef: React.Ref<HTMLDivElement>
}

function StoryCard({ report, cardRef }: CardProps) {
  const totalHours = (report.total_minutes / 60).toFixed(1)
  const usageTop5 = report.racquet_usage.slice(0, 5)

  return (
    // 9:16 container rendered at 360×640 on screen; html2canvas scales to 1080×1920
    <div
      ref={cardRef}
      style={{
        width: 360,
        height: 640,
        background: 'linear-gradient(160deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
        borderRadius: 16,
        overflow: 'hidden',
        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
        color: '#f1f5f9',
        padding: '24px 20px 18px',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        position: 'relative',
      }}
    >
      {/* Decorative accent blobs */}
      <div
        style={{
          position: 'absolute',
          top: -60,
          right: -60,
          width: 200,
          height: 200,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.35) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 80,
          left: -80,
          width: 240,
          height: 240,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(16,185,129,0.25) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Header */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#818cf8', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 2 }}>
          Monthly Wrap-Up
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.1, color: '#ffffff' }}>
          {report.month}
        </div>
      </div>

      {/* Key stats row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 8,
          marginBottom: 16,
        }}
      >
        {[
          { label: 'Sessions', value: String(report.total_sessions), emoji: '🎾' },
          { label: 'Hours', value: totalHours, emoji: '⏱️' },
          { label: 'Avg/Session', value: `${report.avg_min_per_session}m`, emoji: '📊' },
          {
            label: 'Win Rate',
            value: report.total_matches > 0 ? `${report.win_rate}%` : '—',
            emoji: '🏅',
          },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              background: 'rgba(255,255,255,0.08)',
              borderRadius: 10,
              padding: '10px 6px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 16 }}>{stat.emoji}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#ffffff', lineHeight: 1.1 }}>
              {stat.value}
            </div>
            <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 1 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Racquet usage */}
      <div style={{ marginBottom: 14 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: '#818cf8',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: 7,
          }}
        >
          Racquet Usage
        </div>
        {usageTop5.length === 0 ? (
          <div style={{ fontSize: 11, color: '#64748b' }}>No sessions this month</div>
        ) : (
          usageTop5.map((rq, i) => {
            const maxSessions = usageTop5[0].sessions
            const pct = maxSessions > 0 ? (rq.sessions / maxSessions) * 100 : 0
            return (
              <div key={rq.racquet_id} style={{ marginBottom: 7 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    marginBottom: 3,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        background: i === 0 ? '#f59e0b' : 'rgba(255,255,255,0.15)',
                        color: i === 0 ? '#000' : '#94a3b8',
                        borderRadius: 4,
                        padding: '1px 5px',
                      }}
                    >
                      #{i + 1}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#e2e8f0',
                        maxWidth: 130,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {rq.racquet_name}
                    </span>
                  </div>
                  <span style={{ fontSize: 10, color: '#94a3b8' }}>
                    {rq.sessions} session{rq.sessions !== 1 ? 's' : ''} · {fmtMin(rq.total_min)}
                  </span>
                </div>
                {/* Progress bar */}
                <div
                  style={{
                    height: 4,
                    background: 'rgba(255,255,255,0.1)',
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${pct}%`,
                      background:
                        i === 0
                          ? 'linear-gradient(90deg, #818cf8, #a78bfa)'
                          : 'rgba(129,140,248,0.5)',
                      borderRadius: 2,
                      transition: 'width 0.3s',
                    }}
                  />
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Notable results */}
      {report.notable_results.length > 0 && (
        <div style={{ flex: 1, minHeight: 0 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: '#818cf8',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: 7,
            }}
          >
            Notable Results
          </div>
          {report.notable_results.map((s) => (
            <NotableRow key={`${s.session_id}-${s.notable_tag}`} s={s} />
          ))}
        </div>
      )}

      {/* Footer / branding */}
      <div
        style={{
          marginTop: 'auto',
          paddingTop: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14 }}>🎾</span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 800,
              background: 'linear-gradient(90deg, #818cf8, #34d399)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            trackquet
          </span>
        </div>
        <span style={{ fontSize: 9, color: '#475569', letterSpacing: '0.05em' }}>
          TRACK YOUR GAME
        </span>
      </div>
    </div>
  )
}

// ─── Main Modal ──────────────────────────────────────────────────────────────

export default function MonthlyReportModal({ report, onClose }: Props) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [exporting, setExporting] = useState(false)
  const [shareSupported] = useState(() => typeof navigator !== 'undefined' && !!navigator.share)

  const captureCanvas = useCallback(async (): Promise<Blob> => {
    if (!cardRef.current) throw new Error('Card not mounted')
    const canvas = await html2canvas(cardRef.current, {
      scale: 3,           // 360×3 = 1080, 640×3 = 1920 → full story resolution
      useCORS: true,
      backgroundColor: null,
      logging: false,
    })
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error('Canvas export failed'))
        },
        'image/png',
        1.0
      )
    })
  }, [])

  const handleSave = async () => {
    setExporting(true)
    try {
      const blob = await captureCanvas()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `trackquet-${report.month.replace(' ', '-').toLowerCase()}.png`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  const handleShare = async () => {
    setExporting(true)
    try {
      const blob = await captureCanvas()
      const file = new File([blob], `trackquet-${report.month.replace(' ', '-').toLowerCase()}.png`, {
        type: 'image/png',
      })
      await navigator.share({
        title: `Trackquet — ${report.month}`,
        text: `My tennis wrap-up for ${report.month} 🎾`,
        files: [file],
      })
    } catch (err) {
      // User cancelled share — not an error
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('Share failed:', err)
      }
    } finally {
      setExporting(false)
    }
  }

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      {/* Modal panel */}
      <div
        className="relative flex flex-col items-center gap-4 max-h-[95vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-2 -right-2 z-10 w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 text-white flex items-center justify-center text-sm shadow-lg"
        >
          ✕
        </button>

        {/* Story card */}
        <StoryCard report={report} cardRef={cardRef} />

        {/* Action buttons */}
        <div className="flex gap-3 w-full max-w-[360px]">
          <button
            onClick={handleSave}
            disabled={exporting}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-60 transition-colors shadow"
          >
            {exporting ? (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            ) : (
              '⬇️'
            )}
            Save PNG
          </button>

          {shareSupported && (
            <button
              onClick={handleShare}
              disabled={exporting}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white disabled:opacity-60 transition-all shadow"
            >
              📲 Share Story
            </button>
          )}
        </div>

        <p className="text-xs text-gray-400 text-center">
          Exported at 1080×1920 (Instagram Story)
        </p>
      </div>
    </div>
  )
}
