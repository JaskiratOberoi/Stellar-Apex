import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bank, CheckCircle, DownloadSimple, HandCoins, Hourglass, Money, Pause, Play, Warning, X } from '@phosphor-icons/react'
import { apiFetch } from '../../lib/api'
import { cx, fmtDate, inr, monthLabel, todayISO } from '../../lib/utils'
import { DUR, EASE_IN, EASE_OUT, listItem } from '../../lib/motion'
import { downloadWorkbook } from '../../lib/sheets'
import { useEntity } from '../../store/EntityContext'
import { EmptyState, SectionCard } from '../../components/ui'
import { Stat } from '../../components/charts'
import { AnimatedNumber, Banner, Button, Dialog, Field, Segmented, Select, TextInput, useToast } from '../../components/kit'

/* Disbursal sheet for a finalised run: who is paid how much, to which
 * account, by which mode. Salaries can be held and released; payments are
 * recorded in batches with a date and bank reference. */

const MODE = { bank: 'Bank transfer', cash: 'Cash', cheque: 'Cheque' }
const STATUS = {
  pending: { label: 'Pending', tone: 'bg-amber-soft text-amber-ink', icon: Hourglass },
  held: { label: 'On hold', tone: 'bg-rose-soft text-rose-ink', icon: Pause },
  paid: { label: 'Paid', tone: 'bg-mint-soft text-mint', icon: CheckCircle },
}
const blocked = (l) => l.payMode === 'bank' && !l.bank.complete

