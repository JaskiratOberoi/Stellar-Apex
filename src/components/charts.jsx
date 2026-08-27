import { useState } from 'react'
import { cx } from '../lib/utils'

/* ------------------------------------------------------------------
 * Minimal chart kit for the Ledger language.
 * Single-hue marks (the portal accent), ink-token text, recessive
 * axes, per-mark hover with a tooltip. No chart library needed.
 * ------------------------------------------------------------------ */

/* ---- Vertical mini bars (time series) ----
 * points: [{ label, value, sub? }] — label shown in tooltip and as
 * sparse tick text (every `tickEvery`-th).
 */
export function TrendBars({ points, height = 92, tickEvery = 3 }) {
  const [hover, setHover] = useState(null)
  const max = Math.max(1, ...points.map((p) => p.value))

  return (
    <div>
      <div className="relative flex items-end gap-[3px]" style={{ height }}>
        {hover !== null && (
          <div
            className="absolute -top-1 -translate-y-full z-10 pointer-events-none rounded-lg bg-ink text-paper text-[11px] font-medium px-2.5 py-1.5 whitespace-nowrap shadow-pop"
            style={{
              left: `${((hover + 0.5) / points.length) * 100}%`,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <span className="font-mono tabular-nums">{points[hover].value}</span>
            {' · '}
            {points[hover].label}
          </div>
        )}
        {points.map((p, i) => (
          <div
            key={p.label}
            className="flex-1 h-full flex items-end cursor-default"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <div
              className={cx(
                'w-full rounded-t-[3px] transition-colors',
                hover === i ? 'bg-accent-deep' : 'bg-accent',
              )}
              style={{ height: `${Math.max(3, (p.value / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-[3px] mt-1.5">
        {points.map((p, i) => (
          <span
            key={p.label}
            className="flex-1 text-center text-[10px] text-ink-faint font-mono"
          >
            {i % tickEvery === 0 ? p.tick ?? p.label.slice(0, 1) : ''}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ---- Horizontal bar list (category magnitudes) ----
 * items: [{ label, value }] — one hue, bare bars (no filled track),
 * values in ink-token mono to the right.
 */
export function HBarList({ items, className }) {
  const max = Math.max(1, ...items.map((d) => d.value))
  return (
    <div className={cx('space-y-2.5', className)}>
      {items.map((d) => (
        <div key={d.label} className="group" title={`${d.label}: ${d.value}`}>
          <div className="flex items-baseline justify-between gap-3 mb-1">
            <span className="text-[12.5px] text-ink-soft truncate">{d.label}</span>
            <span className="text-[12px] font-mono tabular-nums font-medium">{d.value}</span>
          </div>
          <div
            className="h-[7px] rounded-[3px] bg-accent group-hover:bg-accent-deep transition-colors"
            style={{ width: `${Math.max(2, (d.value / max) * 100)}%` }}
          />
        </div>
      ))}
    </div>
  )
}

/* ---- Big stat with optional delta ---- */
export function Stat({ label, value, delta, deltaTone = 'mint', hint }) {
  return (
    <div>
      <p className="text-[11.5px] font-semibold text-ink-faint uppercase tracking-[0.08em]">
        {label}
      </p>
      <div className="flex items-baseline gap-2 mt-0.5">
        <p className="font-display text-[32px] leading-[1.1] font-bold tracking-tight tabular-nums">
          {value}
        </p>
        {delta && (
          <span
            className={cx(
              'text-[12px] font-semibold font-mono',
              deltaTone === 'mint' ? 'text-mint' : deltaTone === 'rose' ? 'text-rose-ink' : 'text-ink-faint',
            )}
          >
            {delta}
          </span>
        )}
      </div>
      {hint && <p className="text-[11.5px] text-ink-faint mt-0.5">{hint}</p>}
    </div>
  )
}

/* ---- "Sample data" tag for previews that aren't backed by live data ---- */
export function SampleTag({ children = 'Sample data' }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-soft text-amber-ink text-[10.5px] font-bold uppercase tracking-[0.08em] px-2 py-0.5">
      {children}
    </span>
  )
}
