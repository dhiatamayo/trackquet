import { useState, useRef, useCallback } from 'react'
import type React from 'react'
import html2canvas from 'html2canvas'
import type { MonthlyReport, NotableSession } from '../types'

interface Props {
  report: MonthlyReport
  onClose: () => void
}

type Theme = 'aurora' | 'neon' | 'clay' | 'frost'

const THEMES: { id: Theme; label: string; emoji: string }[] = [
  { id: 'aurora', label: 'Aurora', emoji: '🌌' },
  { id: 'neon',   label: 'Neon',   emoji: '⚡' },
  { id: 'clay',   label: 'Clay',   emoji: '🏆' },
  { id: 'frost',  label: 'Frost',  emoji: '❄️' },
]

// ─── shared helpers ──────────────────────────────────────────────────────────

function fmtMin(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function notableIcon(tag: string) {
  if (tag.toLowerCase().includes('win')) return '🏆'
  if (tag.toLowerCase().includes('loss')) return '😤'
  if (tag.toLowerCase().includes('training')) return '🎯'
  return '⏱️'
}

// ─── Card prop types ─────────────────────────────────────────────────────────

interface CardProps {
  report: MonthlyReport
  cardRef: React.Ref<HTMLDivElement>
}

// ═══════════════════════════════════════════════════════════════════════════════
// AURORA — dark indigo / purple (original)
// ═══════════════════════════════════════════════════════════════════════════════

function auroraResultBadge(tag: string) {
  if (tag.toLowerCase().includes('win'))  return { bg: '#22c55e', text: '#ffffff' }
  if (tag.toLowerCase().includes('loss')) return { bg: '#ef4444', text: '#ffffff' }
  return { bg: '#f59e0b', text: '#ffffff' }
}

function AuroraNotableRow({ s }: { s: NotableSession }) {
  const { bg, text } = auroraResultBadge(s.notable_tag)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: '7px 10px', marginBottom: 5 }}>
      <span style={{ fontSize: 15 }}>{notableIcon(s.notable_tag)}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {s.name || s.racquet_name}
        </div>
        <div style={{ fontSize: 10, color: '#94a3b8' }}>
          {s.date} · {fmtMin(s.duration_min)}{s.match_score ? ` · ${s.match_score}` : ''}
        </div>
      </div>
      <span style={{ fontSize: 9, fontWeight: 700, background: bg, color: text, borderRadius: 5, padding: '2px 6px', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {s.notable_tag}
      </span>
    </div>
  )
}

