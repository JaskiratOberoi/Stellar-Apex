import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowCounterClockwise, ArrowSquareOut, CircleNotch, Copy, IdentificationCard, UserPlus, X } from '@phosphor-icons/react'
import { API_BASE, apiFetch, getToken } from '../lib/api'
import { cx, inr } from '../lib/utils'
import { fadeUp, listItem } from '../lib/motion'
import { useEntity } from '../store/EntityContext'
import { EmptyState } from '../components/ui'
import { Button, ConfirmDialog, Dialog, Segmented, SkeletonRows, useToast } from '../components/kit'

/**
 * HR view of the PUBLIC field-onboarding queue (submissions from /onboard),
 * scoped to this portal. A submission is turned into an employee record
 * (carrying its salary figures) or rejected. Photos are fetched with the
 * auth token; each view is audited server-side.
 */

const STATUS_TONE = {
  pending: 'bg-amber-soft text-amber-ink',
  processed: 'bg-mint-soft text-mint',
  rejected: 'bg-rose-soft text-rose-ink',
}
const STATUS_LABEL = { pending: 'Pending', processed: 'Added', rejected: 'Rejected' }
const PHOTO_TITLE = { aadhaar_front: 'Aadhaar · front', aadhaar_back: 'Aadhaar · back', pan_front: 'PAN · front', pan_back: 'PAN · back' }

function PhotoButton({ id, which, label, name }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [img, setImg] = useState(null)
  const [open, setOpen] = useState(false)

  const view = async () => {
    setBusy(true)
    try {
      const res = await fetch(`${API_BASE}/onboarding/${id}/photo/${which}`, {
        headers: { Authorization: `Bearer ${getToken()}`, 'X-Entity': localStorage.getItem('stellar-apex:entity:v1') || '' },
      })
      if (!res.ok) throw new Error()
      setImg(URL.createObjectURL(await res.blob()))
      setOpen(true)
    } catch {
      toast.error('Could not open that photo')
    } finally {
      setBusy(false)
    }
  }
  // Drop the decrypted image from memory once the dialog has closed.
  useEffect(() => {
    if (open || !img) return
    const t = setTimeout(() => {
      URL.revokeObjectURL(img)
      setImg(null)
    }, 300)
    return () => clearTimeout(t)
  }, [open, img])

  return (
    <>
      <button
        onClick={view}
        disabled={busy}
        className="inline-flex items-center gap-1 text-[12px] font-semibold text-accent-text hover:underline disabled:opacity-50 cursor-pointer"
      >
        {busy ? <CircleNotch size={12} className="animate-spin" /> : <ArrowSquareOut size={12} />}
        {label}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} size="lg" title={PHOTO_TITLE[which]} description={`${name} · this view is recorded in the audit log`}>
        {img && <img src={img} alt={`${PHOTO_TITLE[which]} of ${name}`} className="w-full max-h-[68vh] object-contain rounded-xl bg-ink/5" />}
      </Dialog>
    </>
  )
}

