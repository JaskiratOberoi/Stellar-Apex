import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cx } from '../lib/utils'
import { DUR, EASE_OUT } from '../lib/motion'

/* ------------------------------------------------------------------
 * Minimal chart kit for the Ledger language.
 * Single-hue marks (the portal accent), ink-token text, recessive
 * axes, per-mark hover with a tooltip. No chart library needed.
 * Marks grow in on first paint and glide to new values after that.
 * ------------------------------------------------------------------ */

/* ---- Vertical mini bars (time series) ----
 * points: [{ label, value, tick? }] — label shown in tooltip and as
 * sparse tick text (every `tickEvery`-th).
 */
export function TrendBars({ points, height = 92, tickEvery = 3 }) {
  const [hover, setHover] = useState(null)
  const max = Math.max(1, ...points.map((p) => p.value))

  return (
    <div>
      <div className="relative flex items-end gap-[3px]" style={{ height }} onMouseLeave={() => setHover(null)}>
        <AnimatePresence>
          {hover !== null && points[hover] && (
            <motion.div
              key="tip"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0, left: `${((hover + 0.5) / points.length) * 100}%` }}
              exit={{ opacity: 0, transition: { duration: DUR.fast } }}
              transition={{ duration: DUR.fast, ease: EASE_OUT }}
              className="absolute -top-2 z-10 pointer-events-none rounded-lg bg-ink text-paper text-[11px] font-medium px-2.5 py-1.5 whitespace-nowrap shadow-pop -translate-x-1/2 -translate-y-full"
            >
              <span className="font-mono tabular-nums">{points[hover].value}</span>
              {' · '}
              {points[hover].label}
            </motion.div>
          )}
        </AnimatePresence>
        {points.map((p, i) => (
          <div
            key={p.label}
            tabIndex={0}
            aria-label={`${p.label}: ${p.value}`}
            className="flex-1 h-full flex items-end cursor-default outline-none group"
            onMouseEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
          >
            <motion.div
              className={cx(
                'w-full rounded-t-[3px] transition-colors duration-[var(--dur-fast)] group-focus-visible:bg-accent-deep',
                hover === i ? 'bg-accent-deep' : 'bg-accent',
              )}
              initial={{ height: '0%' }}
              animate={{ height: `${Math.max(3, (p.value / max) * 100)}%` }}
              transition={{ duration: 0.5, ease: EASE_OUT, delay: i * 0.018 }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-[3px] mt-1.5">
        {points.map((p, i) => (
          <span key={p.label} className="flex-1 text-center text-[10px] text-ink-faint font-mono">
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
      {items.map((d, i) => (
        <div key={d.label} className="group" title={`${d.label}: ${d.value}`}>
          <div className="flex items-baseline justify-between gap-3 mb-1">
            <span className="text-[12.5px] text-ink-soft truncate">{d.label}</span>
            <span className="text-[12px] font-mono tabular-nums font-medium">{d.value}</span>
          </div>
          <motion.div
            className="h-[7px] rounded-[3px] bg-accent group-hover:bg-accent-deep transition-colors duration-[var(--dur-fast)]"
            initial={{ width: '0%' }}
            animate={{ width: `${Math.max(2, (d.value / max) * 100)}%` }}
            transition={{ duration: 0.5, ease: EASE_OUT, delay: i * 0.03 }}
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
      <p className="text-[11.5px] font-semibold text-ink-faint uppercase tracking-[0.08em]">{label}</p>
      <div className="flex items-baseline gap-2 mt-0.5">
        <p className="font-display text-[clamp(22px,2.3vw,32px)] leading-[1.1] font-bold tracking-tight tabular-nums whitespace-nowrap">{value}</p>
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
