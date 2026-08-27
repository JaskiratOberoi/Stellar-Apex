import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowSquareOut, CircleNotch, Copy, IdentificationCard, X } from '@phosphor-icons/react'
import { API_BASE, apiFetch, getToken } from '../lib/api'
import { cx } from '../lib/utils'
import { EmptyState } from '../components/ui'

/**
 * HR view of the PUBLIC field-onboarding queue (submissions from /onboard).
 * Photos are fetched with the auth token — each view is audited server-side.
 */

const inr = (n) =>
  n == null ? '—' : '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })

const STATUS_TONE = {
  pending: 'bg-amber-soft text-amber-ink',
  processed: 'bg-mint-soft text-mint',
  rejected: 'bg-rose-soft text-rose-ink',
}

function PhotoButton({ id, which, label }) {
  const [busy, setBusy] = useState(false)
  const [img, setImg] = useState(null)

  const open = async () => {
    setBusy(true)
    try {
      const res = await fetch(`${API_BASE}/onboarding/${id}/photo/${which}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (!res.ok) throw new Error()
      setImg(URL.createObjectURL(await res.blob()))
    } catch {
      /* leave closed */
    } finally {
      setBusy(false)
    }
  }
  const close = () => {
    if (img) URL.revokeObjectURL(img)
    setImg(null)
  }

  return (
    <>
      <button
        onClick={open}
        disabled={busy}
        className="inline-flex items-center gap-1 text-[12px] font-semibold text-accent-text hover:underline disabled:opacity-50 cursor-pointer"
      >
        {busy ? <CircleNotch size={12} className="animate-spin" /> : <ArrowSquareOut size={12} />}
        {label}
      </button>
      {img && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/70 px-4" onClick={close}>
          <div className="max-w-2xl w-full bg-surface-high rounded-2xl shadow-pop overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-hairline">
              <p className="text-[13.5px] font-semibold capitalize">{which} photo</p>
              <button onClick={close} className="p-1.5 rounded-lg text-ink-faint hover:text-ink cursor-pointer" aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <img src={img} alt={`${which} document`} className="w-full max-h-[70vh] object-contain bg-ink/5" />
          </div>
        </div>
      )}
    </>
  )
}

export default function OnboardingQueue() {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    try {
      setRows(await apiFetch('/onboarding'))
    } catch (err) {
      setError(err.message)
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const formUrl = `${window.location.origin}/onboard`
  const copyLink = () => navigator.clipboard?.writeText(formUrl).catch(() => {})

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-[26px] font-bold tracking-tight">Onboarding</h1>
          <p className="text-[13px] text-ink-faint mt-0.5">
            Field submissions from the public form — review, then add to the register.
          </p>
        </div>
        <button
          onClick={copyLink}
          title={formUrl}
          className="inline-flex items-center gap-1.5 h-9 rounded-[10px] border border-hairline bg-surface-high hover:border-hairline-strong text-[12.5px] font-semibold px-3 transition-colors cursor-pointer"
        >
          <Copy size={14} /> Copy form link
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-5 bg-surface rounded-2xl border border-hairline shadow-card overflow-x-auto"
      >
        {error ? (
          <EmptyState icon={IdentificationCard} title="Could not load submissions" hint={error} />
        ) : rows === null ? (
          <div className="py-16 grid place-items-center text-ink-faint">
            <CircleNotch size={22} className="animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={IdentificationCard}
            title="No submissions yet"
            hint="Share the public form link with the field team — new entries appear here."
          />
        ) : (
          <table className="w-full text-left border-collapse min-w-[720px]">
            <thead>
              <tr className="text-[10.5px] uppercase tracking-[0.1em] text-ink-faint border-b border-hairline">
                <th className="py-2.5 pl-4 pr-3 font-semibold">Name</th>
                <th className="px-3 font-semibold">Designation</th>
                <th className="px-3 font-semibold">Area</th>
                <th className="px-3 font-semibold">Location</th>
                <th className="px-3 font-semibold text-right">Fixed salary</th>
                <th className="px-3 font-semibold text-right">Expense</th>
                <th className="px-3 font-semibold">Documents</th>
                <th className="px-3 font-semibold">Status</th>
                <th className="pr-4 pl-3 font-semibold">Received</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-b border-hairline last:border-0">
                  <td className="py-3 pl-4 pr-3 text-[13.5px] font-semibold">{s.name}</td>
                  <td className="px-3">
                    <span className="font-mono text-[12px] bg-slate-soft rounded px-1.5 py-0.5">{s.designation}</span>
                  </td>
                  <td className="px-3 text-[13px] text-ink-soft">{s.area ?? '—'}</td>
                  <td className="px-3 text-[13px] text-ink-soft">{s.location ?? '—'}</td>
                  <td className="px-3 text-[13px] text-right font-mono">{inr(s.fixedSalary)}</td>
                  <td className="px-3 text-[13px] text-right font-mono">{inr(s.expenseComponent)}</td>
                  <td className="px-3 whitespace-nowrap">
                    <span className="inline-flex gap-3">
                      {s.hasAadhaarPhoto && <PhotoButton id={s.id} which="aadhaar" label="Aadhaar" />}
                      {s.hasPanPhoto && <PhotoButton id={s.id} which="pan" label="PAN" />}
                    </span>
                  </td>
                  <td className="px-3">
                    <span className={cx('inline-flex rounded-full px-2 py-0.5 text-[11.5px] font-semibold capitalize', STATUS_TONE[s.status])}>
                      {s.status}
                    </span>
                  </td>
                  <td className="pr-4 pl-3 text-[12px] text-ink-faint whitespace-nowrap">
                    {new Date(s.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </motion.div>
    </div>
  )
}
