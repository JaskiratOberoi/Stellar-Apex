import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  CaretDown,
  EnvelopeSimple,
  MagnifyingGlass,
  MapPin,
  Phone,
  Rows,
  SquaresFour,
  UserPlus,
} from '@phosphor-icons/react'
import { DEPARTMENTS, STATUSES } from '../data/seed'
import { useEmployees } from '../store/EmployeeStore'
import { useEntity } from '../store/EntityContext'
import { cx, tenure } from '../lib/utils'
import { Avatar, EmptyState, StatusPill } from '../components/ui'

/* ---------------- Filter select ---------------- */
function FilterSelect({ value, onChange, options, allLabel, allValue = 'all' }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cx(
          'h-9 appearance-none rounded-[10px] border bg-surface pl-3 pr-8 text-[13px] font-medium outline-none cursor-pointer transition-colors',
          value === allValue
            ? 'border-hairline text-ink-soft'
            : 'border-accent/40 text-accent-text bg-accent-soft/60',
        )}
      >
        <option value={allValue}>{allLabel}</option>
        {options.map((o) => (
          <option key={o.value ?? o} value={o.value ?? o}>
            {o.label ?? o}
          </option>
        ))}
      </select>
      <CaretDown
        size={13}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-ink-faint"
      />
    </div>
  )
}

/* ---------------- Roster pulse — headcount + status composition ----------------
 * One panel instead of a row of stat cards: the total, a proportional
 * status bar, and a clickable legend that drives the status filter.
 */
const PULSE = [
  { id: 'active', label: 'Active', seg: 'bg-mint', text: 'text-mint', soft: 'bg-mint-soft' },
  { id: 'probation', label: 'Probation', seg: 'bg-amber-ink', text: 'text-amber-ink', soft: 'bg-amber-soft' },
  { id: 'notice', label: 'Notice', seg: 'bg-rose-ink', text: 'text-rose-ink', soft: 'bg-rose-soft' },
  { id: 'exited', label: 'Exited', seg: 'bg-hairline-strong', text: 'text-ink-faint', soft: 'bg-slate-soft' },
]

