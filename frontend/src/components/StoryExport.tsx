import type { ReactNode, Ref } from 'react'
import { toPng } from 'html-to-image'

// ─────────────────────────────────────────────────────────────────────────────
// Shared story-export system. One frame, one capture engine, two on-brand themes.
// Monthly Report & Leaderboard both plug their own content into <StoryFrame>.
// Canvas size 360×640 @ pixelRatio 3 → 1080×1920 (Instagram Story).
// ─────────────────────────────────────────────────────────────────────────────

export type StoryTheme = 'light' | 'dark'

export const STORY_W = 360
export const STORY_H = 640

/** Brand palette resolved per theme — single source of truth for exports. */
export interface StoryPalette {
  bg: string
  panel: string
  panelBorder: string
  text: string
  textMuted: string
  textFaint: string
  brand: string      // court green
  brandSoft: string  // court tint for panels/bars
  accent: string     // ace lime — data highlight
  divider: string
  pos: string        // positive (win/+)
  neg: string        // negative (loss/−)
  warn: string
}

export const PALETTES: Record<StoryTheme, StoryPalette> = {
  light: {
    bg: '#ffffff',
    panel: '#fafafa',
    panelBorder: '#e4e4e7',
    text: '#18181b',
    textMuted: '#52525b',
    textFaint: '#a1a1aa',
    brand: '#16a34a',
    brandSoft: '#f0fdf4',
    accent: '#65a30d',
    divider: '#e4e4e7',
    pos: '#16a34a',
    neg: '#dc2626',
    warn: '#d97706',
  },
  dark: {
    bg: '#18181b',
    panel: '#27272a',
    panelBorder: '#3f3f46',
    text: '#fafafa',
    textMuted: '#a1a1aa',
    textFaint: '#71717a',
    brand: '#4ade80',
    brandSoft: 'rgba(74,222,128,0.12)',
    accent: '#a3e635',
    divider: '#3f3f46',
    pos: '#4ade80',
    neg: '#f87171',
    warn: '#fbbf24',
  },
}

const FONT = "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif"

interface FrameProps {
  cardRef: Ref<HTMLDivElement>
  theme: StoryTheme
  eyebrow: string
  title: string
  children: ReactNode
}

/** The shared story card: brand header + pluggable body + brand footer. */
export function StoryFrame({ cardRef, theme, eyebrow, title, children }: FrameProps) {
  const p = PALETTES[theme]
  return (
    <div
      ref={cardRef}
      style={{
        width: STORY_W,
        height: STORY_H,
        background: p.bg,
        borderRadius: 16,
        overflow: 'hidden',
        fontFamily: FONT,
        color: p.text,
        padding: '26px 22px 18px',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        position: 'relative',
      }}
    >
      {/* Brand accent bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: p.brand }} />

      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: p.brand, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 4 }}>
          {eyebrow}
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.02em', color: p.text }}>
          {title}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>{children}</div>

      {/* Footer */}
      <div style={{ marginTop: 'auto', paddingTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: `1px solid ${p.divider}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 6, background: p.brand }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="1" />
            </svg>
          </span>
          <span style={{ fontSize: 13, fontWeight: 800, color: p.text, letterSpacing: '-0.01em' }}>trackquet</span>
        </div>
        <span style={{ fontSize: 9, color: p.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Track your game</span>
      </div>
    </div>
  )
}

/** Reusable stat tile for story bodies. */
export function StoryStat({ label, value, theme, accent }: { label: string; value: string; theme: StoryTheme; accent?: boolean }) {
  const p = PALETTES[theme]
  return (
    <div style={{ background: p.panel, border: `1px solid ${p.panelBorder}`, borderRadius: 12, padding: '12px 10px', textAlign: 'center' }}>
      <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.02em', color: accent ? p.brand : p.text, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      <div style={{ fontSize: 9, color: p.textMuted, marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
        {label}
      </div>
    </div>
  )
}

/** Section heading for story bodies. */
export function StorySectionLabel({ children, theme }: { children: ReactNode; theme: StoryTheme }) {
  const p = PALETTES[theme]
  return (
    <div style={{ fontSize: 9, fontWeight: 700, color: p.brand, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>
      {children}
    </div>
  )
}

/** One capture engine for all exports. Returns a PNG blob at story resolution. */
export async function captureStory(el: HTMLDivElement | null): Promise<Blob> {
  if (!el) throw new Error('Story card not mounted')
  if ('fonts' in document) {
    await (document as Document & { fonts?: FontFaceSet }).fonts?.ready
  }
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  const dataUrl = await toPng(el, {
    pixelRatio: 3,
    width: STORY_W,
    height: el.offsetHeight,
    cacheBust: true,
    skipFonts: false,
  })
  const res = await fetch(dataUrl)
  return res.blob()
}

/** Shared theme switcher UI (in-app, uses Tailwind tokens, not the palette). */
export function StoryThemeToggle({ theme, onChange }: { theme: StoryTheme; onChange: (t: StoryTheme) => void }) {
  const opts: { id: StoryTheme; label: string }[] = [
    { id: 'light', label: 'Light' },
    { id: 'dark', label: 'Dark' },
  ]
  return (
    <div className="flex gap-2 w-full max-w-[360px]">
      {opts.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`flex-1 py-2 rounded-control text-caption font-semibold transition-all ${
            theme === o.id
              ? 'bg-court-600 text-white shadow-sm'
              : 'bg-white/10 text-ink-200 hover:bg-white/20'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
