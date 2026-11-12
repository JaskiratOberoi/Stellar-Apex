import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowsClockwise,
  Bank,
  CalendarCheck,
  Check,
  ClockCounterClockwise,
  DownloadSimple,
  GearSix,
  LockOpen,
  PencilSimple,
  Printer,
  Receipt,
  SealCheck,
  Table,
  Trash,
  UserMinus,
  Wallet,
  Warning,
} from '@phosphor-icons/react'
import { apiFetch } from '../lib/api'
import { cx, currentMonth, fmtStamp, inr, isAdmin, monthLabel, shiftMonth } from '../lib/utils'
import { DUR, EASE_OUT, collapse, fadeUp } from '../lib/motion'
import { downloadWorkbook } from '../lib/sheets'
import { useEntity } from '../store/EntityContext'
import { useAuth } from '../store/AuthContext'
import { EmptyState, SectionCard } from '../components/ui'
import { Stat } from '../components/charts'
import { AmountInput, AnimatedNumber, Banner, Button, ConfirmDialog, Dialog, Field, MonthPicker, SkeletonRows, Tabs, TextInput, useToast } from '../components/kit'
import { StructureDialog } from '../components/SalaryStructure'
import Disbursal from './payroll/Disbursal'
import PayrollSettings from './payroll/Settings'

/* ------------------------------------------------------------------
 * Payroll: locked attendance → draft salary sheet → finalised → paid.
 * The sheet is calculated on the server from each person's salary
 * structure and the month's paid days; every figure can be adjusted
 * while the sheet is a draft.
 * ------------------------------------------------------------------ */

const STEPS = ['Attendance locked', 'Draft salary sheet', 'Finalised', 'Paid out']

function Stepper({ step }) {
  return (
    <ol className="flex items-center gap-2 sm:gap-3">
      {STEPS.map((label, i) => {
        const done = i < step
        const now = i === step
        return (
          <li key={label} className="flex items-center gap-2 sm:gap-3 flex-1 last:flex-none min-w-0">
            <span className="flex items-center gap-2 min-w-0">
              <span
                className={cx(
                  'grid place-items-center size-6 rounded-full text-[11px] font-mono font-bold shrink-0 transition-colors duration-[var(--dur-slow)]',
                  done ? 'bg-accent text-white' : now ? 'bg-accent-soft text-accent-text ring-2 ring-accent' : 'bg-slate-soft text-ink-faint',
                )}
              >
                {done ? <Check size={12} weight="bold" className="animate-pop" /> : i + 1}
              </span>
              <span className={cx('text-[12.5px] font-semibold truncate hidden sm:block', done || now ? 'text-ink' : 'text-ink-faint')}>{label}</span>
            </span>
            {i < STEPS.length - 1 && (
              <span className="relative flex-1 h-[2px] rounded-full bg-hairline overflow-hidden min-w-4">
                <motion.span
                  className="absolute inset-y-0 left-0 bg-accent rounded-full"
                  initial={false}
                  animate={{ width: done ? '100%' : '0%' }}
                  transition={{ duration: DUR.slow, ease: EASE_OUT }}
                />
              </span>
            )}
          </li>
        )
      })}
    </ol>
  )
}

/* ---------------- sheet columns ---------------- */
const COLS = [
  { key: 'basic', label: 'Basic', group: 'earn' },
  { key: 'hra', label: 'HRA', group: 'earn' },
  { key: 'conveyance', label: 'Conv.', full: 'Conveyance', group: 'earn' },
  { key: 'specialAllowance', label: 'Special', full: 'Special allowance', group: 'earn' },
  { key: 'otherAllowance', label: 'Other', full: 'Other allowance', group: 'earn' },
  { key: 'arrears', label: 'Arrears', group: 'earn' },
  { key: 'incentive', label: 'Incentive', group: 'earn' },
  { key: 'gross', label: 'Gross', group: 'earn', strong: true },
  { key: 'pfEmployee', label: 'PF', group: 'ded' },
  { key: 'esiEmployee', label: 'ESI', group: 'ded' },
  { key: 'pt', label: 'PT', full: 'Professional tax', group: 'ded' },
  { key: 'tds', label: 'TDS', group: 'ded' },
  { key: 'advance', label: 'Advance', group: 'ded' },
  { key: 'otherDeduction', label: 'Other', full: 'Other deduction', group: 'ded' },
  { key: 'totalDeductions', label: 'Deductions', full: 'Total deductions', group: 'ded', strong: true },
  { key: 'expenseReimbursement', label: 'Expenses', full: 'Expense reimbursement', group: 'net' },
  { key: 'netPay', label: 'Net pay', group: 'net', strong: true },
]
const sumOf = (lines, key) => lines.reduce((s, l) => s + (l[key] || 0), 0)
const money = (n) => (n ? Math.round(n).toLocaleString('en-IN') : '–')

