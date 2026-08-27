import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Cake,
  ChartBar,
  DoorOpen,
  Hourglass,
  IdentificationCard,
  UserPlus,
} from '@phosphor-icons/react'
import { useEmployees } from '../store/EmployeeStore'
import { useEntity } from '../store/EntityContext'
import { completeness, cx, fmtDate, tenure } from '../lib/utils'
import { Avatar, EmptyState, SectionCard, StatusPill } from '../components/ui'
import { HBarList, Stat, TrendBars } from '../components/charts'

/* Payroll-blocking fields present? (mirrors the Payroll page rule) */
const payrollReady = (e) =>
  !!(e.pan && e.bank?.accountNumber && e.bank?.ifsc &&
    (e.uan || ['Consultant', 'Intern'].includes(e.employmentType)))

const topN = (map, n) =>
  [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)
    .map(([label, value]) => ({ label, value }))

export default function Dashboard() {
  const { employees } = useEmployees()
  const { entity } = useEntity()
  const navigate = useNavigate()

  /* Entity isolation: only the active portal's people, ever. */
  const roster = useMemo(
    () => employees.filter((e) => e.company === entity.id),
    [employees, entity.id],
  )
  const active = useMemo(() => roster.filter((e) => e.status !== 'exited'), [roster])

  /* ---- Headcount by month, trailing 12 (from joining/exit dates) ---- */
  const trend = useMemo(() => {
    const now = new Date()
    return [...Array(12)].map((_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1)
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
      const value = roster.filter((e) => {
        if (!e.joiningDate || new Date(e.joiningDate) > monthEnd) return false
        return !(e.exitDate && new Date(e.exitDate) <= monthEnd)
      }).length
      return {
        label: d.toLocaleString('en-IN', { month: 'short', year: '2-digit' }),
        tick: d.toLocaleString('en-IN', { month: 'narrow' }),
        value,
      }
    })
  }, [roster])
  const netChange = trend.length ? trend[trend.length - 1].value - trend[0].value : 0

  /* ---- Distributions ---- */
  const byDept = useMemo(() => {
    const m = new Map()
    for (const e of active) m.set(e.department, (m.get(e.department) ?? 0) + 1)
    return topN(m, 6)
  }, [active])
  const byBranch = useMemo(() => {
    const m = new Map()
    for (const e of active) m.set(e.branch, (m.get(e.branch) ?? 0) + 1)
    return topN(m, 6)
  }, [active])
  const byType = useMemo(() => {
    const m = new Map()
    for (const e of active) m.set(e.employmentType, (m.get(e.employmentType) ?? 0) + 1)
    return topN(m, 5)
  }, [active])

  /* ---- Watchlists (all real) ---- */
  const probation = useMemo(() => active.filter((e) => e.status === 'probation'), [active])
  const notice = useMemo(() => active.filter((e) => e.status === 'notice'), [active])
  const incomplete = useMemo(
    () => active.filter((e) => completeness(e).pct < 100),
    [active],
  )
  const notReady = useMemo(() => active.filter((e) => !payrollReady(e)), [active])

  const birthdays = useMemo(() => {
    const today = new Date()
    return active
      .filter((e) => e.dob)
      .map((e) => {
        const d = new Date(e.dob)
        let next = new Date(today.getFullYear(), d.getMonth(), d.getDate())
        if (next < new Date(today.getFullYear(), today.getMonth(), today.getDate()))
          next = new Date(today.getFullYear() + 1, d.getMonth(), d.getDate())
        return { e, next, days: Math.round((next - today) / 86400000) }
      })
      .filter((b) => b.days <= 30)
      .sort((a, b) => a.next - b.next)
      .slice(0, 5)
  }, [active])

  const recentJoiners = useMemo(() => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 90)
    return active
      .filter((e) => e.joiningDate && new Date(e.joiningDate) >= cutoff)
      .sort((a, b) => (a.joiningDate < b.joiningDate ? 1 : -1))
      .slice(0, 6)
  }, [active])

  const attention = [
    { icon: Hourglass, label: 'On probation', n: probation.length, tone: 'text-amber-ink bg-amber-soft', to: '/people' },
    { icon: DoorOpen, label: 'Serving notice', n: notice.length, tone: 'text-rose-ink bg-rose-soft', to: '/people' },
    { icon: IdentificationCard, label: 'Incomplete profiles', n: incomplete.length, tone: 'text-accent-text bg-accent-soft', to: '/people' },
    { icon: ChartBar, label: 'Not payroll-ready', n: notReady.length, tone: 'text-accent-text bg-accent-soft', to: '/payroll' },
  ]

  if (roster.length === 0) {
    return (
      <div className="max-w-7xl mx-auto">
        <h1 className="font-display text-[28px] font-bold tracking-tight">Dashboard</h1>
        <div className="bg-surface rounded-2xl border border-hairline shadow-card mt-5">
          <EmptyState
            icon={UserPlus}
            title="Nothing to report yet"
            hint="Add people to the register and this dashboard fills itself in."
          />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-[28px] font-bold tracking-tight">Dashboard</h1>
          <p className="text-[13px] text-ink-faint mt-0.5">
            {entity.legalName} · live from the people register
          </p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-5"
      >
        {/* ---- Workforce trend ---- */}
        <SectionCard title="Workforce" className="lg:col-span-2">
          <div className="flex flex-wrap items-start gap-x-10 gap-y-4">
            <Stat
              label="Headcount"
              value={active.length}
              delta={netChange === 0 ? null : netChange > 0 ? `+${netChange}` : `${netChange}`}
              deltaTone={netChange >= 0 ? 'mint' : 'rose'}
              hint="past 12 months"
            />
            <div className="flex-1 min-w-60 pt-1">
              <TrendBars points={trend} height={84} />
            </div>
          </div>
        </SectionCard>

        {/* ---- Needs attention ---- */}
        <SectionCard title="Needs attention">
          <ul className="space-y-1">
            {attention.map(({ icon: Icon, label, n, tone, to }) => (
              <li key={label}>
                <button
                  onClick={() => navigate(to)}
                  className="w-full flex items-center gap-3 rounded-[10px] px-2 py-2 hover:bg-slate-soft/70 active:scale-[0.99] transition-all cursor-pointer text-left"
                >
                  <span className={cx('size-8 rounded-[10px] grid place-items-center shrink-0', tone)}>
                    <Icon size={15} weight="fill" />
                  </span>
                  <span className="text-[13px] font-medium flex-1">{label}</span>
                  <span className="font-mono text-[13px] font-semibold tabular-nums">{n}</span>
                  <ArrowRight size={13} className="text-ink-faint" />
                </button>
              </li>
            ))}
          </ul>
        </SectionCard>

        {/* ---- Distributions ---- */}
        <SectionCard title="Departments">
          {byDept.length ? <HBarList items={byDept} /> : <p className="text-[12.5px] text-ink-faint">No data.</p>}
        </SectionCard>

        <SectionCard title="Branches">
          {byBranch.length ? <HBarList items={byBranch} /> : <p className="text-[12.5px] text-ink-faint">No data.</p>}
        </SectionCard>

        <SectionCard title="Employment type">
          {byType.length ? <HBarList items={byType} /> : <p className="text-[12.5px] text-ink-faint">No data.</p>}
        </SectionCard>

        {/* ---- Birthdays ---- */}
        <SectionCard title="Birthdays · next 30 days">
          {birthdays.length ? (
            <ul className="space-y-2.5">
              {birthdays.map(({ e, next, days }) => (
                <li key={e.id}>
                  <Link to={`/people/${e.id}`} className="flex items-center gap-3 group">
                    <Avatar name={e.name} photo={e.photo} size={34} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold truncate group-hover:text-accent-text">{e.name}</p>
                      <p className="text-[11.5px] text-ink-faint truncate">
                        {next.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[11.5px] text-ink-faint font-mono shrink-0">
                      <Cake size={13} />
                      {days === 0 ? 'today' : `${days}d`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[12.5px] text-ink-faint py-2">No birthdays in the next 30 days.</p>
          )}
        </SectionCard>

        {/* ---- Recent joiners ---- */}
        <SectionCard title="Recent joiners · 90 days" className="lg:col-span-2">
          {recentJoiners.length ? (
            <ul className="divide-y divide-hairline">
              {recentJoiners.map((e) => (
                <li key={e.id}>
                  <Link
                    to={`/people/${e.id}`}
                    className="flex items-center gap-3 py-2.5 group"
                  >
                    <Avatar name={e.name} photo={e.photo} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold truncate group-hover:text-accent-text">{e.name}</p>
                      <p className="text-[11.5px] text-ink-faint truncate">
                        {e.designation} · {e.branch}
                      </p>
                    </div>
                    <span className="text-[11.5px] text-ink-faint font-mono hidden sm:inline">
                      {fmtDate(e.joiningDate)}
                    </span>
                    <StatusPill status={e.status} className="hidden md:inline-flex" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[12.5px] text-ink-faint py-2">
              No one joined in the last 90 days. Tenured team: median{' '}
              {active.length ? tenure(active.map((e) => e.joiningDate).sort()[Math.floor(active.length / 2)]) : '—'}.
            </p>
          )}
        </SectionCard>
      </motion.div>
    </div>
  )
}
