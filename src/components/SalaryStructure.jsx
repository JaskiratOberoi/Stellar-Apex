import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ClockCounterClockwise, MagicWand, PencilSimple, Plus, Trash, Wallet, Warning } from '@phosphor-icons/react'
import { apiFetch } from '../lib/api'
import { cx, fmtDate, inr, isAdmin, todayISO } from '../lib/utils'
import { collapse, listItem } from '../lib/motion'
import { useEntity } from '../store/EntityContext'
import { useAuth } from '../store/AuthContext'
import { useReference } from '../store/ReferenceStore'
import { EmptyState, FieldRow, SectionCard } from './ui'
import { AmountInput, Banner, Button, Dialog, Field, SkeletonRows, TextInput, Toggle, useToast } from './kit'

/* Salary structure: monthly amounts plus which statutory deductions apply.
 * Effective-dated — a revision adds a new row and keeps the history. */

const EARNINGS = [
  ['basic', 'Basic'],
  ['hra', 'HRA'],
  ['conveyance', 'Conveyance'],
  ['specialAllowance', 'Special allowance'],
  ['otherAllowance', 'Other allowance'],
]
const num = (v) => Number(v) || 0
export const structureGross = (s) => EARNINGS.reduce((sum, [k]) => sum + num(s?.[k]), 0)

const blank = (prefill) => ({
  effectiveFrom: prefill?.effectiveFrom || todayISO().slice(0, 8) + '01',
  basic: '', hra: '', conveyance: '', specialAllowance: '', otherAllowance: '',
  expenseComponent: '', tdsMonthly: '', note: '',
  pfApplicable: true, esiApplicable: true, ptApplicable: true,
  ...Object.fromEntries(Object.entries(prefill || {}).map(([k, v]) => [k, typeof v === 'number' ? String(v || '') : v])),
})