export async function exportSalarySheet(entity, run) {
  const lines = run.lines
  await downloadWorkbook(`salary-sheet-${entity.code}-${run.period}.xlsx`, [
    {
      name: 'Salary sheet',
      title: `${entity.legalName} · Salary sheet`,
      subtitle: `${monthLabel(run.period)} · ${run.status === 'draft' ? 'DRAFT, not final' : `finalised ${fmtStamp(run.finalisedAt)}`}`,
      freeze: 2,
      columns: [
        { header: 'Code', key: 'code', width: 12 },
        { header: 'Name', key: 'name', width: 26 },
        { header: 'Designation', key: 'designation', width: 20 },
        { header: 'Department', key: 'department', width: 18 },
        { header: 'Branch', key: 'branch', width: 16 },
        { header: 'Days in month', key: 'daysInMonth', width: 9 },
        { header: 'Paid days', key: 'paidDays', width: 9 },
        { header: 'LOP days', key: 'lopDays', width: 9 },
        ...COLS.map((c) => ({ header: c.full || c.label, key: c.key, width: 13, money: true })),
        { header: 'Employer PF', key: 'pfEmployer', width: 13, money: true },
        { header: 'Employer ESI', key: 'esiEmployer', width: 13, money: true },
        { header: 'Remarks', key: 'remarks', width: 28 },
      ],
      rows: lines,
      totals: {
        name: `Total · ${lines.length} employees`,
        ...Object.fromEntries([...COLS.map((c) => c.key), 'pfEmployer', 'esiEmployer'].map((k) => [k, sumOf(lines, k)])),
      },
    },
  ])
}

/* ---------------- line editor (draft only) ---------------- */
function LineDialog({ open, onClose, line, period, onSaved }) {
  const { entity } = useEntity()
  const toast = useToast()
  const [f, setF] = useState({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open || !line) return
    const a = line.adjustments || {}
    const s = (v) => (v == null ? '' : String(v))
    setF({
      arrears: s(a.arrears), incentive: s(a.incentive), advance: s(a.advance), otherDeduction: s(a.otherDeduction), tds: s(a.tds),
      pfEmployee: s(a.overrides?.pfEmployee), esiEmployee: s(a.overrides?.esiEmployee), pt: s(a.overrides?.pt),
      expenseReimbursement: s(a.overrides?.expenseReimbursement), remarks: line.remarks || '',
    })
  }, [open, line])

  if (!line) return null
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v?.target ? v.target.value : v }))
  const val = (k) => (f[k] === '' || f[k] == null ? undefined : Number(f[k]))

  const save = async (ev) => {
    ev.preventDefault()
    setBusy(true)
    try {
      const body = {
        arrears: val('arrears'), incentive: val('incentive'), advance: val('advance'), otherDeduction: val('otherDeduction'), tds: val('tds'),
        overrides: { pfEmployee: val('pfEmployee'), esiEmployee: val('esiEmployee'), pt: val('pt'), expenseReimbursement: val('expenseReimbursement') },
        remarks: f.remarks,
      }
      const updated = await apiFetch(`/payroll/runs/${period}/lines/${line.id}`, { method: 'PUT', body, entity: entity.id })
      toast.success(`${line.name}: net pay ${inr(updated.netPay)}`)
      onSaved(updated)
      onClose()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      size="lg"
      title={line.name}
      description={`${line.code} · ${line.paidDays} of ${line.daysInMonth} days paid${line.lopDays ? ` · ${line.lopDays} loss-of-pay` : ''}`}
      footer={
        <>
          <div className="mr-auto text-[12.5px] text-ink-soft">
            Net pay now <span className="font-mono font-semibold text-ink tabular-nums">{inr(line.netPay)}</span>
          </div>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="line-form" loading={busy}>
            Save and recalculate
          </Button>
        </>
      }
    >
      <form id="line-form" onSubmit={save} className="space-y-5">
        <fieldset>
          <legend className="text-[11.5px] uppercase tracking-[0.1em] font-semibold text-ink-faint mb-2">One-off for this month</legend>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="Arrears"><AmountInput value={f.arrears} onChange={set('arrears')} data-autofocus /></Field>
            <Field label="Incentive"><AmountInput value={f.incentive} onChange={set('incentive')} /></Field>
            <Field label="Advance recovery"><AmountInput value={f.advance} onChange={set('advance')} /></Field>
            <Field label="Other deduction"><AmountInput value={f.otherDeduction} onChange={set('otherDeduction')} /></Field>
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-[11.5px] uppercase tracking-[0.1em] font-semibold text-ink-faint mb-1">Override a calculated figure</legend>
          <p className="text-[12px] text-ink-faint mb-2">Leave blank to keep the calculated amount shown in grey.</p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Field label="PF"><AmountInput value={f.pfEmployee} onChange={set('pfEmployee')} placeholder={String(line.pfEmployee)} /></Field>
            <Field label="ESI"><AmountInput value={f.esiEmployee} onChange={set('esiEmployee')} placeholder={String(line.esiEmployee)} /></Field>
            <Field label="Prof. tax"><AmountInput value={f.pt} onChange={set('pt')} placeholder={String(line.pt)} /></Field>
            <Field label="TDS"><AmountInput value={f.tds} onChange={set('tds')} placeholder={String(line.structure?.tdsMonthly ?? 0)} /></Field>
            <Field label="Expenses"><AmountInput value={f.expenseReimbursement} onChange={set('expenseReimbursement')} placeholder={String(line.expenseReimbursement)} /></Field>
          </div>
        </fieldset>
        <Field label="Remarks">
          <TextInput value={f.remarks || ''} onChange={set('remarks')} maxLength={255} placeholder="Shown on the salary sheet" />
        </Field>
      </form>
    </Dialog>
  )
}

