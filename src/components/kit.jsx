import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, animate, motion, useReducedMotion } from 'framer-motion'
import { CaretLeft, CaretRight, Check, CircleNotch, Warning, X } from '@phosphor-icons/react'
import { cx, monthLabel, shiftMonth } from '../lib/utils'
import { DUR, EASE_IN, EASE_OUT, collapse, spring } from '../lib/motion'
import { useEntity } from '../store/EntityContext'

/* ------------------------------------------------------------------
 * Shared UI kit — the one place buttons, fields, overlays, toasts and
 * loading states are defined, so every screen moves and reads alike.
 * ------------------------------------------------------------------ */

/* ---------------- Button ---------------- */
const BTN_VARIANT = {
  primary: 'bg-accent text-white hover:bg-accent-deep disabled:bg-slate-soft disabled:text-ink-faint',
  secondary:
    'bg-surface text-ink border border-hairline hover:border-hairline-strong hover:bg-surface-high disabled:text-ink-faint',
  ghost: 'text-ink-soft hover:text-ink hover:bg-slate-soft disabled:text-ink-faint',
  danger: 'bg-rose-ink text-white hover:brightness-90 disabled:bg-slate-soft disabled:text-ink-faint',
  'danger-ghost': 'text-rose-ink hover:bg-rose-soft disabled:text-ink-faint',
}
const BTN_SIZE = {
  sm: 'h-8 px-2.5 text-[12.5px] gap-1.5',
  md: 'h-9 px-3.5 text-[13px] gap-1.5',
  lg: 'h-11 px-5 text-[14px] gap-2',
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  loading = false,
  done = false,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        'inline-flex items-center justify-center rounded-[10px] font-semibold whitespace-nowrap select-none',
        'transition-[background-color,border-color,color,transform,filter] duration-[var(--dur-fast)]',
        'enabled:cursor-pointer enabled:active:scale-[0.97] disabled:cursor-not-allowed',
        BTN_VARIANT[variant],
        BTN_SIZE[size],
        className,
      )}
      {...rest}
    >
      {loading ? (
        <CircleNotch size={size === 'lg' ? 16 : 14} className="animate-spin" />
      ) : done ? (
        <Check size={size === 'lg' ? 16 : 14} weight="bold" className="animate-pop" />
      ) : (
        Icon && <Icon size={size === 'lg' ? 16 : 14} weight="bold" />
      )}
      {children}
    </button>
  )
}

/* ---------------- Form fields ---------------- */
export const inputCls =
  'w-full h-10 rounded-[10px] border border-hairline bg-surface-high px-3 text-[13.5px] outline-none ' +
  'transition-[border-color,box-shadow] duration-[var(--dur-fast)] placeholder:text-ink-faint ' +
  'hover:border-hairline-strong focus:border-accent focus:ring-2 focus:ring-accent/15 ' +
  'disabled:bg-slate-soft disabled:text-ink-faint aria-[invalid=true]:border-rose-ink'

export function Field({ label, hint, error, required, className, children }) {
  return (
    <label className={cx('block', className)}>
      {label && (
        <span className="block text-[12px] font-semibold text-ink-soft mb-1.5">
          {label}
          {required && <span className="text-rose-ink"> *</span>}
        </span>
      )}
      {children}
      <AnimatePresence initial={false}>
        {error ? (
          <motion.span key="error" {...collapse} role="alert" className="block overflow-hidden text-[12px] text-rose-ink">
            <span className="block pt-1">{error}</span>
          </motion.span>
        ) : hint ? (
          <span key="hint" className="block text-[11.5px] text-ink-faint mt-1">
            {hint}
          </span>
        ) : null}
      </AnimatePresence>
    </label>
  )
}

export function TextInput({ className, invalid, ...rest }) {
  return <input aria-invalid={invalid || undefined} className={cx(inputCls, className)} {...rest} />
}

export function Select({ className, children, invalid, ...rest }) {
  return (
    <select aria-invalid={invalid || undefined} className={cx(inputCls, 'cursor-pointer pr-8', className)} {...rest}>
      {children}
    </select>
  )
}

