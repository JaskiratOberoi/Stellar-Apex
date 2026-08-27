import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CalendarBlank, SealCheck, UsersThree, Wallet, WarningCircle } from '@phosphor-icons/react'
import { useEmployees } from '../store/EmployeeStore'
import { useEntity } from '../store/EntityContext'
import { Avatar, EmptyState, SectionCard, StatusPill } from '../components/ui'
import { Stat } from '../components/charts'

/* ------------------------------------------------------------------
 * Payroll readiness — all REAL, derived from the register. The pay
 * engine itself (salary structures, runs, payslips) lands in Phase 2;
 * until then this page keeps the roster clean enough to run day one.
 * ------------------------------------------------------------------ */

/* What blocks a bank transfer + statutory filing for one person */
const blockers = (e) => {
  const out = []
  if (!e.pan) out.push('PAN')
  if (!e.uan && !['Consultant', 'Intern'].includes(e.employmentType)) out.push('UAN')
  if (!e.bank?.accountNumber) out.push('Bank account')
  if (!e.bank?.ifsc) out.push('IFSC')
  return out
}

export default function Payroll() {
  const { employees } = useEmployees()
  const { entity } = useEntity()

  const roster = useMemo(
    () => employees.filter((e) => e.company === entity.id && e.status !== 'exited'),
    [employees, entity.id],
  )

  const rows = useMemo(
    () =>
      roster
        .map((e) => ({ e, missing: blockers(e) }))
        .sort((a, b) => b.missing.length - a.missing.length || a.e.name.localeCompare(b.e.name)),
    [roster],
  )
  const blocked = rows.filter((r) => r.missing.length > 0)
  const ready = rows.length - blocked.length

  /* Current cycle — real calendar */
  const now = new Date()
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const payDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const d = (x) =>
    x.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="max-w-5xl mx-auto">
      <div>
        <h1 className="font-display text-[28px] font-bold tracking-tight">Payroll</h1>
        <p className="text-[13px] text-ink-faint mt-0.5">
          {entity.legalName} · readiness is live from the register; the pay engine lands in Phase 2.
        </p>
      </div>

      {roster.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-hairline shadow-card mt-5">
          <EmptyState icon={UsersThree} title="No payees yet" hint="Add employees first." />
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="mt-5 space-y-4"
        >
          {/* Cycle + readiness summary */}
          <div className="bg-surface rounded-2xl border border-hairline shadow-card px-5 py-4 sm:px-6 sm:py-5">
            <div className="flex flex-wrap items-start gap-x-10 gap-y-4">
              <Stat
                label="Payroll-ready"
                value={`${ready}/${rows.length}`}
                hint="bank + statutory details on file"
              />
              <div className="flex-1 min-w-64">
                <p className="text-[11.5px] font-semibold text-ink-faint uppercase tracking-[0.08em] mb-2.5 flex items-center gap-1.5">
                  <CalendarBlank size={13} /> Current cycle
                </p>
                <div className="flex flex-wrap gap-x-8 gap-y-2 text-[13px]">
                  <div>
                    <p className="text-ink-faint text-[11.5px]">Period</p>
                    <p className="font-medium">{d(periodStart)} to {d(periodEnd)}</p>
                  </div>
                  <div>
                    <p className="text-ink-faint text-[11.5px]">Pay date</p>
                    <p className="font-medium">{d(payDate)}</p>
                  </div>
                  <div>
                    <p className="text-ink-faint text-[11.5px]">Status</p>
                    <p className="font-medium inline-flex items-center gap-1.5 text-amber-ink">
                      <Wallet size={13} /> Awaiting pay engine
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Blockers */}
          <SectionCard
            title={
              blocked.length
                ? `Blocked · ${blocked.length} ${blocked.length === 1 ? 'person needs' : 'people need'} details`
                : 'Everyone is payroll-ready'
            }
          >
            {blocked.length === 0 ? (
              <p className="text-[13px] text-ink-soft flex items-center gap-2 py-1">
                <SealCheck size={16} weight="fill" className="text-mint" />
                Every active employee has PAN, UAN, and bank details on file.
              </p>
            ) : (
              <ul className="divide-y divide-hairline -mx-1">
                {blocked.map(({ e, missing }) => (
                  <li key={e.id} className="flex items-center gap-3 py-2.5 px-1">
                    <Avatar name={e.name} photo={e.photo} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          to={`/people/${e.id}`}
                          className="text-[13px] font-semibold truncate hover:text-accent-text"
                        >
                          {e.name}
                        </Link>
                        {e.status === 'notice' && <StatusPill status="notice" />}
                      </div>
                      <p className="text-[11.5px] text-ink-faint truncate">
                        {e.designation} · <span className="font-mono">{e.code}</span>
                      </p>
                    </div>
                    <div className="flex gap-1.5 flex-wrap justify-end">
                      {missing.map((m) => (
                        <span
                          key={m}
                          className="inline-flex items-center gap-1 rounded-md bg-amber-soft text-amber-ink text-[11px] font-semibold px-2 py-0.5"
                        >
                          <WarningCircle size={11} weight="fill" /> {m}
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {/* Ready roll-call, collapsed to a quiet line */}
          {blocked.length > 0 && ready > 0 && (
            <p className="text-[12.5px] text-ink-faint flex items-center gap-1.5 px-1">
              <SealCheck size={14} weight="fill" className="text-mint" />
              {ready} {ready === 1 ? 'person is' : 'people are'} fully payroll-ready.
            </p>
          )}
        </motion.div>
      )}
    </div>
  )
}