/* ---------------- the sheet ---------------- */
function SalarySheet({ run, prevNet, onEdit }) {
  const draft = run.status === 'draft'
  const lines = run.lines
  return (
    <div className="bg-surface rounded-2xl border border-hairline shadow-card overflow-hidden">
      <div className="overflow-auto max-h-[66vh]">
        <table className="border-separate border-spacing-0 w-full min-w-[1320px] text-right">
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.08em] text-ink-faint">
              <th className="sticky left-0 top-0 z-30 bg-surface text-left font-semibold px-4 py-2.5 border-b border-hairline">Employee</th>
              <th className="sticky top-0 z-20 bg-surface font-semibold px-2 py-2.5 border-b border-hairline">Days</th>
              {COLS.map((c) => (
                <th
                  key={c.key}
                  title={c.full}
                  className={cx(
                    'sticky top-0 z-20 bg-surface font-semibold px-2 py-2.5 border-b border-hairline whitespace-nowrap',
                    c.strong && 'text-ink-soft',
                    (c.key === 'pfEmployee' || c.key === 'expenseReimbursement') && 'border-l',
                  )}
                >
                  {c.label}
                </th>
              ))}
              <th className="sticky top-0 z-20 bg-surface border-b border-hairline w-9" />
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const before = prevNet?.get(l.employeeId)
              const delta = before != null ? l.netPay - before : null
              const flagged = delta != null && before > 0 && Math.abs(delta) / before >= 0.1
              const adjusted = l.adjustments && Object.keys(l.adjustments).length > 0
              return (
                <tr key={l.id} onClick={draft ? () => onEdit(l) : undefined} className={cx('group', draft && 'cursor-pointer')}>
                  <th scope="row" className="sticky left-0 z-10 bg-surface group-hover:bg-paper transition-colors text-left font-normal px-4 py-2 border-b border-hairline">
                    <p className="text-[13px] font-semibold whitespace-nowrap flex items-center gap-1.5">
                      {l.name}
                      {adjusted && <span className="size-1.5 rounded-full bg-amber-ink" title="Has adjustments or overrides" />}
                    </p>
                    <p className="text-[10.5px] text-ink-faint font-mono whitespace-nowrap">
                      {l.code}
                      {l.remarks && <span className="font-sans"> · {l.remarks}</span>}
                    </p>
                  </th>
                  <td className="px-2 py-2 border-b border-hairline group-hover:bg-paper transition-colors text-[12px] font-mono tabular-nums whitespace-nowrap">
                    {l.paidDays}
                    {l.lopDays > 0 && <span className="text-rose-ink"> −{l.lopDays}</span>}
                  </td>
                  {COLS.map((c) => (
                    <td
                      key={c.key}
                      className={cx(
                        'px-2 py-2 border-b border-hairline group-hover:bg-paper transition-colors font-mono tabular-nums whitespace-nowrap',
                        c.strong ? 'text-[12.5px] font-semibold' : 'text-[12px] text-ink-soft',
                        (c.key === 'pfEmployee' || c.key === 'expenseReimbursement') && 'border-l',
                        c.key === 'netPay' && l.netPay < 0 && 'text-rose-ink',
                      )}
                    >
                      {money(l[c.key])}
                      {c.key === 'netPay' && (flagged || before === undefined) && prevNet && (
                        <span
                          className={cx('block text-[10px] font-semibold', before === undefined ? 'text-accent-text' : delta > 0 ? 'text-mint' : 'text-rose-ink')}
                          title="Change from last month's net pay"
                        >
                          {before === undefined ? 'new' : `${delta > 0 ? '+' : '−'}${money(Math.abs(delta))}`}
                        </span>
                      )}
                    </td>
                  ))}
                  <td className="border-b border-hairline group-hover:bg-paper transition-colors pr-2 text-ink-faint">
                    {draft ? (
                      <PencilSimple size={13} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    ) : (
                      <Link to={`/payroll/${run.period}/payslips/${l.id}`} title="Payslip" className="inline-grid place-items-center size-7 rounded-lg hover:bg-accent-soft hover:text-accent-text transition-colors">
                        <Receipt size={14} />
                      </Link>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="font-mono tabular-nums text-[12.5px] font-bold">
              <th scope="row" className="sticky left-0 bottom-0 z-20 bg-paper text-left font-display px-4 py-2.5 border-t border-hairline-strong">
                Total · {lines.length}
              </th>
              <td className="sticky bottom-0 z-10 bg-paper border-t border-hairline-strong" />
              {COLS.map((c) => (
                <td key={c.key} className="sticky bottom-0 z-10 bg-paper px-2 py-2.5 border-t border-hairline-strong whitespace-nowrap">
                  {money(sumOf(lines, c.key))}
                </td>
              ))}
              <td className="sticky bottom-0 z-10 bg-paper border-t border-hairline-strong" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

/* ---------------- history ---------------- */
const RUN_TONE = { draft: 'bg-amber-soft text-amber-ink', finalised: 'bg-accent-soft text-accent-text', paid: 'bg-mint-soft text-mint' }
const RUN_LABEL = { draft: 'Draft', finalised: 'Finalised', paid: 'Paid' }

function History({ onOpen }) {
  const { entity } = useEntity()
  const [runs, setRuns] = useState(null)
  useEffect(() => {
    apiFetch('/payroll/runs', { entity: entity.id }).then(setRuns).catch(() => setRuns([]))
  }, [entity.id])

  if (!runs) return <SectionCard><SkeletonRows rows={4} /></SectionCard>
  if (!runs.length) return <SectionCard><EmptyState icon={ClockCounterClockwise} title="No salary sheets yet" hint="Each month you run appears here." /></SectionCard>
  return (
    <div className="bg-surface rounded-2xl border border-hairline shadow-card divide-y divide-hairline">
      {runs.map((r) => (
        <button key={r.period} onClick={() => onOpen(r.period)} className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-paper/70 active:scale-[0.995] transition-[background-color,transform] cursor-pointer">
          <span className="font-display text-[14.5px] font-bold tracking-tight w-36 shrink-0">{monthLabel(r.period)}</span>
          <span className={cx('rounded-md text-[11px] font-semibold px-1.5 py-0.5', RUN_TONE[r.status])}>{RUN_LABEL[r.status]}</span>
          <span className="text-[12px] text-ink-faint hidden sm:block">
            {r.headcount} people{r.status !== 'draft' && ` · ${r.paid} paid`}{r.held > 0 && ` · ${r.held} held`}
          </span>
          <span className="ml-auto font-mono tabular-nums text-[13px] font-semibold">{inr(r.net)}</span>
        </button>
      ))}
    </div>
  )
}

/* ---------------- page ---------------- */
export default function Payroll() {
  const { entity } = useEntity()
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const month = /^\d{4}-\d{2}$/.test(params.get('month') || '') ? params.get('month') : shiftMonth(currentMonth(), -1)
  const tab = params.get('tab') || 'sheet'
  const go = (next) => setParams({ month, ...(tab !== 'sheet' ? { tab } : {}), ...next }, { replace: true })

  const [state, setState] = useState({ loading: true })
  const [busy, setBusy] = useState(null)
  const [confirm, setConfirm] = useState(null) // 'finalise' | 'delete' | 'reopen'
  const [editLine, setEditLine] = useState(null)
  const [lineOpen, setLineOpen] = useState(false)
  const [structFor, setStructFor] = useState(null)
  const [structOpen, setStructOpen] = useState(false)
  const admin = isAdmin(user)

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }))
    const opt = { entity: entity.id }
    try {
      const [att, run, prev] = await Promise.all([
        apiFetch(`/attendance?month=${month}`, opt),
        apiFetch(`/payroll/runs/${month}`, opt),
        apiFetch(`/payroll/runs/${shiftMonth(month, -1)}`, opt).catch(() => null),
      ])
      setState({
        loading: false,
        run,
        attendance: { status: att.status, people: att.employees.length, unmarked: Object.values(att.totals).reduce((s, t) => s + t.unmarked, 0) },
        prevNet: prev && prev.status !== 'draft' ? new Map(prev.lines.map((l) => [l.employeeId, l.netPay])) : null,
      })
    } catch (err) {
      setState({ loading: false, error: err.status === 403 ? 'Payroll is available to HR and admins only.' : err.message })
    }
  }, [month, entity.id])
  useEffect(() => {
    load()
  }, [load])

  const { run, attendance, prevNet, loading, error } = state
  const setRun = (r) => setState((s) => ({ ...s, run: r }))
  const step = !run ? (attendance?.status === 'locked' ? 1 : 0) : run.status === 'draft' ? 2 : run.status === 'finalised' ? 3 : 4

  const act = async (name, fn, okMessage) => {
    setBusy(name)
    try {
      const res = await fn()
      if (okMessage) toast.success(okMessage)
      setConfirm(null)
      return res
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(null)
    }
  }
  const post = (path, body) => apiFetch(`/payroll/runs${path}`, { method: 'POST', body, entity: entity.id })
  const createRun = () => act('create', async () => setRun(await post('', { period: month })), `Salary sheet drafted for ${monthLabel(month)}`)
  const recalc = () => act('recalc', async () => setRun(await post(`/${month}/recalculate`)), 'Recalculated from attendance and salaries')
  const finalise = () => act('finalise', async () => setRun(await post(`/${month}/finalise`)), `${monthLabel(month)} salary sheet finalised`)
  const reopen = () => act('reopen', async () => setRun(await post(`/${month}/reopen`)), 'Reopened as a draft')
  const remove = () =>
    act('delete', async () => {
      await apiFetch(`/payroll/runs/${month}`, { method: 'DELETE', entity: entity.id })
      setRun(null)
    }, 'Draft deleted')

  const totals = useMemo(
    () => (run ? { gross: sumOf(run.lines, 'gross'), ded: sumOf(run.lines, 'totalDeductions'), net: sumOf(run.lines, 'netPay'), employer: sumOf(run.lines, 'pfEmployer') + sumOf(run.lines, 'esiEmployer') } : null),
    [run],
  )

  const tabs = [
    { id: 'sheet', label: 'Salary sheet', icon: Table },
    { id: 'disbursal', label: 'Disbursal', icon: Bank, count: run && run.status !== 'draft' ? run.lines.filter((l) => l.payoutStatus !== 'paid').length || undefined : undefined },
    { id: 'history', label: 'History', icon: ClockCounterClockwise },
    ...(admin ? [{ id: 'settings', label: 'Settings', icon: GearSix }] : []),
  ]

  return (
    <motion.div {...fadeUp} className="max-w-full mx-auto">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-[28px] font-bold tracking-tight">Payroll</h1>
          <p className="text-[13px] text-ink-faint mt-0.5">{entity.legalName} · salary and disbursal sheets</p>
        </div>
        <MonthPicker value={month} onChange={(m) => setParams({ month: m, ...(tab !== 'sheet' ? { tab } : {}) }, { replace: true })} />
      </div>

      <SectionCard className="mt-5">
        <div className="pt-2">
          <Stepper step={step} />
        </div>
        <AnimatePresence initial={false}>
          {totals && (
            <motion.div key="totals" {...collapse} className="overflow-hidden">
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-x-6 gap-y-4 pt-5 mt-5 border-t border-hairline">
                <Stat label="Gross pay" value={<AnimatedNumber value={totals.gross} format={(n) => inr(Math.round(n))} />} hint={`${run.lines.length} people`} />
                <Stat label="Deductions" value={<AnimatedNumber value={totals.ded} format={(n) => inr(Math.round(n))} />} hint="PF, ESI, PT, TDS, recoveries" />
                <Stat label="Net payable" value={<AnimatedNumber value={totals.net} format={(n) => inr(Math.round(n))} />} hint="including expense reimbursements" />
                <Stat label="Employer contributions" value={<AnimatedNumber value={totals.employer} format={(n) => inr(Math.round(n))} />} hint="PF and ESI, on top of gross" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </SectionCard>

      <Tabs className="mt-4" tabs={tabs} value={tab} onChange={(id) => setParams({ month, ...(id !== 'sheet' ? { tab: id } : {}) }, { replace: true })} />

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={tab + month} {...fadeUp} className="mt-4">
          {tab === 'history' ? (
            <History onOpen={(p) => setParams({ month: p }, { replace: true })} />
          ) : tab === 'settings' && admin ? (
            <PayrollSettings />
          ) : loading && !run ? (
            <SectionCard><SkeletonRows rows={5} /></SectionCard>
          ) : error ? (
            <SectionCard><EmptyState icon={Warning} title="Payroll unavailable" hint={error} /></SectionCard>
          ) : !run ? (
            <SectionCard>
              <div className="flex flex-col items-center text-center py-10">
                <span className="grid place-items-center size-11 rounded-xl bg-accent-soft text-accent-text mb-3">
                  <Wallet size={22} />
                </span>
                <p className="font-display font-bold text-[16px] tracking-tight">No salary sheet for {monthLabel(month)} yet</p>
                {attendance.status === 'locked' ? (
                  <>
                    <p className="text-[13px] text-ink-faint mt-1 max-w-sm">
                      Attendance is locked for {attendance.people} people. Draft the sheet, review it, then finalise.
                    </p>
                    <Button size="lg" className="mt-4" icon={Table} onClick={createRun} loading={busy === 'create'}>
                      Draft salary sheet
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-[13px] text-ink-faint mt-1 max-w-sm">
                      Payroll runs from a locked attendance register.{' '}
                      {attendance.unmarked > 0 ? `${attendance.unmarked} working days are still unmarked.` : 'Every day is marked; it just needs locking.'}
                    </p>
                    <Button size="lg" className="mt-4" icon={CalendarCheck} onClick={() => navigate(`/attendance?month=${month}`)}>
                      Open {monthLabel(month, true)} attendance
                    </Button>
                  </>
                )}
              </div>
            </SectionCard>
          ) : tab === 'disbursal' ? (
            <Disbursal run={run} onRun={setRun} admin={admin} />
          ) : (
            <>
              <AnimatePresence initial={false}>
                {run.missingStructure.length > 0 && (
                  <motion.div key="missing" {...collapse} className="overflow-hidden">
                    <Banner tone="amber" icon={UserMinus} className="mb-3">
                      <p className="font-semibold">
                        {run.missingStructure.length} {run.missingStructure.length === 1 ? 'person has' : 'people have'} no salary set and {run.missingStructure.length === 1 ? 'is' : 'are'} left out of this sheet
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {run.missingStructure.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => {
                              setStructFor(m)
                              setStructOpen(true)
                            }}
                            className="inline-flex items-center gap-1 rounded-md bg-surface-high/80 hover:bg-surface-high px-2 py-1 text-[12px] font-semibold text-ink active:scale-95 transition-[background-color,transform] cursor-pointer"
                          >
                            {m.name} <span className="text-amber-ink">· set salary</span>
                          </button>
                        ))}
                      </div>
                    </Banner>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-center gap-2 flex-wrap mb-3">
                <p className="text-[12.5px] text-ink-faint">
                  {run.status === 'draft'
                    ? 'Draft. Click a row to add arrears, incentives, recoveries or override a figure.'
                    : `Finalised ${fmtStamp(run.finalisedAt)}. Figures are frozen.`}
                </p>
                <div className="ml-auto flex items-center gap-2 flex-wrap">
                  {run.status === 'draft' ? (
                    <>
                      <Button variant="danger-ghost" icon={Trash} onClick={() => setConfirm('delete')}>
                        Delete draft
                      </Button>
                      <Button variant="secondary" icon={ArrowsClockwise} onClick={recalc} loading={busy === 'recalc'}>
                        Recalculate
                      </Button>
                    </>
                  ) : (
                    <>
                      {admin && run.status === 'finalised' && (
                        <Button variant="ghost" icon={LockOpen} onClick={() => setConfirm('reopen')}>
                          Reopen
                        </Button>
                      )}
                      <Button variant="secondary" icon={Printer} onClick={() => navigate(`/payroll/${month}/payslips`)}>
                        Payslips
                      </Button>
                    </>
                  )}
                  <Button variant="secondary" icon={DownloadSimple} onClick={() => exportSalarySheet(entity, run)} disabled={!run.lines.length}>
                    Export
                  </Button>
                  {run.status === 'draft' ? (
                    <Button icon={SealCheck} onClick={() => setConfirm('finalise')} disabled={!run.lines.length}>
                      Finalise
                    </Button>
                  ) : (
                    <Button icon={Bank} onClick={() => go({ tab: 'disbursal' })}>
                      Go to disbursal
                    </Button>
                  )}
                </div>
              </div>

              {run.lines.length === 0 ? (
                <SectionCard>
                  <EmptyState icon={Wallet} title="No one to pay yet" hint="Set a salary for at least one person, then recalculate." />
                </SectionCard>
              ) : (
                <SalarySheet
                  run={run}
                  prevNet={prevNet}
                  onEdit={(l) => {
                    setEditLine(l)
                    setLineOpen(true)
                  }}
                />
              )}
            </>
          )}
        </motion.div>
      </AnimatePresence>

      <LineDialog
        open={lineOpen}
        onClose={() => setLineOpen(false)}
        line={editLine}
        period={month}
        onSaved={(updated) => setRun({ ...run, lines: run.lines.map((l) => (l.id === updated.id ? updated : l)) })}
      />
      <StructureDialog open={structOpen} onClose={() => setStructOpen(false)} employee={structFor} prefill={{ effectiveFrom: `${month}-01` }} onSaved={recalc} />

      <ConfirmDialog open={confirm === 'finalise'} onClose={() => setConfirm(null)} onConfirm={finalise} title={`Finalise ${monthLabel(month)}?`} confirmLabel="Finalise sheet" busy={busy === 'finalise'}>
        {run && (
          <>
            This freezes the salary sheet for <span className="font-semibold text-ink">{run.lines.length} people</span> at a net payable of{' '}
            <span className="font-semibold text-ink">{inr(totals?.net)}</span> and opens disbursal. Attendance for the month can no longer change.
            {run.missingStructure.length > 0 && (
              <span className="block mt-2 text-amber-ink font-semibold">{run.missingStructure.length} people without a salary will not be paid in this run.</span>
            )}
          </>
        )}
      </ConfirmDialog>
      <ConfirmDialog open={confirm === 'delete'} onClose={() => setConfirm(null)} onConfirm={remove} title="Delete this draft?" confirmLabel="Delete draft" danger busy={busy === 'delete'}>
        The draft sheet and any adjustments on it are removed. Attendance and salaries are not affected, and you can draft it again.
      </ConfirmDialog>
      <ConfirmDialog open={confirm === 'reopen'} onClose={() => setConfirm(null)} onConfirm={reopen} title="Reopen as a draft?" confirmLabel="Reopen" busy={busy === 'reopen'}>
        The sheet becomes editable again and held salaries are reset to pending. Only possible while nothing has been marked paid.
      </ConfirmDialog>
    </motion.div>
  )
}