export function StructureDialog({ open, onClose, employee, current, prefill, onSaved }) {
  const { entity } = useEntity()
  const { settings } = useReference()
  const toast = useToast()
  const [f, setF] = useState(() => blank(prefill))
  const [split, setSplit] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  // Fresh form each time it opens: a revision starts from the current amounts.
  useEffect(() => {
    if (!open) return
    setError(null)
    setSplit('')
    // A revision starts from today's amounts; a first salary starts on the joining date.
    setF(
      blank(
        prefill ||
          (current
            ? { ...current, effectiveFrom: todayISO().slice(0, 8) + '01', note: '' }
            : employee?.joiningDate
              ? { effectiveFrom: employee.joiningDate }
              : null),
      ),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v?.target ? v.target.value : v }))
  const gross = structureGross(f)
  const basicPct = gross ? Math.round((num(f.basic) / gross) * 100) : 0
  const pay = settings?.payroll
  const pfWages = pay?.pfWageCeiling ? Math.min(num(f.basic), pay.pfWageCeiling) : num(f.basic)
  const pf = f.pfApplicable && pay ? Math.round((pfWages * pay.pfRate) / 100) : 0
  const esiEligible = f.esiApplicable && pay && gross > 0 && gross <= pay.esiWageCeiling
  const esi = esiEligible ? Math.ceil((gross * pay.esiEmployeeRate) / 100) : 0

  const autoSplit = () => {
    const g = num(split)
    if (g <= 0) return
    const basic = Math.round(g * 0.5)
    const hra = Math.round(basic * 0.4)
    const conveyance = Math.min(1600, Math.max(0, g - basic - hra))
    setF((p) => ({ ...p, basic: String(basic), hra: String(hra), conveyance: String(conveyance), specialAllowance: String(Math.max(0, g - basic - hra - conveyance)), otherAllowance: '' }))
  }

  const save = async (ev) => {
    ev.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const list = await apiFetch(`/employees/${employee.id}/salary`, { method: 'POST', body: f, entity: entity.id })
      toast.success(`Salary saved for ${employee.name}`)
      onSaved?.(list)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      size="lg"
      title={current ? 'Revise salary' : 'Set salary'}
      description={employee ? `${employee.name} · ${employee.code} · monthly amounts` : undefined}
      footer={
        <>
          <div className="mr-auto text-[12.5px] text-ink-soft">
            Gross <span className="font-mono font-semibold text-ink tabular-nums">{inr(gross)}</span>
            <span className="text-ink-faint"> · take-home about </span>
            <span className="font-mono font-semibold text-ink tabular-nums">{inr(gross - pf - esi - num(f.tdsMonthly) + num(f.expenseComponent))}</span>
          </div>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="structure-form" loading={busy} disabled={num(f.basic) <= 0}>
            Save salary
          </Button>
        </>
      }
    >
      <form id="structure-form" onSubmit={save} className="space-y-4">
        <div className="grid sm:grid-cols-[180px_1fr] gap-3 items-start">
          <Field label="Effective from" required>
            <TextInput type="date" required value={f.effectiveFrom} onChange={set('effectiveFrom')} />
          </Field>
          <div className="flex items-start gap-2">
            <Field label="Split a monthly gross" hint="50% basic, HRA at 40% of basic, rest as allowances." className="flex-1">
              <AmountInput value={split} onChange={setSplit} placeholder="e.g. 30000" />
            </Field>
            <Button variant="secondary" icon={MagicWand} onClick={autoSplit} disabled={num(split) <= 0} className="h-10 mt-[25px]">
              Split
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {EARNINGS.map(([k, label]) => (
            <Field key={k} label={label} required={k === 'basic'}>
              <AmountInput value={f[k]} onChange={set(k)} data-autofocus={k === 'basic' ? '' : undefined} />
            </Field>
          ))}
          <Field label="Expense component" hint="Reimbursement, paid on top of salary.">
            <AmountInput value={f.expenseComponent} onChange={set('expenseComponent')} />
          </Field>
        </div>

        <AnimatePresence initial={false}>
          {gross > 0 && basicPct < 50 && (
            <motion.div key="wage-rule" {...collapse} className="overflow-hidden">
              <Banner tone="amber" icon={Warning}>
                Basic is {basicPct}% of gross. Under the new wage code, basic pay should be at least 50% of total pay; check with your accountant.
              </Banner>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 rounded-xl border border-hairline bg-paper/50 px-4 py-3">
          <Toggle checked={f.pfApplicable} onChange={set('pfApplicable')} label="Provident fund" hint={f.pfApplicable ? `About ${inr(pf)} a month from the employee` : 'No PF deducted'} />
          <Toggle
            checked={f.esiApplicable}
            onChange={set('esiApplicable')}
            label="ESI"
            hint={
              !f.esiApplicable
                ? 'No ESI deducted'
                : esiEligible
                  ? `About ${inr(esi)} a month from the employee`
                  : gross > 0
                    ? `Not deducted: gross is above ${inr(pay?.esiWageCeiling)}`
                    : `Deducted when gross is within ${inr(pay?.esiWageCeiling)}`
            }
          />
          <Toggle checked={f.ptApplicable} onChange={set('ptApplicable')} label="Professional tax" hint="Uses the slab for the branch's state, if one is set." />
          <Field label="TDS per month" hint="Fixed monthly income-tax deduction.">
            <AmountInput value={f.tdsMonthly} onChange={set('tdsMonthly')} />
          </Field>
        </div>

        <Field label="Note" error={error}>
          <TextInput value={f.note} onChange={set('note')} maxLength={255} placeholder="e.g. Annual revision" />
        </Field>
      </form>
    </Dialog>
  )
}

/* ---------------- Profile → Compensation tab ---------------- */
export function Compensation({ employee }) {
  const { entity } = useEntity()
  const { user } = useAuth()
  const toast = useToast()
  const [list, setList] = useState(null)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(false)
  const canWrite = user?.role !== 'viewer'

  const load = useCallback(async () => {
    try {
      setList(await apiFetch(`/employees/${employee.id}/salary`, { entity: entity.id }))
    } catch (err) {
      setError(err.status === 403 ? 'Salary details are visible to HR and admins only.' : err.message)
    }
  }, [employee.id, entity.id])
  useEffect(() => {
    load()
  }, [load])

  const today = todayISO()
  const current = useMemo(() => list?.find((s) => s.effectiveFrom <= today) ?? null, [list, today])

  const remove = async (s) => {
    try {
      setList(await apiFetch(`/employees/${employee.id}/salary/${s.id}`, { method: 'DELETE', entity: entity.id }))
      toast.success('Revision removed')
    } catch (err) {
      toast.error(err.message)
    }
  }

  if (error) {
    return (
      <SectionCard className="lg:col-span-3">
        <EmptyState icon={Wallet} title="Compensation unavailable" hint={error} />
      </SectionCard>
    )
  }
  if (!list) {
    return (
      <SectionCard className="lg:col-span-3">
        <SkeletonRows rows={3} />
      </SectionCard>
    )
  }

  return (
    <>
      <SectionCard
        title="Current salary"
        className="lg:col-span-2"
        action={
          canWrite && (
            <Button size="sm" variant="secondary" icon={current ? PencilSimple : Plus} onClick={() => setEditing(true)}>
              {current ? 'Revise' : 'Set salary'}
            </Button>
          )
        }
      >
        {current ? (
          <div className="grid sm:grid-cols-2 gap-x-8">
            <dl>
              {EARNINGS.filter(([k]) => current[k] > 0).map(([k, label]) => (
                <FieldRow key={k} label={label} mono>
                  {inr(current[k])}
                </FieldRow>
              ))}
              <div className="flex items-baseline justify-between gap-4 pt-2.5">
                <dt className="text-[13px] font-semibold">Monthly gross</dt>
                <dd className="font-display text-[20px] font-bold tabular-nums">{inr(current.gross)}</dd>
              </div>
            </dl>
            <dl>
              <FieldRow label="Expense component" mono>{current.expenseComponent ? inr(current.expenseComponent) : '—'}</FieldRow>
              <FieldRow label="Provident fund">{current.pfApplicable ? 'Deducted' : 'Not applicable'}</FieldRow>
              <FieldRow label="ESI">{current.esiApplicable ? 'If within wage limit' : 'Not applicable'}</FieldRow>
              <FieldRow label="Professional tax">{current.ptApplicable ? 'By state slab' : 'Not applicable'}</FieldRow>
              <FieldRow label="TDS per month" mono>{current.tdsMonthly ? inr(current.tdsMonthly) : '—'}</FieldRow>
              <FieldRow label="In effect since">{fmtDate(current.effectiveFrom)}</FieldRow>
            </dl>
          </div>
        ) : (
          <EmptyState icon={Wallet} title="No salary set" hint="This person is left out of payroll runs until a salary is set." />
        )}
      </SectionCard>

      <SectionCard title="Revision history">
        {list.length === 0 ? (
          <p className="text-[13px] text-ink-faint py-2">No revisions yet.</p>
        ) : (
          <ol className="relative">
            <AnimatePresence initial={false}>
              {list.map((s, i) => {
                const prev = list[i + 1]
                const change = prev ? s.gross - prev.gross : null
                return (
                  <motion.li key={s.id} layout {...listItem} className="relative pl-5 pb-4 last:pb-0">
                    <span className={cx('absolute left-0 top-1.5 size-2 rounded-full', s === current ? 'bg-accent' : 'bg-hairline-strong')} />
                    {i < list.length - 1 && <span className="absolute left-[3.5px] top-4 bottom-0 w-px bg-hairline" />}
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-[13px] font-semibold font-mono tabular-nums">{inr(s.gross)}</p>
                      {change != null && change !== 0 && (
                        <span className={cx('text-[11.5px] font-mono font-semibold', change > 0 ? 'text-mint' : 'text-rose-ink')}>
                          {change > 0 ? '+' : '−'}
                          {inr(Math.abs(change))}
                        </span>
                      )}
                    </div>
                    <p className="text-[11.5px] text-ink-faint">
                      From {fmtDate(s.effectiveFrom)}
                      {s.effectiveFrom > today && ' · upcoming'}
                      {s.note && ` · ${s.note}`}
                    </p>
                    {isAdmin(user) && s !== current && (
                      <button onClick={() => remove(s)} className="mt-1 inline-flex items-center gap-1 text-[11.5px] text-ink-faint hover:text-rose-ink transition-colors cursor-pointer">
                        <Trash size={11} /> Remove
                      </button>
                    )}
                  </motion.li>
                )
              })}
            </AnimatePresence>
          </ol>
        )}
        {list.length > 0 && (
          <p className="flex items-center gap-1.5 text-[11.5px] text-ink-faint mt-3 pt-3 border-t border-hairline">
            <ClockCounterClockwise size={12} /> Finalised salary sheets keep the amounts they were run with.
          </p>
        )}
      </SectionCard>

      <StructureDialog open={editing} onClose={() => setEditing(false)} employee={employee} current={current} onSaved={setList} />
    </>
  )
}