function AuroraCard({ report, cardRef }: CardProps) {
  const totalHours = (report.total_minutes / 60).toFixed(1)
  const usageTop5 = report.racquet_usage.slice(0, 5)
  return (
    <div
      ref={cardRef}
      style={{
        width: 360, height: 640,
        background: 'linear-gradient(160deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
        borderRadius: 16, overflow: 'hidden',
        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
        color: '#f1f5f9', padding: '24px 20px 18px',
        display: 'flex', flexDirection: 'column', boxSizing: 'border-box', position: 'relative',
      }}
    >
      <div style={{ position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.35) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: 80, left: -80, width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.25) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#818cf8', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 2 }}>Monthly Wrap-Up</div>
        <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.1, color: '#ffffff' }}>{report.month}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
        {[
          { label: 'Sessions', value: String(report.total_sessions), emoji: '🎾' },
          { label: 'Hours', value: totalHours, emoji: '⏱️' },
          { label: 'Avg/Session', value: `${report.avg_min_per_session}m`, emoji: '📊' },
          { label: 'Win Rate', value: report.total_matches > 0 ? `${report.win_rate}%` : '—', emoji: '🏅' },
        ].map((stat) => (
          <div key={stat.label} style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 6px', textAlign: 'center' }}>
            <div style={{ fontSize: 16 }}>{stat.emoji}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#ffffff', lineHeight: 1.1 }}>{stat.value}</div>
            <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 1 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 7 }}>Racquet Usage</div>
        {usageTop5.length === 0 ? (
          <div style={{ fontSize: 11, color: '#64748b' }}>No sessions this month</div>
        ) : usageTop5.map((rq, i) => {
          const pct = usageTop5[0].sessions > 0 ? (rq.sessions / usageTop5[0].sessions) * 100 : 0
          return (
            <div key={rq.racquet_id} style={{ marginBottom: 7 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, background: i === 0 ? '#f59e0b' : 'rgba(255,255,255,0.15)', color: i === 0 ? '#000' : '#94a3b8', borderRadius: 4, padding: '1px 5px' }}>#{i + 1}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#e2e8f0', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rq.racquet_name}</span>
                </div>
                <span style={{ fontSize: 10, color: '#94a3b8' }}>{rq.sessions} session{rq.sessions !== 1 ? 's' : ''} · {fmtMin(rq.total_min)}</span>
              </div>
              <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: i === 0 ? 'linear-gradient(90deg, #818cf8, #a78bfa)' : 'rgba(129,140,248,0.5)', borderRadius: 2 }} />
              </div>
            </div>
          )
        })}
      </div>

      {report.notable_results.length > 0 && (
        <div style={{ flex: 1, minHeight: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 7 }}>Milestones</div>
          {report.notable_results.slice(0, 4).map((s) => <AuroraNotableRow key={`${s.session_id}-${s.notable_tag}`} s={s} />)}
        </div>
      )}

      <div style={{ marginTop: 'auto', paddingTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14 }}>🎾</span>
          <span style={{ fontSize: 13, fontWeight: 800, background: 'linear-gradient(90deg, #818cf8, #34d399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>trackquet</span>
        </div>
        <span style={{ fontSize: 9, color: '#475569', letterSpacing: '0.05em' }}>TRACK YOUR GAME</span>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// NEON — cyberpunk black / magenta / cyan
// ═══════════════════════════════════════════════════════════════════════════════

function NeonCard({ report, cardRef }: CardProps) {
  const totalHours = (report.total_minutes / 60).toFixed(1)
  const usageTop5 = report.racquet_usage.slice(0, 5)
  return (
    <div
      ref={cardRef}
      style={{
        width: 360, height: 640,
        background: '#080808',
        borderRadius: 16, overflow: 'hidden',
        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
        color: '#ffffff', padding: '26px 20px 18px',
        display: 'flex', flexDirection: 'column', boxSizing: 'border-box', position: 'relative',
      }}
    >
      {/* Top neon bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #ff0080, #00ffdd, #ff0080)' }} />
      {/* Bottom neon bar */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, #ff0080, #00ffdd, transparent)' }} />
      {/* Glow blob */}
      <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,255,221,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />

      {/* Header */}
      <div style={{ marginBottom: 18, paddingTop: 4 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: '#00ffdd', letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 5 }}>◈ Monthly Wrap-Up ◈</div>
        <div style={{ fontSize: 26, fontWeight: 900, color: '#ffffff', lineHeight: 1.05, letterSpacing: '-0.01em' }}>{report.month}</div>
      </div>

      {/* 2×2 big stat grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        {[
          { label: 'Sessions', value: String(report.total_sessions), color: '#00ffdd' },
          { label: 'Hours', value: totalHours, color: '#ff0080' },
          { label: 'Win Rate', value: report.total_matches > 0 ? `${report.win_rate}%` : '—', color: '#ffe600' },
          { label: 'Avg/Session', value: `${report.avg_min_per_session}m`, color: '#bf80ff' },
        ].map((stat) => (
          <div key={stat.label} style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${stat.color}33`, borderRadius: 10, padding: '12px 14px', boxShadow: `inset 0 0 20px ${stat.color}10` }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: stat.color, lineHeight: 1, letterSpacing: '-0.02em' }}>{stat.value}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Separator */}
      <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,0,128,0.4), rgba(0,255,221,0.4), transparent)', marginBottom: 12 }} />

      {/* Racquet usage */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: '#00ffdd', textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: 8 }}>▸ Racquet Usage</div>
        {usageTop5.slice(0, 4).map((rq, i) => {
          const pct = usageTop5[0].sessions > 0 ? (rq.sessions / usageTop5[0].sessions) * 100 : 0
          return (
            <div key={rq.racquet_id} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 11, color: '#e2e8f0', fontWeight: 600 }}>{i === 0 ? '★ ' : ''}{rq.racquet_name}</span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{rq.sessions}s · {fmtMin(rq.total_min)}</span>
              </div>
              <div style={{ height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }}>
                <div style={{ height: '100%', width: `${pct}%`, background: i === 0 ? '#00ffdd' : '#ff0080', borderRadius: 2 }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Milestones */}
      {report.notable_results.length > 0 && (
        <div style={{ flex: 1, minHeight: 0 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#ff0080', textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: 8 }}>▸ Milestones</div>
          {report.notable_results.slice(0, 4).map((s) => {
            const isWin = s.notable_tag.toLowerCase().includes('win')
            const isLoss = s.notable_tag.toLowerCase().includes('loss')
            const accentColor = isWin ? '#00ffdd' : isLoss ? '#ff0080' : '#ffe600'
            return (
              <div key={`${s.session_id}-${s.notable_tag}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', marginBottom: 5, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8 }}>
                <span style={{ fontSize: 13 }}>{notableIcon(s.notable_tag)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name || s.racquet_name}</div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>{fmtMin(s.duration_min)}{s.match_score ? ` · ${s.match_score}` : ''}</div>
                </div>
                <span style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: accentColor, border: `1px solid ${accentColor}`, borderRadius: 4, padding: '2px 5px', whiteSpace: 'nowrap' }}>{s.notable_tag}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: 'auto', paddingTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: '#00ffdd', letterSpacing: '0.05em' }}>🎾 trackquet</span>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Track Your Game</span>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLAY — warm amber / dark brown (premium tennis aesthetic)
// ═══════════════════════════════════════════════════════════════════════════════

function ClayCard({ report, cardRef }: CardProps) {
  const totalHours = (report.total_minutes / 60).toFixed(1)
  const usageTop5 = report.racquet_usage.slice(0, 5)
  const ff = "'Georgia', 'Times New Roman', serif"
  const ffSans = "'Inter', 'Segoe UI', system-ui, sans-serif"
  return (
    <div
      ref={cardRef}
      style={{
        width: 360, height: 640,
        background: 'linear-gradient(160deg, #1a0800 0%, #2d1200 45%, #1a0800 100%)',
        borderRadius: 16, overflow: 'hidden',
        fontFamily: ff,
        color: '#fef3c7', padding: '28px 22px 20px',
        display: 'flex', flexDirection: 'column', boxSizing: 'border-box', position: 'relative',
      }}
    >
      {/* Top gold bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, #92400e, #f59e0b, #92400e)' }} />
      {/* Faint court lines */}
      <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 1, height: '100%', background: 'rgba(245,158,11,0.07)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: '35%', left: 0, right: 0, height: 1, background: 'rgba(245,158,11,0.07)', pointerEvents: 'none' }} />

      {/* Header */}
      <div style={{ marginBottom: 18, textAlign: 'center' }}>
        <div style={{ fontSize: 9, fontWeight: 400, color: '#f59e0b', letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 5 }}>─── Monthly Wrap-Up ───</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: '#fef3c7', lineHeight: 1.1 }}>{report.month}</div>
      </div>

      {/* 3-stat row */}
      <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, padding: '14px 8px', marginBottom: 12 }}>
        {[
          { label: 'Sessions', value: String(report.total_sessions) },
          { label: 'Hours', value: totalHours },
          { label: 'Win Rate', value: report.total_matches > 0 ? `${report.win_rate}%` : '—' },
        ].map((stat, i) => (
          <div key={stat.label} style={{ textAlign: 'center', flex: 1, borderRight: i < 2 ? '1px solid rgba(245,158,11,0.2)' : 'none' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#f59e0b', lineHeight: 1, fontFamily: ffSans }}>{stat.value}</div>
            <div style={{ fontSize: 9, color: '#d97706', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Avg session */}
      <div style={{ textAlign: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 10, color: '#d97706', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Avg. Session · </span>
        <span style={{ fontSize: 16, fontWeight: 700, color: '#fef3c7', fontFamily: ffSans }}>{report.avg_min_per_session} min</span>
      </div>

      {/* Divider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1, height: 1, background: 'rgba(245,158,11,0.25)' }} />
        <span style={{ fontSize: 12 }}>🎾</span>
        <div style={{ flex: 1, height: 1, background: 'rgba(245,158,11,0.25)' }} />
      </div>

      {/* Racquet usage */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 8 }}>Racquets in Play</div>
        {usageTop5.slice(0, 4).map((rq, i) => {
          const pct = usageTop5[0].sessions > 0 ? (rq.sessions / usageTop5[0].sessions) * 100 : 0
          return (
            <div key={rq.racquet_id} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 11, color: '#fef3c7', fontFamily: ffSans }}>{i === 0 ? '👑 ' : ''}{rq.racquet_name}</span>
                <span style={{ fontSize: 10, color: '#d97706', fontFamily: ffSans }}>{rq.sessions} sessions</span>
              </div>
              <div style={{ height: 4, background: 'rgba(245,158,11,0.1)', borderRadius: 2 }}>
                <div style={{ height: '100%', width: `${pct}%`, background: i === 0 ? 'linear-gradient(90deg, #f59e0b, #fbbf24)' : 'rgba(245,158,11,0.4)', borderRadius: 2 }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Milestones */}
      {report.notable_results.length > 0 && (
        <div style={{ flex: 1, minHeight: 0 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 8 }}>Season Highlights</div>
          {report.notable_results.slice(0, 4).map((s) => (
            <div key={`${s.session_id}-${s.notable_tag}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', marginBottom: 5, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 8 }}>
              <span style={{ fontSize: 13 }}>{notableIcon(s.notable_tag)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#fef3c7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: ffSans }}>{s.name || s.racquet_name}</div>
                <div style={{ fontSize: 9, color: '#d97706', fontFamily: ffSans }}>{fmtMin(s.duration_min)}{s.match_score ? ` · ${s.match_score}` : ''}</div>
              </div>
              <span style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', background: 'rgba(245,158,11,0.2)', color: '#f59e0b', borderRadius: 4, padding: '2px 6px', whiteSpace: 'nowrap', fontFamily: ffSans }}>{s.notable_tag}</span>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: 'auto', paddingTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(245,158,11,0.2)' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b', fontFamily: ffSans, letterSpacing: '0.05em' }}>🎾 trackquet</span>
        <span style={{ fontSize: 9, color: 'rgba(254,243,199,0.3)', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: ffSans }}>Track Your Game</span>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// FROST — clean light / white minimal
// ═══════════════════════════════════════════════════════════════════════════════

function FrostCard({ report, cardRef }: CardProps) {
  const totalHours = (report.total_minutes / 60).toFixed(1)
  const usageTop5 = report.racquet_usage.slice(0, 5)
  return (
    <div
      ref={cardRef}
      style={{
        width: 360, height: 640,
        background: '#f8fafc',
        borderRadius: 16, overflow: 'hidden',
        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
        color: '#0f172a', padding: '28px 22px 20px',
        display: 'flex', flexDirection: 'column', boxSizing: 'border-box', position: 'relative',
      }}
    >
      {/* Top accent stripe */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: 'linear-gradient(90deg, #4f46e5, #7c3aed, #0ea5e9)' }} />
      {/* Decorative circle */}
      <div style={{ position: 'absolute', top: -80, right: -80, width: 220, height: 220, borderRadius: '50%', background: 'rgba(79,70,229,0.07)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -60, left: -60, width: 180, height: 180, borderRadius: '50%', background: 'rgba(14,165,233,0.06)', pointerEvents: 'none' }} />

      {/* Header */}
      <div style={{ marginBottom: 20, paddingTop: 4 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: '#6366f1', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 3 }}>Monthly Wrap-Up</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', lineHeight: 1.05, letterSpacing: '-0.02em' }}>{report.month}</div>
      </div>

      {/* 4-stat pill grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
        {[
          { label: 'Sessions', value: String(report.total_sessions), bg: '#ede9fe', color: '#4f46e5' },
          { label: 'Hours', value: totalHours, bg: '#e0f2fe', color: '#0369a1' },
          { label: 'Win Rate', value: report.total_matches > 0 ? `${report.win_rate}%` : '—', bg: '#dcfce7', color: '#15803d' },
          { label: 'Avg/Session', value: `${report.avg_min_per_session}m`, bg: '#fce7f3', color: '#be185d' },
        ].map((stat) => (
          <div key={stat.label} style={{ background: stat.bg, borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: stat.color, lineHeight: 1, letterSpacing: '-0.02em' }}>{stat.value}</div>
            <div style={{ fontSize: 10, color: stat.color, opacity: 0.7, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: '#e2e8f0', marginBottom: 12 }} />

      {/* Racquet usage */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>Racquet Usage</div>
        {usageTop5.slice(0, 4).map((rq, i) => {
          const pct = usageTop5[0].sessions > 0 ? (rq.sessions / usageTop5[0].sessions) * 100 : 0
          return (
            <div key={rq.racquet_id} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  {i === 0 && <span style={{ fontSize: 9, fontWeight: 700, background: '#4f46e5', color: '#fff', borderRadius: 4, padding: '1px 5px' }}>TOP</span>}
                  <span style={{ fontSize: 11, color: '#1e293b', fontWeight: 600 }}>{rq.racquet_name}</span>
                </div>
                <span style={{ fontSize: 10, color: '#64748b' }}>{rq.sessions}s · {fmtMin(rq.total_min)}</span>
              </div>
              <div style={{ height: 5, background: '#e2e8f0', borderRadius: 3 }}>
                <div style={{ height: '100%', width: `${pct}%`, background: i === 0 ? '#4f46e5' : '#a5b4fc', borderRadius: 3 }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Milestones */}
      {report.notable_results.length > 0 && (
        <div style={{ flex: 1, minHeight: 0 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>Milestones</div>
          {report.notable_results.slice(0, 4).map((s) => {
            const isWin = s.notable_tag.toLowerCase().includes('win')
            const isLoss = s.notable_tag.toLowerCase().includes('loss')
            return (
              <div key={`${s.session_id}-${s.notable_tag}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', marginBottom: 5, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <span style={{ fontSize: 13 }}>{notableIcon(s.notable_tag)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name || s.racquet_name}</div>
                  <div style={{ fontSize: 9, color: '#94a3b8' }}>{fmtMin(s.duration_min)}{s.match_score ? ` · ${s.match_score}` : ''}</div>
                </div>
                <span style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', background: isWin ? '#dcfce7' : isLoss ? '#fee2e2' : '#fef3c7', color: isWin ? '#15803d' : isLoss ? '#dc2626' : '#b45309', borderRadius: 5, padding: '2px 6px', whiteSpace: 'nowrap' }}>{s.notable_tag}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: 'auto', paddingTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0' }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: '#4f46e5', letterSpacing: '0.01em' }}>🎾 trackquet</span>
        <span style={{ fontSize: 9, color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Track Your Game</span>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Dispatcher
// ═══════════════════════════════════════════════════════════════════════════════

function StoryCard({ report, cardRef, theme }: CardProps & { theme: Theme }) {
  switch (theme) {
    case 'neon':  return <NeonCard  report={report} cardRef={cardRef} />
    case 'clay':  return <ClayCard  report={report} cardRef={cardRef} />
    case 'frost': return <FrostCard report={report} cardRef={cardRef} />
    default:      return <AuroraCard report={report} cardRef={cardRef} />
  }
}

// ─── Story Card (the actual PNG content) ────────────────────────────────────

// (kept for reference — now replaced by themed cards above)

// ─── Main Modal ──────────────────────────────────────────────────────────────

export default function MonthlyReportModal({ report, onClose }: Props) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [theme, setTheme] = useState<Theme>('aurora')
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
      const blob = await captureCanvas()
      const file = new File([blob], `trackquet-${report.month.replace(' ', '-').toLowerCase()}.png`, {
        type: 'image/png',
      })
      if (!navigator.share) throw new Error('Share is not supported')
      if (navigator.canShare && !navigator.canShare({ files: [file] })) {
        throw new Error('Sharing files is not supported')
      }
      await navigator.share({
        title: `Trackquet — ${report.month}`,
        text: `My tennis wrap-up for ${report.month} 🎾`,
        files: [file],
      })
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('Share failed:', err)
      }
    } finally {
      setExporting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div className="flex min-h-full items-center justify-center p-4 py-6">
      <div
        className="relative flex flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-2 -right-2 z-10 w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 text-white flex items-center justify-center text-sm shadow-lg"
        >
          ✕
        </button>

        {/* Theme switcher */}
        <div className="flex gap-2 w-full max-w-[360px]">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                theme === t.id
                  ? 'bg-indigo-600 text-white shadow-lg scale-105'
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
            >
              <span className="text-base">{t.emoji}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Story card */}
        <StoryCard report={report} cardRef={cardRef} theme={theme} />

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
    </div>
  )
}
