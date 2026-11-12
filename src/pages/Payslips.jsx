import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Printer, Warning } from '@phosphor-icons/react'
import { apiFetch } from '../lib/api'
import { fmtDate, inr, monthLabel } from '../lib/utils'
import { fadeUp } from '../lib/motion'
import { useEntity } from '../store/EntityContext'
import { ENTITY_LOGO } from '../components/logos'
import { EmptyState, SectionCard } from '../components/ui'
import { Button, SkeletonRows } from '../components/kit'

/* Print-ready payslips for a finalised run: one, or all with a page break
 * between them. The app chrome carries .no-print, so Print gives clean pages. */

const EARN = [
  ['basic', 'Basic'], ['hra', 'House rent allowance'], ['conveyance', 'Conveyance'],
  ['specialAllowance', 'Special allowance'], ['otherAllowance', 'Other allowance'],
  ['arrears', 'Arrears'], ['incentive', 'Incentive'],
]
const DED = [
  ['pfEmployee', 'Provident fund'], ['esiEmployee', 'ESI'], ['pt', 'Professional tax'],
  ['tds', 'Income tax (TDS)'], ['advance', 'Advance recovery'], ['otherDeduction', 'Other deduction'],
]

function Lines({ title, rows, line, total, totalLabel }) {
  const shown = rows.filter(([k]) => line[k] > 0)
  return (
    <div>
      <p className="text-[10.5px] uppercase tracking-[0.12em] font-semibold text-ink-faint pb-1.5 border-b border-ink">{title}</p>
      <dl>
        {shown.map(([k, label]) => (
          <div key={k} className="flex justify-between gap-4 py-1.5 border-b border-hairline text-[12.5px]">
            <dt className="text-ink-soft">{label}</dt>
            <dd className="font-mono tabular-nums">{inr(line[k])}</dd>
          </div>
        ))}
        {shown.length === 0 && <p className="py-1.5 text-[12.5px] text-ink-faint border-b border-hairline">None</p>}
        <div className="flex justify-between gap-4 py-2 text-[13px] font-semibold">
          <dt>{totalLabel}</dt>
          <dd className="font-mono tabular-nums">{inr(total)}</dd>
        </div>
      </dl>
    </div>
  )
}

function Payslip({ line, run, entity }) {
  const Logo = ENTITY_LOGO[entity.hue]
  return (
    <article className="bg-white border border-hairline rounded-2xl shadow-card p-7 sm:p-9 print:shadow-none print:border-0 print:rounded-none print:p-0 break-after-page last:break-after-auto">
      <header className="flex items-start justify-between gap-6 pb-5 border-b border-hairline">
        <div>
          {Logo && <Logo className="h-9 w-auto mb-2" />}
          <p className="font-display text-[15px] font-bold tracking-tight">{entity.legalName}</p>
        </div>
        <div className="text-right">
          <p className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-ink-faint">Payslip</p>
          <p className="font-display text-[20px] font-bold tracking-tight">{monthLabel(run.period)}</p>
        </div>
      </header>

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 py-5 text-[12.5px]">
        {[
          ['Employee', line.name],
          ['Employee code', line.code],
          ['Designation', line.designation || '—'],
          ['Department', line.department || '—'],
          ['Branch', line.branch || '—'],
          ['Days in month', line.daysInMonth],
          ['Paid days', line.paidDays],
          ['Loss-of-pay days', line.lopDays],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-[10.5px] uppercase tracking-[0.1em] text-ink-faint">{label}</dt>
            <dd className="font-medium mt-0.5">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid sm:grid-cols-2 gap-x-10 gap-y-5">
        <Lines title="Earnings" rows={EARN} line={line} total={line.gross} totalLabel="Gross earnings" />
        <Lines title="Deductions" rows={DED} line={line} total={line.totalDeductions} totalLabel="Total deductions" />
      </div>

      {line.expenseReimbursement > 0 && (
        <div className="flex justify-between gap-4 py-2 mt-1 border-t border-hairline text-[12.5px]">
          <span className="text-ink-soft">Expense reimbursement (not part of salary)</span>
          <span className="font-mono tabular-nums">{inr(line.expenseReimbursement)}</span>
        </div>
      )}

      <div className="flex items-end justify-between gap-6 mt-4 rounded-xl bg-paper px-5 py-4 print:bg-transparent print:border print:border-ink print:rounded-none">
        <div>
          <p className="text-[10.5px] uppercase tracking-[0.12em] font-semibold text-ink-faint">Net pay</p>
          <p className="text-[12px] text-ink-faint mt-0.5">
            {line.payoutStatus === 'paid' ? `Paid ${fmtDate(line.paidOn)}${line.paymentRef ? ` · ref ${line.paymentRef}` : ''}` : 'Payment pending'}
            {line.bank?.accountNumber && ` · A/c ${line.bank.accountNumber}`}
          </p>
        </div>
        <p className="font-display text-[28px] font-bold tracking-tight tabular-nums">{inr(line.netPay)}</p>
      </div>

      <p className="text-[10.5px] text-ink-faint mt-5">
        Employer contributions this month: PF {inr(line.pfEmployer)}, ESI {inr(line.esiEmployer)}. This is a computer-generated payslip and needs no signature.
      </p>
    </article>
  )
}

export default function Payslips() {
  const { period, lineId } = useParams()
  const { entity } = useEntity()
  const [run, setRun] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    apiFetch(`/payroll/runs/${period}`, { entity: entity.id })
      .then((r) => (r ? setRun(r) : setError('No salary sheet exists for this month.')))
      .catch((err) => setError(err.message))
  }, [period, entity.id])

  const lines = run ? (lineId ? run.lines.filter((l) => String(l.id) === lineId) : run.lines) : []

  return (
    <motion.div {...fadeUp} className="max-w-3xl mx-auto">
      <div className="no-print flex items-center justify-between gap-3 mb-4">
        <Link to={`/payroll?month=${period}`} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-soft hover:text-ink transition-colors">
          <ArrowLeft size={14} /> {monthLabel(period)} salary sheet
        </Link>
        <Button icon={Printer} onClick={() => window.print()} disabled={!lines.length}>
          Print {lines.length > 1 ? `${lines.length} payslips` : 'payslip'}
        </Button>
      </div>

      {error ? (
        <SectionCard><EmptyState icon={Warning} title="Could not load payslips" hint={error} /></SectionCard>
      ) : !run ? (
        <SectionCard><SkeletonRows rows={5} /></SectionCard>
      ) : run.status === 'draft' ? (
        <SectionCard><EmptyState icon={Warning} title="This sheet is still a draft" hint="Payslips are available once the salary sheet is finalised." /></SectionCard>
      ) : lines.length === 0 ? (
        <SectionCard><EmptyState icon={Warning} title="Payslip not found" /></SectionCard>
      ) : (
        <div className="space-y-5 print:space-y-0">
          {lines.map((l) => (
            <Payslip key={l.id} line={l} run={run} entity={entity} />
          ))}
        </div>
      )}
    </motion.div>
  )
}
