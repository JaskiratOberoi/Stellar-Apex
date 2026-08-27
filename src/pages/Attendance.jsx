import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CaretLeft, CaretRight, UsersThree } from '@phosphor-icons/react'
import { useEmployees } from '../store/EmployeeStore'
import { useEntity } from '../store/EntityContext'
import { cx } from '../lib/utils'
import { Avatar, EmptyState, SectionCard } from '../components/ui'
import { SampleTag, Stat, TrendBars } from '../components/charts'

/* ------------------------------------------------------------------
 * Attendance PREVIEW. Capture devices/API are not wired up yet, so
 * the register below is deterministic sample data (seeded from the
 * employee id + date, stable across reloads) — labeled as such.
 * ------------------------------------------------------------------ */

const hash = (s) => {
  let x = 7
  for (const c of s) x = (x * 31 + c.charCodeAt(0)) >>> 0
  return x
}
const iso = (d) => d.toISOString().slice(0, 10)

const dayStatus = (e, date) => {
  const day = date.getDay()
  if (day === 0) return { id: 'off', label: 'Week off' } // Sundays off
  const v = hash(`${e.id}:${iso(date)}`)
  const r = v % 20
  if (r === 0) return { id: 'absent', label: 'Absent' }
  if (r <= 2) return { id: 'leave', label: 'On leave' }
  const mins = v % 95 // 09:00 – 10:35 in-time
  const hh = 9 + Math.floor(mins / 60)
  const mm = String(mins % 60).padStart(2, '0')
  return { id: 'present', label: 'Present', inTime: `${String(hh).padStart(2, '0')}:${mm}` }
}

const STATUS_STYLE = {
  present: 'text-mint',
  leave: 'text-amber-ink',
  absent: 'text-rose-ink',
  off: 'text-ink-faint',
}

export default function Attendance() {
  const { employees } = useEmployees()
  const { entity } = useEntity()

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(12, 0, 0, 0)
    return d
  }, [])
  const [date, setDate] = useState(today)

  const roster = useMemo(
    () =>
      employees
        .filter((e) => e.company === entity.id && e.status !== 'exited')
        .sort((a, b) => a.name.localeCompare(b.name)),
    [employees, entity.id],
  )

  const register = useMemo(
    () => roster.map((e) => ({ e, s: dayStatus(e, date) })),
    [roster, date],
  )
  const counts = useMemo(() => {
    const c = { present: 0, leave: 0, absent: 0, off: 0 }
    for (const { s } of register) c[s.id]++
    return c
  }, [register])

  /* Presence % for the trailing 14 working days */
  const fortnight = useMemo(() => {
    const out = []
    const d = new Date(date)
    while (out.length < 14) {
      if (d.getDay() !== 0) {
        const present = roster.filter((e) => dayStatus(e, d).id === 'present').length
        out.unshift({
          label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
          tick: String(d.getDate()),
          value: roster.length ? Math.round((present / roster.length) * 100) : 0,
        })
      }
      d.setDate(d.getDate() - 1)
    }
    return out
  }, [roster, date])

  const shift = (days) => {
    const d = new Date(date)
    d.setDate(d.getDate() + days)
    if (d <= today) setDate(d)
  }
  const isToday = iso(date) === iso(today)

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-[28px] font-bold tracking-tight">Attendance</h1>
            <SampleTag>Sample preview</SampleTag>
          </div>
          <p className="text-[13px] text-ink-faint mt-0.5">
            Capture isn't wired up yet. This register shows stable sample data so the
            workflow can be reviewed.
          </p>
        </div>

        {/* Day navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => shift(-1)}
            className="p-2 rounded-[10px] border border-hairline bg-surface text-ink-soft hover:border-hairline-strong active:scale-95 transition-all cursor-pointer"
            aria-label="Previous day"
          >
            <CaretLeft size={14} />
          </button>
          <span className="px-3 text-[13px] font-semibold min-w-36 text-center">
            {isToday
              ? 'Today'
              : date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
          </span>
          <button
            onClick={() => shift(1)}
            disabled={isToday}
            className="p-2 rounded-[10px] border border-hairline bg-surface text-ink-soft hover:border-hairline-strong active:scale-95 disabled:opacity-40 disabled:cursor-default transition-all cursor-pointer"
            aria-label="Next day"
          >
            <CaretRight size={14} />
          </button>
        </div>
      </div>

      {roster.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-hairline shadow-card mt-5">
          <EmptyState icon={UsersThree} title="No one to mark" hint="Add employees first." />
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="mt-5 space-y-4"
        >
          {/* Day summary + fortnight presence */}
          <div className="bg-surface rounded-2xl border border-hairline shadow-card px-5 py-4 sm:px-6 sm:py-5">
            <div className="flex flex-wrap items-start gap-x-10 gap-y-4">
              <div className="flex gap-8">
                <Stat label="Present" value={counts.present} />
                <Stat label="On leave" value={counts.leave} />
                <Stat label="Absent" value={counts.absent} />
              </div>
              <div className="flex-1 min-w-60 pt-1">
                <p className="text-[11.5px] font-semibold text-ink-faint uppercase tracking-[0.08em] mb-2">
                  Presence · trailing 14 working days
                </p>
                <TrendBars points={fortnight} height={56} tickEvery={4} />
              </div>
            </div>
          </div>

          {/* Register */}
          <SectionCard title={`Register · ${register.length} people`}>
            <ul className="divide-y divide-hairline -mx-1">
              {register.map(({ e, s }) => (
                <li key={e.id} className="flex items-center gap-3 py-2.5 px-1">
                  <Avatar name={e.name} photo={e.photo} size={36} />
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/people/${e.id}`}
                      className="text-[13px] font-semibold truncate hover:text-accent-text"
                    >
                      {e.name}
                    </Link>
                    <p className="text-[11.5px] text-ink-faint truncate">
                      {e.designation} · {e.branch}
                    </p>
                  </div>
                  {s.inTime && (
                    <span className="font-mono text-[12px] text-ink-soft tabular-nums hidden sm:inline">
                      in {s.inTime}
                    </span>
                  )}
                  <span
                    className={cx(
                      'inline-flex items-center gap-1.5 text-[12px] font-semibold min-w-20 justify-end',
                      STATUS_STYLE[s.id],
                    )}
                  >
                    <span className="size-1.5 rounded-full bg-current" />
                    {s.label}
                  </span>
                </li>
              ))}
            </ul>
          </SectionCard>
        </motion.div>
      )}
    </div>
  )
}
