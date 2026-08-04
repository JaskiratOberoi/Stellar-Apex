import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Archive,
  ChevronDown,
  DoorOpen,
  Hourglass,
  LayoutGrid,
  Mail,
  MapPin,
  Phone,
  Rows3,
  Search,
  SearchX,
  UserCheck,
  UserRoundPlus,
  UsersRound,
} from 'lucide-react'
import { DEPARTMENTS, STATUSES } from '../data/seed'
import { useEmployees } from '../store/EmployeeStore'
import { useEntity } from '../store/EntityContext'
import { cx, tenure } from '../lib/utils'
import { Avatar, EmptyState, StatusPill } from '../components/ui'

/* ---------------- Filter select ---------------- */
function FilterSelect({ value, onChange, options, allLabel }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cx(
          'h-9 appearance-none rounded-xl border bg-surface pl-3 pr-8 text-[13px] font-medium outline-none cursor-pointer transition-colors',
          value === 'all'
            ? 'border-hairline text-ink-soft'
            : 'border-iris/40 text-iris-text bg-iris-soft/60',
        )}
      >
        <option value="all">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value ?? o} value={o.value ?? o}>
            {o.label ?? o}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-ink-faint"
      />
    </div>
  )
}

/* ---------------- KPI tile ---------------- */
function Kpi({ label, value, icon: Icon, chip, num, bar, onClick, active }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        'group relative flex-1 min-w-32 overflow-hidden rounded-2xl border bg-surface px-4 pt-3 pb-4 text-left transition-all duration-200 cursor-pointer',
        active
          ? 'border-iris/50 shadow-pop ring-2 ring-iris/15'
          : 'border-hairline hover:-translate-y-0.5 hover:shadow-pop hover:border-hairline-strong',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className={cx('text-[11.5px] font-semibold', active ? 'text-ink-soft' : 'text-ink-faint')}>{label}</p>
        <span
          className={cx(
            'grid place-items-center size-7 rounded-lg transition-transform duration-200 group-hover:scale-110',
            chip,
          )}
        >
          <Icon size={14} strokeWidth={2.25} />
        </span>
      </div>
      <p className={cx('font-display text-[26px] leading-8 font-bold mt-1', num)}>{value}</p>
      <span
        className={cx(
          'absolute left-4 right-4 bottom-1.5 h-[3px] rounded-full transition-opacity',
          bar,
          active ? 'opacity-90' : 'opacity-0 group-hover:opacity-40',
        )}
      />
    </button>
  )
}