/* Rupee amount input: digits only, right-aligned, mono. */
export function AmountInput({ value, onChange, className, ...rest }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12.5px] text-ink-faint pointer-events-none">₹</span>
      <input
        inputMode="decimal"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ''))}
        className={cx(inputCls, 'pl-7 text-right font-mono tabular-nums', className)}
        {...rest}
      />
    </div>
  )
}

export function Toggle({ checked, onChange, label, hint, disabled }) {
  return (
    <label className={cx('flex items-start gap-3 py-1.5', disabled ? 'opacity-60' : 'cursor-pointer')}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors duration-[var(--dur-base)] enabled:cursor-pointer',
          checked ? 'bg-accent' : 'bg-hairline-strong',
        )}
      >
        <motion.span
          layout
          transition={spring}
          className={cx('absolute top-0.5 size-4 rounded-full bg-white shadow-sm', checked ? 'right-0.5' : 'left-0.5')}
        />
      </button>
      <span className="leading-tight">
        <span className="block text-[13px] font-medium">{label}</span>
        {hint && <span className="block text-[11.5px] text-ink-faint mt-0.5">{hint}</span>}
      </span>
    </label>
  )
}

/* ---------------- Dialog ----------------
 * Portaled to <body> so nothing clips it; re-applies the portal theme class
 * so accent colours still resolve. Escape and backdrop close; focus is moved
 * in, trapped, and returned to the opener. */
export function Dialog({ open, onClose, title, description, children, footer, size = 'md', hue }) {
  const { entity } = useEntity()
  const panelRef = useRef(null)
  const titleId = useId()
  const theme = hue || entity?.hue

  useEffect(() => {
    if (!open) return
    const opener = document.activeElement
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose?.()
      }
      if (e.key === 'Tab' && panelRef.current) {
        const nodes = panelRef.current.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        )
        if (!nodes.length) return
        const first = nodes[0]
        const last = nodes[nodes.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const t = setTimeout(() => {
      // Leave focus alone if the person has already clicked into the dialog.
      if (panelRef.current?.contains(document.activeElement)) return
      const target = panelRef.current?.querySelector('[data-autofocus]') || panelRef.current
      target?.focus()
    }, 30)
    return () => {
      clearTimeout(t)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      opener?.focus?.()
    }
  }, [open, onClose])

  const width = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size]

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className={cx('fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-6', theme && `portal-${theme}`)}>
          <motion.div
            className="absolute inset-0 bg-ink/55"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: DUR.base } }}
            exit={{ opacity: 0, transition: { duration: DUR.base } }}
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            tabIndex={-1}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: DUR.slow, ease: EASE_OUT } }}
            exit={{ opacity: 0, y: 12, scale: 0.98, transition: { duration: DUR.base, ease: EASE_IN } }}
            className={cx(
              'relative w-full bg-surface shadow-pop outline-none flex flex-col max-h-[92dvh]',
              'rounded-t-2xl sm:rounded-2xl border border-hairline',
              width,
            )}
          >
            {(title || onClose) && (
              <header className="flex items-start justify-between gap-4 px-5 pt-4 pb-3 shrink-0">
                <div className="min-w-0">
                  {title && (
                    <h2 id={titleId} className="font-display text-[17px] font-bold tracking-tight">
                      {title}
                    </h2>
                  )}
                  {description && <p className="text-[12.5px] text-ink-faint mt-0.5">{description}</p>}
                </div>
                {onClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="-mr-1.5 -mt-0.5 p-1.5 rounded-lg text-ink-faint hover:text-ink hover:bg-slate-soft transition-colors cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                )}
              </header>
            )}
            <div className="px-5 pb-5 overflow-y-auto">{children}</div>
            {footer && (
              <footer className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-hairline bg-paper/60 rounded-b-2xl shrink-0">
                {footer}
              </footer>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/* Yes / no confirmation built on Dialog. */
export function ConfirmDialog({ open, onClose, onConfirm, title, children, confirmLabel = 'Confirm', danger, busy }) {
  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={busy} data-autofocus>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-[13.5px] text-ink-soft leading-relaxed">{children}</div>
    </Dialog>
  )
}

/* ---------------- Toasts ---------------- */
const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const seq = useRef(0)

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), [])
  const push = useCallback(
    (tone, message, opts = {}) => {
      const id = ++seq.current
      setToasts((t) => [...t.slice(-3), { id, tone, message }])
      setTimeout(() => dismiss(id), opts.duration ?? (tone === 'error' ? 6000 : 3200))
      return id
    },
    [dismiss],
  )
  const api = useMemo(
    () => ({
      success: (m, o) => push('success', m, o),
      error: (m, o) => push('error', m, o),
      info: (m, o) => push('info', m, o),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div
          aria-live="polite"
          className="fixed z-[90] bottom-4 inset-x-4 sm:inset-x-auto sm:right-5 sm:bottom-5 flex flex-col items-center sm:items-end gap-2 pointer-events-none"
        >
          <AnimatePresence initial={false}>
            {toasts.map((t) => (
              <motion.div
                key={t.id}
                layout
                role={t.tone === 'error' ? 'alert' : 'status'}
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: DUR.base, ease: EASE_OUT } }}
                exit={{ opacity: 0, x: 24, transition: { duration: DUR.base, ease: EASE_IN } }}
                className="pointer-events-auto flex items-center gap-2.5 max-w-sm rounded-xl bg-ink text-paper pl-3 pr-2 py-2.5 shadow-pop text-[13px] font-medium"
              >
                <span
                  className={cx(
                    'grid place-items-center size-5 rounded-full shrink-0',
                    t.tone === 'error' ? 'bg-rose-ink' : t.tone === 'success' ? 'bg-mint' : 'bg-ink-soft',
                  )}
                >
                  {t.tone === 'error' ? <Warning size={11} weight="bold" /> : <Check size={11} weight="bold" />}
                </span>
                <span className="leading-snug">{t.message}</span>
                <button
                  onClick={() => dismiss(t.id)}
                  aria-label="Dismiss"
                  className="p-1 rounded-md text-paper/60 hover:text-paper hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X size={12} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

export const useToast = () => {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}

/* ---------------- Loading placeholders ---------------- */
export function Skeleton({ className, style }) {
  return <div aria-hidden className={cx('skeleton', className)} style={style} />
}

export function SkeletonRows({ rows = 5, className }) {
  return (
    <div className={cx('space-y-2.5', className)} role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-9 shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3" style={{ width: `${55 - (i % 3) * 12}%` }} />
            <Skeleton className="h-2.5" style={{ width: `${30 + (i % 2) * 10}%` }} />
          </div>
          <Skeleton className="h-3 w-16 hidden sm:block" />
        </div>
      ))}
    </div>
  )
}

