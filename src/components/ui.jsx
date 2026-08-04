import { useEffect, useState } from 'react'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { STATUSES } from '../data/seed'
import { avatarTone, cx, initials } from '../lib/utils'

/* ---------------- Avatar ---------------- */
export function Avatar({ name, photo, size = 40, className }) {
  const [bg, fg] = avatarTone(name)
  const style = { width: size, height: size, fontSize: size * 0.36 }
  if (photo) {
    return (
      <img
        src={photo}
        alt={name}
        style={style}
        className={cx('rounded-full object-cover shrink-0 ring-1 ring-black/[0.06]', className)}
      />
    )
  }
  return (
    <div
      style={{ ...style, background: bg, color: fg }}
      className={cx(
        'rounded-full shrink-0 grid place-items-center font-semibold tracking-wide select-none ring-1 ring-black/[0.06]',
        className,
      )}
    >
      {initials(name)}
    </div>
  )
}

/* ---------------- Status pill ---------------- */
const TONE_CLASSES = {
  mint: 'bg-mint-soft text-mint',
  amber: 'bg-amber-soft text-amber-ink',
  rose: 'bg-rose-soft text-rose-ink',
  slate: 'bg-slate-soft text-ink-soft',
}

export function StatusPill({ status, className }) {
  const s = STATUSES[status] ?? STATUSES.active
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ring-current/10',
        TONE_CLASSES[s.tone],
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
          <h3 className="font-display text-[15px] font-semibold">{title}</h3>
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
        className="text-ink-faint hover:text-iris transition-colors cursor-pointer disabled:opacity-50"
        title={show ? 'Hide' : 'Reveal'}
      >
        {loading ? <Loader2 size={13} className="animate-spin" /> : show ? <EyeOff size={13} /> : <Eye size={13} />}
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
      <span className="absolute text-[11px] font-bold" style={{ color: tone }}>
        {pct}
      </span>
    </div>
  )
}

/* ---------------- Empty state ---------------- */
export function EmptyState({ icon: Icon, title, hint }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && <Icon size={28} className="text-ink-faint mb-3" />}
      <p className="font-display font-semibold text-[15px]">{title}</p>
      {hint && <p className="text-[13px] text-ink-faint mt-1">{hint}</p>}
    </div>
  )
}