/* ---------------- Row / Card ---------------- */
function PersonRow({ e, onOpen, managerName, isHQ }) {
  return (
    <tr
      onClick={onOpen}
      className="group cursor-pointer border-b border-hairline last:border-0 hover:bg-iris-soft/40 transition-colors"
    >
      <td className="py-3 pl-4 pr-3">
        <div className="flex items-center gap-3">
          <Avatar name={e.name} photo={e.photo} size={38} />
          <div className="min-w-0">
            <p className="text-[13.5px] font-semibold truncate group-hover:text-iris-text">
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
          <span className="ml-1.5 text-[9.5px] font-bold uppercase tracking-wider text-iris-text bg-iris-soft rounded px-1.5 py-0.5">
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
            className="p-1.5 rounded-lg text-ink-faint hover:text-iris hover:bg-iris-soft"
            title={e.email}
          >
            <Mail size={14} />
          </a>
          <a
            href={`tel:${e.mobile}`}
            onClick={(ev) => ev.stopPropagation()}
            className="p-1.5 rounded-lg text-ink-faint hover:text-iris hover:bg-iris-soft"
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
      className="relative overflow-hidden text-left bg-surface rounded-2xl border border-hairline shadow-card p-5 hover:border-iris/50 hover:shadow-pop hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -top-12 -right-12 size-32 rounded-full bg-iris-soft/80 blur-2xl"
      />
      <div className="relative flex items-start justify-between">
        <Avatar name={e.name} photo={e.photo} size={52} />
        <StatusPill status={e.status} />
      </div>
      <p className="font-display font-semibold text-[15px] mt-3">{e.name}</p>
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
          <h1 className="font-display text-[26px] font-bold tracking-tight">People</h1>
          <p className="text-[13px] text-ink-faint mt-0.5">
            {entity.legalName} · {entity.branches.length} branches
          </p>
        </div>
      </div>

      {/* KPI strip — click to filter by status */}
      <div className="flex gap-3 mt-5 overflow-x-auto pb-1">
        <Kpi label="Total people" value={counts.total} icon={UsersRound} chip="bg-iris-soft text-iris-text" bar="bg-gradient-to-r from-iris to-aurora" onClick={() => setStatus('all')} active={status === 'all'} />
        <Kpi label="Active" value={counts.active} icon={UserCheck} chip="bg-mint-soft text-mint" num="text-mint" bar="bg-mint" onClick={() => setStatus('active')} active={status === 'active'} />
        <Kpi label="On probation" value={counts.probation} icon={Hourglass} chip="bg-amber-soft text-amber-ink" num="text-amber-ink" bar="bg-amber-ink" onClick={() => setStatus('probation')} active={status === 'probation'} />
        <Kpi label="Notice period" value={counts.notice} icon={DoorOpen} chip="bg-rose-soft text-rose-ink" num="text-rose-ink" bar="bg-rose-ink" onClick={() => setStatus('notice')} active={status === 'notice'} />
        <Kpi label="Exited" value={counts.exited} icon={Archive} chip="bg-slate-soft text-ink-faint" num="text-ink-faint" bar="bg-ink-faint" onClick={() => setStatus('exited')} active={status === 'exited'} />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 mt-4 flex-wrap">
        <div className="relative flex-1 min-w-52 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, code, email, phone…"
            className="w-full h-9 rounded-xl border border-hairline bg-surface pl-9 pr-3 text-[13px] outline-none focus:border-iris focus:ring-2 focus:ring-iris/15 placeholder:text-ink-faint"
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
          allLabel="No grouping"
          options={[
            { value: 'branch', label: 'Group: Branch' },
            { value: 'department', label: 'Group: Department' },
          ]}
        />

        {/* View toggle */}
        <div className="ml-auto flex rounded-xl border border-hairline bg-surface p-0.5">
          {[
            { id: 'table', icon: Rows3 },
            { id: 'cards', icon: LayoutGrid },
          ].map(({ id, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setView(id)}
              className={cx(
                'p-1.5 rounded-[10px] transition-colors cursor-pointer',
                view === id ? 'bg-iris text-white' : 'text-ink-faint hover:text-ink',
              )}
              aria-label={`${id} view`}
            >
              <Icon size={15} />
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <p className="text-[12px] text-ink-faint mt-4 mb-2">
        {filtered.length} {filtered.length === 1 ? 'person' : 'people'}
      </p>

      {filtered.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-hairline shadow-card">
          {counts.total === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <UserRoundPlus size={28} className="text-ink-faint mb-3" />
              <p className="font-display font-semibold text-[15px]">No employees yet</p>
              <p className="text-[13px] text-ink-faint mt-1 max-w-xs">
                {entity.name} has no people on record. Add your first employee to get started.
              </p>
              <button
                onClick={() => navigate('/people/new')}
                className="mt-4 inline-flex items-center gap-1.5 h-9 rounded-xl bg-iris hover:bg-iris-deep text-white text-[13px] font-semibold px-4 transition-colors cursor-pointer"
              >
                <UserRoundPlus size={15} strokeWidth={2.5} /> Add employee
              </button>
            </div>
          ) : (
            <EmptyState
              icon={SearchX}
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
                <h2 className="font-display font-semibold text-[15px]">{key}</h2>
                <span className="text-[12px] text-ink-faint">{items.length}</span>
              </div>
            )}

            {view === 'table' ? (
              <div className="bg-surface rounded-2xl border border-hairline shadow-card overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[560px]">
                  <thead>
                    <tr className="text-[10.5px] uppercase tracking-[0.1em] text-ink-faint border-b border-hairline bg-paper/70">
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