function RosterPulse({ counts, status, setStatus }) {
  return (
    <div className="bg-surface rounded-2xl border border-hairline shadow-card px-5 py-4 sm:px-6 sm:py-5">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
        <button
          onClick={() => setStatus('all')}
          className={cx(
            'text-left cursor-pointer transition-opacity',
            status !== 'all' && 'opacity-60 hover:opacity-100',
          )}
        >
          <p className="text-[11.5px] font-semibold text-ink-faint uppercase tracking-[0.08em]">
            Headcount
          </p>
          <p className="font-display text-[38px] leading-[1.1] font-bold tracking-tight tabular-nums">
            {counts.total}
          </p>
        </button>

        <div className="flex-1 min-w-56">
          {/* Proportional status bar */}
          <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-soft">
            {PULSE.map(({ id, seg }) => {
              const n = counts[id] ?? 0
              if (!n) return null
              return (
                <button
                  key={id}
                  onClick={() => setStatus(status === id ? 'all' : id)}
                  title={`${STATUSES[id].label}: ${n}`}
                  className={cx(
                    seg,
                    'cursor-pointer transition-all duration-300 first:rounded-l-full last:rounded-r-full',
                    status !== 'all' && status !== id && 'opacity-25',
                  )}
                  style={{ flexGrow: n, minWidth: 6 }}
                />
              )
            })}
          </div>

          {/* Legend drives the filter */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {PULSE.map(({ id, label, text, soft }) => (
              <button
                key={id}
                onClick={() => setStatus(status === id ? 'all' : id)}
                className={cx(
                  'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12px] font-semibold transition-all cursor-pointer active:scale-[0.97]',
                  status === id
                    ? cx(soft, text, 'ring-1 ring-current/20')
                    : 'text-ink-soft hover:bg-slate-soft',
                )}
              >
                <span className={cx('size-1.5 rounded-full', text, 'bg-current')} />
                {label}
                <span className="font-mono text-[11px] tabular-nums opacity-70">
                  {counts[id] ?? 0}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------------- Row / Card ---------------- */
function PersonRow({ e, onOpen, managerName, isHQ }) {
  return (
    <tr
      onClick={onOpen}
      className="group cursor-pointer border-b border-hairline last:border-0 hover:bg-accent-soft/40 transition-colors"
    >
      <td className="py-3 pl-4 pr-3">
        <div className="flex items-center gap-3">
          <Avatar name={e.name} photo={e.photo} size={38} />
          <div className="min-w-0">
            <p className="text-[13.5px] font-semibold truncate group-hover:text-accent-text">
              {e.name}
            </p>
            <p className="text-[12px] text-ink-faint truncate">{e.designation}</p>
          </div>
        </div>
      </td>
      <td className="px-3 hidden md:table-cell">
        <span className="font-mono text-[11.5px] text-ink-soft">{e.code}</span>
      </td>
      <td className="px-3 text-[13px] text-ink-soft hidden sm:table-cell">{e.department}</td>
      <td className="px-3 hidden lg:table-cell">
        <span className="text-[13px] text-ink-soft">{e.branch}</span>
        {isHQ && (
          <span className="ml-1.5 text-[9.5px] font-bold uppercase tracking-wider text-accent-text bg-accent-soft rounded px-1.5 py-0.5">
            HQ
          </span>
        )}
      </td>
      <td className="px-3 hidden xl:table-cell max-w-40">
        {managerName ? (
          <span className="inline-flex items-center gap-2 min-w-0">
            <Avatar name={managerName} size={22} />
            <span className="text-[12.5px] text-ink-soft truncate">{managerName}</span>
          </span>
        ) : (
          <span className="text-ink-faint">—</span>
        )}
      </td>
      <td className="px-3">
        <StatusPill status={e.status} />
      </td>
      <td className="pr-4 pl-2 text-right">
        <div className="inline-flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <a
            href={`mailto:${e.email}`}
            onClick={(ev) => ev.stopPropagation()}
            className="p-1.5 rounded-lg text-ink-faint hover:text-accent hover:bg-accent-soft"
            title={e.email}
          >
            <EnvelopeSimple size={14} />
          </a>
          <a
            href={`tel:${e.mobile}`}
            onClick={(ev) => ev.stopPropagation()}
            className="p-1.5 rounded-lg text-ink-faint hover:text-accent hover:bg-accent-soft"
            title={e.mobile}
          >
            <Phone size={14} />
          </a>
        </div>
      </td>
    </tr>
  )
}

function PersonCard({ e, onOpen }) {
  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onOpen}
      className="text-left bg-surface rounded-2xl border border-hairline shadow-card p-5 hover:border-accent/40 hover:shadow-pop hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-200 cursor-pointer"
    >
      <div className="flex items-start justify-between">
        <Avatar name={e.name} photo={e.photo} size={52} />
        <StatusPill status={e.status} />
      </div>
      <p className="font-display font-bold tracking-tight text-[15px] mt-3">{e.name}</p>
      <p className="text-[12.5px] text-ink-faint">{e.designation}</p>
      <div className="flex items-center gap-1.5 mt-3 flex-wrap text-[11.5px] text-ink-faint">
        <span className="inline-flex items-center gap-1">
          <MapPin size={11} /> {e.branch}
        </span>
        <span>· {e.department}</span>
      </div>
      <div className="mt-4 pt-3 border-t border-hairline flex items-center justify-between text-[11.5px] text-ink-faint">
        <span className="font-mono">{e.code}</span>
        <span>{tenure(e.joiningDate, e.exitDate)}</span>
      </div>
    </motion.button>
  )
}

/* ---------------- Page ---------------- */
export default function Directory() {
  const { employees, byId } = useEmployees()
  const { entity } = useEntity()
  const navigate = useNavigate()

  const [q, setQ] = useState('')
  const [branch, setBranch] = useState('all')
  const [department, setDepartment] = useState('all')
  const [status, setStatus] = useState('all')
  const [groupBy, setGroupBy] = useState('none')
  const [view, setView] = useState('table')

  /* Entity isolation: only the active portal's people, ever. */
  const roster = useMemo(
    () => employees.filter((e) => e.company === entity.id),
    [employees, entity.id],
  )

  const counts = useMemo(() => {
    const c = { total: roster.length, active: 0, probation: 0, notice: 0, exited: 0 }
    for (const e of roster) c[e.status] = (c[e.status] ?? 0) + 1
    return c
  }, [roster])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return roster.filter((e) => {
      if (branch !== 'all' && e.branch !== branch) return false
      if (department !== 'all' && e.department !== department) return false
      if (status !== 'all' && e.status !== status) return false
      if (!needle) return true
      return [e.name, e.code, e.email, e.mobile, e.designation, e.department, e.branch]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(needle))
    })
  }, [roster, q, branch, department, status])

  const groups = useMemo(() => {
    if (groupBy === 'none') return [{ key: null, items: filtered }]
    const map = new Map()
    for (const e of filtered) {
      const k = e[groupBy] ?? 'Other'
      if (!map.has(k)) map.set(k, [])
      map.get(k).push(e)
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, items]) => ({ key, items }))
  }, [filtered, groupBy])

  const open = (e) => navigate(`/people/${e.id}`)

  return (
    <div className="max-w-7xl mx-auto">
      {/* Heading */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-[28px] font-bold tracking-tight">People</h1>
          <p className="text-[13px] text-ink-faint mt-0.5">
            {entity.legalName} · {entity.branches.length} branches
          </p>
        </div>
      </div>

      <div className="mt-5">
        <RosterPulse counts={counts} status={status} setStatus={setStatus} />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 mt-4 flex-wrap">
        <div className="relative flex-1 min-w-52 max-w-sm">
          <MagnifyingGlass
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, code, email, phone…"
            className="w-full h-9 rounded-[10px] border border-hairline bg-surface pl-9 pr-3 text-[13px] outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 placeholder:text-ink-faint transition-colors"
          />
        </div>

        <FilterSelect value={branch} onChange={setBranch} allLabel="All branches" options={entity.branches} />
        <FilterSelect value={department} onChange={setDepartment} allLabel="All departments" options={DEPARTMENTS} />
        <FilterSelect
          value={status}
          onChange={setStatus}
          allLabel="All statuses"
          options={Object.values(STATUSES).map((s) => ({ value: s.id, label: s.label }))}
        />
        <FilterSelect
          value={groupBy}
          onChange={setGroupBy}
          allValue="none"
          allLabel="No grouping"
          options={[
            { value: 'branch', label: 'Group: Branch' },
            { value: 'department', label: 'Group: Department' },
          ]}
        />

        {/* View toggle */}
        <div className="ml-auto flex rounded-[10px] border border-hairline bg-surface p-0.5">
          {[
            { id: 'table', icon: Rows },
            { id: 'cards', icon: SquaresFour },
          ].map(({ id, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setView(id)}
              className={cx(
                'p-1.5 rounded-lg transition-colors cursor-pointer',
                view === id ? 'bg-ink text-paper' : 'text-ink-faint hover:text-ink',
              )}
              aria-label={`${id} view`}
            >
              <Icon size={15} weight={view === id ? 'fill' : 'regular'} />
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <p className="text-[12px] text-ink-faint mt-4 mb-2 font-mono tabular-nums">
        {filtered.length} {filtered.length === 1 ? 'person' : 'people'}
      </p>

      {filtered.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-hairline shadow-card">
          {counts.total === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <span className="grid place-items-center size-11 rounded-xl bg-accent-soft text-accent-text mb-3">
                <UserPlus size={22} />
              </span>
              <p className="font-display font-bold text-[15px] tracking-tight">No employees yet</p>
              <p className="text-[13px] text-ink-faint mt-1 max-w-xs">
                {entity.name} has no people on record. Add your first employee to get started.
              </p>
              <button
                onClick={() => navigate('/people/new')}
                className="mt-4 inline-flex items-center gap-1.5 h-9 rounded-[10px] bg-accent hover:bg-accent-deep active:scale-[0.98] text-white text-[13px] font-semibold px-4 transition-all cursor-pointer"
              >
                <UserPlus size={15} weight="bold" /> Add employee
              </button>
            </div>
          ) : (
            <EmptyState
              icon={MagnifyingGlass}
              title="No people match"
              hint="Try clearing a filter or broadening your search."
            />
          )}
        </div>
      ) : (
        groups.map(({ key, items }) => (
          <div key={key ?? 'all'} className="mb-6">
            {key && (
              <div className="flex items-baseline gap-2 mb-2 mt-1">
                <h2 className="font-display font-bold tracking-tight text-[15px]">{key}</h2>
                <span className="text-[12px] text-ink-faint font-mono tabular-nums">
                  {items.length}
                </span>
              </div>
            )}

            {view === 'table' ? (
              <div className="bg-surface rounded-2xl border border-hairline shadow-card overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[560px]">
                  <thead>
                    <tr className="text-[10.5px] uppercase tracking-[0.1em] text-ink-faint border-b border-hairline">
                      <th className="py-2.5 pl-4 pr-3 font-semibold">Employee</th>
                      <th className="px-3 font-semibold hidden md:table-cell">Code</th>
                      <th className="px-3 font-semibold hidden sm:table-cell">Department</th>
                      <th className="px-3 font-semibold hidden lg:table-cell">Branch</th>
                      <th className="px-3 font-semibold hidden xl:table-cell">Manager</th>
                      <th className="px-3 font-semibold">Status</th>
                      <th className="pr-4" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((e) => (
                      <PersonRow
                        key={e.id}
                        e={e}
                        onOpen={() => open(e)}
                        managerName={e.reportsTo ? byId(e.reportsTo)?.name : null}
                        isHQ={e.branch === entity.headOffice}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {items.map((e) => (
                  <PersonCard key={e.id} e={e} onOpen={() => open(e)} />
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}