export default function OnboardingQueue() {
  const { entity } = useEntity()
  const navigate = useNavigate()
  const toast = useToast()
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('pending')
  const [copied, setCopied] = useState(false)
  const [rejecting, setRejecting] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      setRows(await apiFetch('/onboarding', { entity: entity.id }))
    } catch (err) {
      setError(err.message)
    }
  }, [entity.id])
  useEffect(() => {
    load()
  }, [load])

  const formUrl = `${window.location.origin}/onboard`
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(formUrl)
      setCopied(true)
      toast.success('Form link copied')
      setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error(`Could not copy. The link is ${formUrl}`)
    }
  }

  const setStatus = async (s, status) => {
    setBusy(true)
    try {
      const updated = await apiFetch(`/onboarding/${s.id}`, { method: 'PUT', body: { status }, entity: entity.id })
      setRows((list) => list.map((r) => (r.id === updated.id ? updated : r)))
      toast.success(status === 'rejected' ? `Rejected ${s.name}'s submission` : `Moved ${s.name} back to pending`)
      setRejecting(null)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const counts = { pending: 0, processed: 0, rejected: 0 }
  for (const r of rows ?? []) counts[r.status]++
  const shown = (rows ?? []).filter((r) => filter === 'all' || r.status === filter)

  return (
    <motion.div {...fadeUp} className="max-w-7xl mx-auto">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-[28px] font-bold tracking-tight">Onboarding</h1>
          <p className="text-[13px] text-ink-faint mt-0.5">Field submissions from the public form. Review each one, then add it to the register.</p>
        </div>
        <Button variant="secondary" icon={Copy} done={copied} onClick={copyLink} title={formUrl}>
          {copied ? 'Copied' : 'Copy form link'}
        </Button>
      </div>

      {rows && rows.length > 0 && (
        <Segmented
          className="mt-5"
          value={filter}
          onChange={setFilter}
          options={[
            { id: 'pending', label: `Pending ${counts.pending}` },
            { id: 'processed', label: `Added ${counts.processed}` },
            { id: 'rejected', label: `Rejected ${counts.rejected}` },
            { id: 'all', label: `All ${rows.length}` },
          ]}
        />
      )}

      <div className="mt-3 bg-surface rounded-2xl border border-hairline shadow-card overflow-x-auto">
        {error ? (
          <EmptyState icon={IdentificationCard} title="Could not load submissions" hint={error} />
        ) : rows === null ? (
          <div className="p-5">
            <SkeletonRows rows={5} />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState icon={IdentificationCard} title="No submissions yet" hint="Share the public form link with the field team. New entries appear here." />
        ) : shown.length === 0 ? (
          <EmptyState icon={IdentificationCard} title={`Nothing ${STATUS_LABEL[filter]?.toLowerCase() ?? 'here'}`} hint="Switch the filter above to see other submissions." />
        ) : (
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="text-[10.5px] uppercase tracking-[0.1em] text-ink-faint border-b border-hairline">
                <th className="py-2.5 pl-4 pr-3 font-semibold">Name</th>
                <th className="px-3 font-semibold">Area · Location</th>
                <th className="px-3 font-semibold text-right">Fixed salary</th>
                <th className="px-3 font-semibold text-right">Expenses</th>
                <th className="px-3 font-semibold">Documents</th>
                <th className="px-3 font-semibold">Status</th>
                <th className="pr-4 pl-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false} mode="popLayout">
                {shown.map((s) => (
                  <motion.tr key={s.id} layout="position" {...listItem} className="border-b border-hairline last:border-0 hover:bg-paper/60 transition-colors">
                    <td className="py-3 pl-4 pr-3">
                      <p className="text-[13.5px] font-semibold">{s.name}</p>
                      <p className="text-[11.5px] text-ink-faint">
                        <span className="font-mono bg-slate-soft rounded px-1 py-px text-ink-soft">{s.designation}</span>{' '}
                        · {new Date(s.createdAt.replace(' ', 'T')).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </p>
                    </td>
                    <td className="px-3 text-[13px] text-ink-soft">{[s.area, s.location].filter(Boolean).join(' · ') || '—'}</td>
                    <td className="px-3 text-[13px] text-right font-mono tabular-nums">{inr(s.fixedSalary)}</td>
                    <td className="px-3 text-[13px] text-right font-mono tabular-nums">{inr(s.expenseComponent)}</td>
                    <td className="px-3 whitespace-nowrap">
                      <div className="flex flex-col gap-0.5 text-[11.5px]">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="text-ink-faint w-14">Aadhaar</span>
                          {s.photos?.aadhaarFront && <PhotoButton id={s.id} name={s.name} which="aadhaar_front" label="Front" />}
                          {s.photos?.aadhaarBack && <PhotoButton id={s.id} name={s.name} which="aadhaar_back" label="Back" />}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="text-ink-faint w-14">PAN</span>
                          {s.photos?.panFront && <PhotoButton id={s.id} name={s.name} which="pan_front" label="Front" />}
                          {s.photos?.panBack && <PhotoButton id={s.id} name={s.name} which="pan_back" label="Back" />}
                        </span>
                      </div>
                    </td>
                    <td className="px-3">
                      <span className={cx('inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-semibold', STATUS_TONE[s.status])}>{STATUS_LABEL[s.status]}</span>
                    </td>
                    <td className="pr-4 pl-3 text-right whitespace-nowrap">
                      {s.status === 'pending' && (
                        <span className="inline-flex gap-1.5">
                          <Button size="sm" variant="danger-ghost" icon={X} onClick={() => setRejecting(s)}>
                            Reject
                          </Button>
                          <Button size="sm" icon={UserPlus} onClick={() => navigate('/people/new', { state: { submission: s } })}>
                            Add as employee
                          </Button>
                        </span>
                      )}
                      {s.status === 'processed' &&
                        (s.employeeId ? (
                          <Link to={`/people/${s.employeeId}`} className="text-[12.5px] font-semibold text-accent-text hover:underline">
                            View employee
                          </Link>
                        ) : (
                          <span className="text-[12px] text-ink-faint">Done</span>
                        ))}
                      {s.status === 'rejected' && (
                        <Button size="sm" variant="ghost" icon={ArrowCounterClockwise} onClick={() => setStatus(s, 'pending')} disabled={busy}>
                          Reopen
                        </Button>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        onConfirm={() => setStatus(rejecting, 'rejected')}
        title={rejecting ? `Reject ${rejecting.name}’s submission?` : 'Reject submission?'}
        confirmLabel="Reject"
        danger
        busy={busy}
      >
        It moves to the Rejected list and no employee record is created. The submission and its documents are kept, and you can reopen it later.
      </ConfirmDialog>
    </motion.div>
  )
}