/* ---------------- Tabs (underline slides between items) ---------------- */
export function Tabs({ tabs, value, onChange, className }) {
  const id = useId()
  return (
    <div role="tablist" className={cx('flex gap-1 overflow-x-auto overflow-y-hidden border-b border-hairline', className)}>
      {tabs.map((t) => {
        const active = t.id === value
        const Icon = t.icon
        return (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={cx(
              'relative inline-flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-semibold whitespace-nowrap cursor-pointer',
              'transition-colors duration-[var(--dur-fast)]',
              active ? 'text-accent-text' : 'text-ink-faint hover:text-ink',
            )}
          >
            {Icon && <Icon size={15} weight={active ? 'fill' : 'regular'} />}
            {t.label}
            {t.count != null && (
              <span
                className={cx(
                  'ml-0.5 rounded-md px-1.5 text-[10.5px] font-mono tabular-nums',
                  active ? 'bg-accent-soft text-accent-text' : 'bg-slate-soft text-ink-faint',
                )}
              >
                {t.count}
              </span>
            )}
            {active && (
              <motion.span
                layoutId={`tab-line-${id}`}
                transition={spring}
                className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-accent"
              />
            )}
          </button>
        )
      })}
    </div>
  )
}

/* ---------------- Segmented control (pill slides) ---------------- */
export function Segmented({ options, value, onChange, className, size = 'md' }) {
  const id = useId()
  return (
    <div className={cx('inline-flex rounded-[10px] bg-slate-soft p-0.5', className)}>
      {options.map((o) => {
        const active = o.id === value
        const Icon = o.icon
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={active}
            title={o.title}
            onClick={() => onChange(o.id)}
            className={cx(
              'relative inline-flex items-center gap-1.5 rounded-lg font-semibold cursor-pointer transition-colors duration-[var(--dur-fast)]',
              size === 'sm' ? 'h-7 px-2.5 text-[12px]' : 'h-8 px-3 text-[12.5px]',
              active ? 'text-ink' : 'text-ink-faint hover:text-ink-soft',
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                transition={spring}
                className="absolute inset-0 rounded-lg bg-surface-high shadow-card"
              />
            )}
            <span className="relative inline-flex items-center gap-1.5">
              {Icon && <Icon size={14} weight={active ? 'fill' : 'regular'} />}
              {o.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/* ---------------- Month picker (label slides the way time moves) ---------------- */
export function MonthPicker({ value, onChange, max, className }) {
  const dir = useRef(1)
  const go = (delta) => {
    dir.current = delta
    onChange(shiftMonth(value, delta))
  }
  const atMax = max && value >= max
  return (
    <div className={cx('inline-flex items-center gap-1 rounded-[10px] border border-hairline bg-surface p-0.5', className)}>
      <button
        type="button"
        onClick={() => go(-1)}
        aria-label="Previous month"
        className="grid place-items-center size-8 rounded-lg text-ink-soft hover:bg-slate-soft active:scale-95 transition-[background-color,transform] cursor-pointer"
      >
        <CaretLeft size={14} weight="bold" />
      </button>
      <div className="relative w-[124px] h-8 overflow-hidden" aria-live="polite">
        <AnimatePresence initial={false} custom={dir.current} mode="popLayout">
          <motion.span
            key={value}
            custom={dir.current}
            initial={{ opacity: 0, x: 14 * dir.current }}
            animate={{ opacity: 1, x: 0, transition: { duration: DUR.base, ease: EASE_OUT } }}
            exit={{ opacity: 0, x: -14 * dir.current, transition: { duration: DUR.fast } }}
            className="absolute inset-0 grid place-items-center font-display text-[13.5px] font-bold tracking-tight whitespace-nowrap"
          >
            {monthLabel(value)}
          </motion.span>
        </AnimatePresence>
      </div>
      <button
        type="button"
        onClick={() => go(1)}
        disabled={atMax}
        aria-label="Next month"
        className="grid place-items-center size-8 rounded-lg text-ink-soft enabled:hover:bg-slate-soft enabled:active:scale-95 disabled:opacity-35 transition-[background-color,transform] enabled:cursor-pointer"
      >
        <CaretRight size={14} weight="bold" />
      </button>
    </div>
  )
}

/* ---------------- Number that counts to its value ---------------- */
export function AnimatedNumber({ value, format = (n) => Math.round(n).toLocaleString('en-IN'), className }) {
  const reduce = useReducedMotion()
  const ref = useRef(null)
  const prev = useRef(0)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const to = Number(value) || 0
    if (reduce || prev.current === to) {
      node.textContent = format(to)
      prev.current = to
      return
    }
    const controls = animate(prev.current, to, {
      duration: 0.6,
      ease: EASE_OUT,
      onUpdate: (v) => {
        node.textContent = format(v)
      },
    })
    prev.current = to
    return () => controls.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduce])

  return (
    <span ref={ref} className={cx('tabular-nums', className)}>
      {format(prev.current)}
    </span>
  )
}

/* ---------------- Inline banner ---------------- */
const BANNER_TONE = {
  amber: 'bg-amber-soft text-amber-ink',
  rose: 'bg-rose-soft text-rose-ink',
  mint: 'bg-mint-soft text-mint',
  accent: 'bg-accent-soft text-accent-text',
}
export function Banner({ tone = 'amber', icon: Icon, children, action, className }) {
  return (
    <div className={cx('flex items-start gap-2.5 rounded-xl px-3.5 py-2.5 text-[12.5px] leading-relaxed', BANNER_TONE[tone], className)}>
      {Icon && <Icon size={15} weight="fill" className="mt-0.5 shrink-0" />}
      <div className="flex-1 min-w-0">{children}</div>
      {action}
    </div>
  )
}