export default function Disbursal({ run, onRun, admin }) {
  const { entity } = useEntity()
  const toast = useToast()
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState(() => new Set())
  const [dialog, setDialog] = useState(null) // 'pay' | 'hold'
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ paidOn: todayISO(), reference: '', note: '', reason: '' })

  const lines = run.lines
  const counts = useMemo(() => {
    const c = { all: lines.length, pending: 0, held: 0, paid: 0 }
    const amt = { pending: 0, held: 0, paid: 0 }
    for (const l of lines) {
      c[l.payoutStatus]++
      amt[l.payoutStatus] += l.netPay
    }
    return { c, amt }
  }, [lines])

  const shown = useMemo(() => (filter === 'all' ? lines : lines.filter((l) => l.payoutStatus === filter)), [lines, filter])
  const picked = useMemo(() => lines.filter((l) => selected.has(l.id)), [lines, selected])
  const pickedStatuses = new Set(picked.map((l) => l.payoutStatus))
  const pickedTotal = picked.reduce((s, l) => s + l.netPay, 0)
  const pickedBlocked = picked.filter(blocked)

  if (run.status === 'draft') {
    return (
      <SectionCard>
        <EmptyState icon={Bank} title="Finalise the salary sheet first" hint="Disbursal opens once the month's sheet is finalised." />
      </SectionCard>
    )
  }

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const allShown = shown.length > 0 && shown.every((l) => selected.has(l.id))
  const toggleAll = () => setSelected(allShown ? new Set() : new Set(shown.map((l) => l.id)))

  const payout = async (action, extra, okMessage) => {
    setBusy(true)
    try {
      const next = await apiFetch(`/payroll/runs/${run.period}/payout`, {
        method: 'POST',
        body: { action, lineIds: [...selected], ...extra },
        entity: entity.id,
      })
      onRun(next)
      setSelected(new Set())
      setDialog(null)
      toast.success(next.status === 'paid' && action === 'pay' ? `${monthLabel(run.period)} is fully paid out` : okMessage)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }
  const setMode = async (line, mode) => {
    try {
      onRun(await apiFetch(`/payroll/runs/${run.period}/payout`, { method: 'POST', body: { action: 'mode', lineIds: [line.id], mode }, entity: entity.id }))
    } catch (err) {
      toast.error(err.message)
    }
  }

  const exportSheet = async () => {
    try {
      // Full account numbers come from an audited, admin-only endpoint.
      const full = admin ? await apiFetch(`/payroll/runs/${run.period}/bank-sheet`, { entity: entity.id }) : null
      const byId = new Map((full || []).map((r) => [r.id, r]))
      const rows = lines.map((l, i) => ({
        sn: i + 1,
        code: l.code,
        name: l.name,
        branch: l.branch,
        accountName: byId.get(l.id)?.accountName ?? l.bank.accountName ?? '',
        accountNumber: byId.get(l.id)?.accountNumber ?? l.bank.accountNumber ?? '',
        ifsc: l.bank.ifsc ?? '',
        bankName: l.bank.bankName ?? '',
        netPay: l.netPay,
        mode: MODE[l.payMode],
        status: STATUS[l.payoutStatus].label,
        paidOn: l.paidOn ?? '',
        reference: l.paymentRef ?? '',
        remarks: l.holdReason ?? '',
      }))
      const columns = [
        { header: 'S.No', key: 'sn', width: 6 },
        { header: 'Emp code', key: 'code', width: 12 },
        { header: 'Beneficiary name', key: 'accountName', width: 28 },
        { header: 'Account number', key: 'accountNumber', width: 22, text: true },
        { header: 'IFSC', key: 'ifsc', width: 14 },
        { header: 'Bank', key: 'bankName', width: 18 },
        { header: 'Amount', key: 'netPay', width: 14, money: true },
        { header: 'Employee', key: 'name', width: 26 },
        { header: 'Branch', key: 'branch', width: 16 },
        { header: 'Mode', key: 'mode', width: 14 },
        { header: 'Status', key: 'status', width: 10 },
        { header: 'Paid on', key: 'paidOn', width: 12 },
        { header: 'Reference', key: 'reference', width: 18 },
        { header: 'Remarks', key: 'remarks', width: 26 },
      ]
      const sub = `${monthLabel(run.period)}${admin ? '' : ' · account numbers masked (admin export shows them in full)'}`
      const sheet = (name, title, subset) => ({
        name, title: `${entity.legalName} · ${title}`, subtitle: sub, columns,
        rows: subset.map((r, i) => ({ ...r, sn: i + 1 })),
        totals: { accountName: `Total · ${subset.length}`, netPay: subset.reduce((s, r) => s + r.netPay, 0) },
      })
      await downloadWorkbook(`disbursal-${entity.code}-${run.period}.xlsx`, [
        sheet('Bank transfer', 'Bank transfer sheet', rows.filter((r) => r.mode === MODE.bank && r.status !== STATUS.held.label)),
        sheet('Cash and cheque', 'Cash and cheque payments', rows.filter((r) => r.mode !== MODE.bank && r.status !== STATUS.held.label)),
        sheet('Held', 'Salaries on hold', rows.filter((r) => r.status === STATUS.held.label)),
        sheet('All', 'Disbursal sheet', rows),
      ])
      toast.success('Disbursal sheet downloaded')
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <>
      <SectionCard>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-4 pt-2">
          <Stat label="Still to pay" value={<AnimatedNumber value={counts.amt.pending} format={(n) => inr(Math.round(n))} />} hint={`${counts.c.pending} pending`} />
          <Stat label="On hold" value={<AnimatedNumber value={counts.amt.held} format={(n) => inr(Math.round(n))} />} hint={`${counts.c.held} held`} />
          <Stat label="Paid" value={<AnimatedNumber value={counts.amt.paid} format={(n) => inr(Math.round(n))} />} hint={`${counts.c.paid} of ${counts.c.all} people`} />
        </div>
        <div className="mt-4 h-2 rounded-full bg-slate-soft overflow-hidden flex" role="img" aria-label={`${counts.c.paid} of ${counts.c.all} paid`}>
          <motion.span className="bg-mint" initial={false} animate={{ width: `${(counts.c.paid / Math.max(1, counts.c.all)) * 100}%` }} transition={{ duration: DUR.slow, ease: EASE_OUT }} />
          <motion.span className="bg-rose-ink/60" initial={false} animate={{ width: `${(counts.c.held / Math.max(1, counts.c.all)) * 100}%` }} transition={{ duration: DUR.slow, ease: EASE_OUT }} />
        </div>
      </SectionCard>

      <div className="mt-4 flex items-center gap-2 flex-wrap">
        <Segmented
          value={filter}
          onChange={(f) => {
            setFilter(f)
            setSelected(new Set())
          }}
          options={['all', 'pending', 'held', 'paid'].map((id) => ({ id, label: `${id === 'all' ? 'All' : STATUS[id].label} ${counts.c[id]}` }))}
        />
        <Button variant="secondary" icon={DownloadSimple} className="ml-auto" onClick={exportSheet}>
          Export disbursal sheet
        </Button>
      </div>

      <div className="mt-3 bg-surface rounded-2xl border border-hairline shadow-card overflow-x-auto">
        {shown.length === 0 ? (
          <EmptyState icon={HandCoins} title={`Nothing ${filter === 'all' ? 'here' : STATUS[filter].label.toLowerCase()}`} />
        ) : (
          <table className="w-full min-w-[820px] text-left">
            <thead>
              <tr className="text-[10.5px] uppercase tracking-[0.1em] text-ink-faint border-b border-hairline">
                <th className="pl-4 pr-1 py-2.5 w-8">
                  <input type="checkbox" checked={allShown} onChange={toggleAll} aria-label="Select all" className="size-4 accent-[var(--color-accent)] cursor-pointer align-middle" />
                </th>
                <th className="font-semibold px-3 py-2.5">Employee</th>
                <th className="font-semibold px-3 py-2.5">Pay to</th>
                <th className="font-semibold px-3 py-2.5">Mode</th>
                <th className="font-semibold px-3 py-2.5 text-right">Net pay</th>
                <th className="font-semibold px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {shown.map((l) => {
                  const st = STATUS[l.payoutStatus]
                  const Icon = st.icon
                  const isPicked = selected.has(l.id)
                  return (
                    <motion.tr
                      key={l.id}
                      layout="position"
                      {...listItem}
                      onClick={() => toggle(l.id)}
                      className={cx('border-b border-hairline last:border-0 cursor-pointer transition-colors', isPicked ? 'bg-accent-soft/50' : 'hover:bg-paper/60')}
                    >
                      <td className="pl-4 pr-1 py-2.5">
                        <input type="checkbox" checked={isPicked} onChange={() => toggle(l.id)} onClick={(e) => e.stopPropagation()} aria-label={`Select ${l.name}`} className="size-4 accent-[var(--color-accent)] cursor-pointer align-middle" />
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="text-[13px] font-semibold">{l.name}</p>
                        <p className="text-[10.5px] text-ink-faint font-mono">{l.code} · {l.branch}</p>
                      </td>
                      <td className="px-3 py-2.5">
                        {l.payMode !== 'bank' ? (
                          <span className="text-[12.5px] text-ink-soft">Paid by {MODE[l.payMode].toLowerCase()}</span>
                        ) : l.bank.complete ? (
                          <>
                            <p className="text-[12.5px] font-mono">{l.bank.accountNumber} <span className="text-ink-faint">· {l.bank.ifsc}</span></p>
                            <p className="text-[11px] text-ink-faint">{[l.bank.accountName, l.bank.bankName].filter(Boolean).join(' · ')}</p>
                          </>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-rose-ink">
                            <Warning size={13} weight="fill" /> No bank details on file
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        {l.payoutStatus === 'paid' ? (
                          <span className="text-[12.5px] text-ink-soft">{MODE[l.payMode]}</span>
                        ) : (
                          <Select value={l.payMode} onChange={(e) => setMode(l, e.target.value)} className="!h-8 !w-auto text-[12.5px]" aria-label={`Payment mode for ${l.name}`}>
                            {Object.entries(MODE).map(([id, label]) => (
                              <option key={id} value={id}>{label}</option>
                            ))}
                          </Select>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[13px] font-semibold">{inr(l.netPay)}</td>
                      <td className="px-4 py-2.5">
                        <span className={cx('inline-flex items-center gap-1 rounded-md text-[11px] font-semibold px-1.5 py-0.5', st.tone)}>
                          <Icon size={11} weight="fill" /> {st.label}
                        </span>
                        <p className="text-[11px] text-ink-faint mt-0.5 max-w-[220px] truncate">
                          {l.payoutStatus === 'paid' && `${fmtDate(l.paidOn)}${l.paymentRef ? ` · ${l.paymentRef}` : ''}`}
                          {l.payoutStatus === 'held' && l.holdReason}
                        </p>
                      </td>
                    </motion.tr>
                  )
                })}
              </AnimatePresence>
            </tbody>
          </table>
        )}
      </div>

      {run.batches.length > 0 && (
        <SectionCard title="Payments recorded" className="mt-4">
          <ul className="divide-y divide-hairline">
            {run.batches.map((b) => (
              <li key={b.id} className="flex items-center gap-3 py-2 text-[12.5px]">
                <Money size={15} className="text-mint shrink-0" />
                <span className="font-semibold">{fmtDate(b.paidOn)}</span>
                <span className="text-ink-faint">{b.lineCount} {b.lineCount === 1 ? 'salary' : 'salaries'}{b.reference && ` · ref ${b.reference}`}{b.note && ` · ${b.note}`}</span>
                <span className="ml-auto font-mono tabular-nums font-semibold">{inr(b.amount)}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {/* selection bar */}
      <AnimatePresence>
        {picked.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0, transition: { duration: DUR.base, ease: EASE_OUT } }}
            exit={{ opacity: 0, y: 24, transition: { duration: DUR.fast, ease: EASE_IN } }}
            className="sticky bottom-4 z-30 mt-4 mx-auto w-fit max-w-full flex items-center gap-2 flex-wrap rounded-2xl bg-ink text-paper pl-4 pr-2 py-2 shadow-pop"
          >
            <span className="text-[13px] font-medium mr-1">
              <span className="font-mono font-bold">{picked.length}</span> selected · <span className="font-mono font-bold tabular-nums">{inr(pickedTotal)}</span>
            </span>
            {pickedStatuses.size === 1 && pickedStatuses.has('pending') && (
              <Button size="sm" icon={CheckCircle} onClick={() => setDialog('pay')}>
                Mark paid
              </Button>
            )}
            {!pickedStatuses.has('paid') && !pickedStatuses.has('held') && (
              <Button size="sm" variant="secondary" icon={Pause} onClick={() => setDialog('hold')}>
                Hold
              </Button>
            )}
            {pickedStatuses.size === 1 && pickedStatuses.has('held') && (
              <Button size="sm" variant="secondary" icon={Play} loading={busy} onClick={() => payout('release', {}, `Released ${picked.length} ${picked.length === 1 ? 'salary' : 'salaries'}`)}>
                Release
              </Button>
            )}
            {admin && pickedStatuses.size === 1 && pickedStatuses.has('paid') && (
              <Button size="sm" variant="secondary" loading={busy} onClick={() => payout('unpay', {}, 'Payment undone')}>
                Undo payment
              </Button>
            )}
            <button onClick={() => setSelected(new Set())} aria-label="Clear selection" className="p-2 rounded-lg text-paper/60 hover:text-paper hover:bg-white/10 transition-colors cursor-pointer">
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog
        open={dialog === 'pay'}
        onClose={busy ? undefined : () => setDialog(null)}
        title={`Mark ${picked.length} ${picked.length === 1 ? 'salary' : 'salaries'} paid`}
        description={`${inr(pickedTotal)} in total. Recorded as one payment batch.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)} disabled={busy}>Cancel</Button>
            <Button type="submit" form="pay-form" loading={busy} disabled={pickedBlocked.length > 0}>Mark paid</Button>
          </>
        }
      >
        <form
          id="pay-form"
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            payout('pay', { paidOn: form.paidOn, reference: form.reference, note: form.note }, `Marked ${picked.length} paid`)
          }}
        >
          {pickedBlocked.length > 0 && (
            <Banner tone="rose" icon={Warning}>
              {pickedBlocked.map((l) => l.name).join(', ')} {pickedBlocked.length === 1 ? 'has' : 'have'} no bank details. Add them on the profile, or switch the mode to cash or cheque.
            </Banner>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Payment date" required>
              <TextInput type="date" required max={todayISO()} value={form.paidOn} onChange={(e) => setForm({ ...form, paidOn: e.target.value })} />
            </Field>
            <Field label="Bank reference / UTR">
              <TextInput value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} maxLength={96} data-autofocus />
            </Field>
          </div>
          <Field label="Note">
            <TextInput value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} maxLength={255} placeholder="e.g. HDFC bulk upload, batch 1" />
          </Field>
        </form>
      </Dialog>

      <Dialog
        open={dialog === 'hold'}
        onClose={busy ? undefined : () => setDialog(null)}
        size="sm"
        title={`Hold ${picked.length} ${picked.length === 1 ? 'salary' : 'salaries'}`}
        description="Held salaries stay on the sheet but are left out of the bank transfer until released."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)} disabled={busy}>Cancel</Button>
            <Button type="submit" form="hold-form" loading={busy} disabled={!form.reason.trim()}>Hold</Button>
          </>
        }
      >
        <form id="hold-form" onSubmit={(e) => { e.preventDefault(); payout('hold', { reason: form.reason }, `Put ${picked.length} on hold`) }}>
          <Field label="Reason" required>
            <TextInput value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} maxLength={255} placeholder="e.g. Documents pending" data-autofocus />
          </Field>
        </form>
      </Dialog>
    </>
  )
}
