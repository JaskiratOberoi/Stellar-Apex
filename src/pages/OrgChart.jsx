import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowsInLineVertical,
  ArrowsOutLineVertical,
  CaretRight,
  Minus,
  Plus,
  UserPlus,
  UsersThree,
} from '@phosphor-icons/react'
import { useEmployees } from '../store/EmployeeStore'
import { useEntity } from '../store/EntityContext'
import { buildForest, forestDepth } from '../lib/org'
import { cx } from '../lib/utils'
import { Avatar, StatusPill } from '../components/ui'

/* ---------------- one node + its subtree ---------------- */
function Node({ e, childrenOf, collapsed, onToggle, onOpen, isHQ }) {
  const reports = childrenOf.get(e.id) || []
  const hasReports = reports.length > 0
  const isCollapsed = collapsed.has(e.id)

  return (
    <li>
      <div
        onClick={() => onOpen(e)}
        className="group relative w-[186px] bg-surface rounded-2xl border border-hairline shadow-card px-3.5 py-3 cursor-pointer hover:border-accent/40 hover:shadow-pop transition-all"
      >
        <div className="flex items-center gap-2.5">
          <Avatar name={e.name} photo={e.photo} size={38} />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold truncate group-hover:text-accent-text">
              {e.name}
            </p>
            <p className="text-[11.5px] text-ink-faint truncate">{e.designation}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-hairline text-[10.5px] text-ink-faint">
          <StatusPill status={e.status} className="scale-90 origin-left" />
          <span className="ml-auto truncate">{isHQ ? 'HQ' : e.branch}</span>
        </div>

        {/* collapse / expand toggle */}
        {hasReports && (
          <button
            onClick={(ev) => {
              ev.stopPropagation()
              onToggle(e.id)
            }}
            className={cx(
              'absolute -bottom-3 left-1/2 -translate-x-1/2 z-10 inline-flex items-center gap-1 h-6 rounded-full border px-2 text-[10.5px] font-semibold font-mono transition-colors cursor-pointer',
              isCollapsed
                ? 'bg-accent text-white border-accent'
                : 'bg-surface text-ink-soft border-hairline-strong hover:border-accent hover:text-accent',
            )}
            title={isCollapsed ? 'Expand reports' : 'Collapse reports'}
          >
            {isCollapsed ? <Plus size={11} weight="bold" /> : <Minus size={11} weight="bold" />}
            {reports.length}
          </button>
        )}
      </div>

      {hasReports && !isCollapsed && (
        <ul>
          {reports.map((r) => (
            <Node
              key={r.id}
              e={r}
              childrenOf={childrenOf}
              collapsed={collapsed}
              onToggle={onToggle}
              onOpen={onOpen}
              isHQ={false}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

/* ---------------- page ---------------- */
export default function OrgChart() {
  const { employees } = useEmployees()
  const { entity } = useEntity()
  const navigate = useNavigate()

  const roster = useMemo(
    () => employees.filter((e) => e.company === entity.id && e.status !== 'exited'),
    [employees, entity.id],
  )
  const { roots, childrenOf } = useMemo(() => buildForest(roster), [roster])
  const depth = useMemo(() => forestDepth(roots, childrenOf), [roots, childrenOf])

  const [collapsed, setCollapsed] = useState(() => new Set())

  const managerIds = useMemo(
    () => roster.filter((e) => (childrenOf.get(e.id) || []).length > 0).map((e) => e.id),
    [roster, childrenOf],
  )

  const toggle = (id) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  const collapseAll = () => setCollapsed(new Set(managerIds))
  const expandAll = () => setCollapsed(new Set())
  const open = (e) => navigate(`/people/${e.id}`)

  return (
    <div className="max-w-full mx-auto">
      {/* heading */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-[28px] font-bold tracking-tight">Org chart</h1>
          <p className="text-[13px] text-ink-faint mt-0.5">
            {entity.legalName} · {roster.length} {roster.length === 1 ? 'person' : 'people'}
            {roster.length > 0 && ` · ${depth} ${depth === 1 ? 'level' : 'levels'}`}
          </p>
        </div>

        {roster.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={expandAll}
              className="inline-flex items-center gap-1.5 h-9 rounded-[10px] border border-hairline bg-surface px-3 text-[13px] font-medium text-ink-soft hover:border-hairline-strong active:scale-[0.98] transition-all cursor-pointer"
            >
              <ArrowsOutLineVertical size={15} /> Expand all
            </button>
            <button
              onClick={collapseAll}
              className="inline-flex items-center gap-1.5 h-9 rounded-[10px] border border-hairline bg-surface px-3 text-[13px] font-medium text-ink-soft hover:border-hairline-strong active:scale-[0.98] transition-all cursor-pointer"
            >
              <ArrowsInLineVertical size={15} /> Collapse all
            </button>
          </div>
        )}
      </div>

      {/* chart */}
      {roster.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-hairline shadow-card mt-5">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <span className="grid place-items-center size-11 rounded-xl bg-accent-soft text-accent-text mb-3">
              <UsersThree size={22} />
            </span>
            <p className="font-display font-bold text-[15px] tracking-tight">No org chart yet</p>
            <p className="text-[13px] text-ink-faint mt-1 max-w-xs">
              Add employees and set who they report to. The chart builds itself.
            </p>
            <button
              onClick={() => navigate('/people/new')}
              className="mt-4 inline-flex items-center gap-1.5 h-9 rounded-[10px] bg-accent hover:bg-accent-deep active:scale-[0.98] text-white text-[13px] font-semibold px-4 transition-all cursor-pointer"
            >
              <UserPlus size={15} weight="bold" /> Add employee
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-hairline bg-surface/50 p-6 overflow-auto">
          <div className="org-tree min-w-max mx-auto w-fit">
            <ul>
              {roots.map((r) => (
                <Node
                  key={r.id}
                  e={r}
                  childrenOf={childrenOf}
                  collapsed={collapsed}
                  onToggle={toggle}
                  onOpen={open}
                  isHQ={r.branch === entity.headOffice}
                />
              ))}
            </ul>
          </div>
        </div>
      )}

      {roots.length > 1 && roster.length > 0 && (
        <p className="text-[12px] text-ink-faint mt-3 flex items-center gap-1.5">
          <CaretRight size={13} />
          {roots.length} top-level people (no manager assigned). Set a “Reports to” on a
          profile to place someone under another.
        </p>
      )}
    </div>
  )
}
