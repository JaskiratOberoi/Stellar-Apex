import { useEffect, useState } from 'react'
import { Eye, EyeSlash, CircleNotch } from '@phosphor-icons/react'
import { STATUSES } from '../data/seed'
import { avatarTone, cx, initials } from '../lib/utils'

/* ---------------- Avatar — squircle, not circle ---------------- */
export function Avatar({ name, photo, size = 40, className }) {
  const [bg, fg] = avatarTone(name)
  const style = { width: size, height: size, fontSize: size * 0.34, borderRadius: size * 0.3 }
  if (photo) {
    return (
      <img
        src={photo}
        alt={name}
        style={style}
        className={cx('object-cover shrink-0 ring-1 ring-black/[0.07]', className)}
      />
    )
  }
  return (
    <div
      style={{ ...style, background: bg, color: fg }}
      className={cx(
        'shrink-0 grid place-items-center font-display font-bold tracking-wide select-none ring-1 ring-black/[0.07]',
        className,
      )}
    >
      {initials(name)}
    </div>
  )
}

/* ---------------- Status mark — quiet dot + label ---------------- */
const TONE_TEXT = {
  mint: 'text-mint',
  amber: 'text-amber-ink',
  rose: 'text-rose-ink',
  slate: 'text-ink-faint',
}

export function StatusPill({ status, className }) {
  const s = STATUSES[status] ?? STATUSES.active
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 text-[12px] font-semibold whitespace-nowrap',
        TONE_TEXT[s.tone],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {s.label}
    </span>
  )
}

/* ---------------- Card & fields ---------------- */
export function SectionCard({ title, action, children, className }) {
  return (
    <section
      className={cx('bg-surface rounded-2xl border border-hairline shadow-card', className)}
    >
      {title && (
        <header className="flex items-center justify-between px-5 pt-4 pb-1">
          <h3 className="font-display text-[15px] font-bold tracking-tight">{title}</h3>
          {action}
        </header>
      )}
      <div className="px-5 pb-5 pt-2">{children}</div>
    </section>
  )
}

export function FieldRow({ label, children, mono }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 border-b border-hairline last:border-0">
      <dt className="text-[13px] text-ink-faint shrink-0">{label}</dt>
      <dd className={cx('text-[13.5px] font-medium text-right', mono && 'font-mono text-[12.5px]')}>
        {children ?? '—'}
      </dd>
    </div>
  )
}

/* ---------------- Masked value (click-to-reveal, auto re-mask) ----------------
 * Two modes:
 *  - `revealed` (sync): the full value is already in hand (non-sensitive fields).
 *  - `onReveal` (async): fetches the full value from the audited reveal endpoint
 *    only when the user clicks — the browser never holds Aadhaar/PAN/bank until
 *    then. Auto re-masks (and drops the fetched value) after 10s.
 */
export function MaskedValue({ masked, revealed, onReveal }) {
  const [show, setShow] = useState(false)
  const [fetched, setFetched] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!show) return
    const t = setTimeout(() => {
      setShow(false)
      setFetched(null) // don't keep the revealed value around
    }, 10_000)
    return () => clearTimeout(t)
  }, [show])

  // Nothing to reveal — masked is empty and no async source.
  if (!masked && !revealed && !onReveal) return <span>—</span>

  const full = onReveal ? fetched : revealed

  const toggle = async () => {
    if (show) {
      setShow(false)
      setFetched(null)
      return
    }
    if (onReveal) {
      setLoading(true)
      try {
        const value = await onReveal()
        setFetched(value)
        setShow(true)
      } catch {
        /* keep masked on failure */
      } finally {
        setLoading(false)
      }
    } else {
      setShow(true)
    }
  }

  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[12.5px]">
      {show && full ? full : masked || '—'}
      <button
        type="button"
        onClick={toggle}
        disabled={loading}
        className="text-ink-faint hover:text-accent transition-colors cursor-pointer disabled:opacity-50"
        title={show ? 'Hide' : 'Reveal'}
      >
        {loading ? (
          <CircleNotch size={13} className="animate-spin" />
        ) : show ? (
          <EyeSlash size={13} />
        ) : (
          <Eye size={13} />
        )}
      </button>
    </span>
  )
}

/* ---------------- Completeness ring ---------------- */
export function ProgressRing({ pct, size = 44 }) {
  const r = (size - 6) / 2
  const c = 2 * Math.PI * r
  const tone = pct >= 90 ? 'var(--color-mint)' : pct >= 70 ? 'var(--color-amber-ink)' : 'var(--color-rose-ink)'
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-hairline)" strokeWidth="4" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
        />
      </svg>
      <span className="absolute text-[11px] font-bold font-mono" style={{ color: tone }}>
        {pct}
      </span>
    </div>
  )
}

/* ---------------- Empty state ---------------- */
export function EmptyState({ icon: Icon, title, hint }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && (
        <span className="grid place-items-center size-11 rounded-xl bg-slate-soft text-ink-faint mb-3">
          <Icon size={22} />
        </span>
      )}
      <p className="font-display font-bold text-[15px] tracking-tight">{title}</p>
      {hint && <p className="text-[13px] text-ink-faint mt-1">{hint}</p>}
    </div>
  )
}
