import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, CornerRightUp, Plus, UserRoundMinus, UsersRound } from 'lucide-react'
import { useEmployees } from '../store/EmployeeStore'
import { useEntity } from '../store/EntityContext'
import { ancestorIds, buildForest, descendantIds } from '../lib/org'
import { cx } from '../lib/utils'
import { Avatar, SectionCard } from './ui'

/**
 * Editable reporting relationships for one employee:
 *  - "Reports to" — set/clear this person's manager
 *  - "Manages" — add/remove direct reports (reassigns their reportsTo)
 * Both write through the store's updateEmployee, so the directory, profile
 * org context, and org chart all update live. Options are filtered to prevent
 * cycles (can't report to your own descendant; can't manage your own ancestor).
 */
export default function OrgRelations({ employee }) {
  const { employees, updateEmployee } = useEmployees()
  const { entity } = useEntity()
  const [addingReportee, setAddingReportee] = useState('')

  const roster = useMemo(
    () => employees.filter((e) => e.company === entity.id),
    [employees, entity.id],
  )
  const { childrenOf, byId } = useMemo(() => buildForest(roster), [roster])

  const manager = employee.reportsTo ? byId.get(employee.reportsTo) : null
  const reports = childrenOf.get(employee.id) || []

  const desc = useMemo(() => descendantIds(employee.id, childrenOf), [employee.id, childrenOf])
  const anc = useMemo(() => ancestorIds(employee.id, byId), [employee.id, byId])

  // Valid managers: anyone in the entity except self and this person's descendants.
  const managerOptions = useMemo(
    () =>
      roster
        .filter((e) => e.id !== employee.id && !desc.has(e.id))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [roster, employee.id, desc],
  )

  // Valid new reportees: not self, not already a direct report, not an ancestor.
  const reporteeOptions = useMemo(
    () =>
      roster
        .filter((e) => e.id !== employee.id && e.reportsTo !== employee.id && !anc.has(e.id))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [roster, employee.id, anc],
  )

  const setManager = (id) => updateEmployee({ id: employee.id, reportsTo: id || null })
  const addReportee = (id) => {
    if (id) updateEmployee({ id, reportsTo: employee.id })
    setAddingReportee('')
  }
  const removeReportee = (id) => updateEmployee({ id, reportsTo: null })

  const selectCls =
    'w-full h-9 appearance-none rounded-xl border border-hairline bg-surface pl-3 pr-8 text-[13px] font-medium outline-none cursor-pointer focus:border-iris focus:ring-2 focus:ring-iris/15'

  return (
    <SectionCard title="Reporting" className="lg:col-span-1">
      {/* Reports to */}
      <div>
        <p className="flex items-center gap-1.5 text-[11.5px] uppercase tracking-[0.1em] text-ink-faint font-semibold mb-2">
          <CornerRightUp size={13} /> Reports to
        </p>
        <div className="relative">
          <select
            value={employee.reportsTo || ''}
            onChange={(e) => setManager(e.target.value)}
            className={cx(selectCls, !employee.reportsTo && 'text-ink-faint')}
          >
            <option value="">— No manager (top level) —</option>
            {managerOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} · {m.designation}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-ink-faint"
          />
        </div>
        {manager && (
          <Link
            to={`/people/${manager.id}`}
            className="flex items-center gap-2.5 mt-2 rounded-xl border border-hairline p-2 hover:border-iris/40 transition-colors"
          >
            <Avatar name={manager.name} size={30} />
            <div className="min-w-0">
              <p className="text-[12.5px] font-semibold truncate">{manager.name}</p>
              <p className="text-[11px] text-ink-faint truncate">{manager.designation}</p>
            </div>
          </Link>
        )}
      </div>

      {/* Manages (reportees) */}
      <div className="mt-5">
        <p className="flex items-center gap-1.5 text-[11.5px] uppercase tracking-[0.1em] text-ink-faint font-semibold mb-2">
          <UsersRound size={13} /> Manages
          <span className="text-ink-faint/70 normal-case tracking-normal">· {reports.length}</span>
        </p>

        {reports.length > 0 ? (
          <div className="space-y-1.5">
            {reports.map((r) => (
              <div
                key={r.id}
                className="group flex items-center gap-2.5 rounded-xl border border-hairline p-2"
              >
                <Link to={`/people/${r.id}`} className="flex items-center gap-2.5 min-w-0 flex-1">
                  <Avatar name={r.name} size={28} />
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-medium truncate hover:text-iris-text">
                      {r.name}
                    </p>
                    <p className="text-[11px] text-ink-faint truncate">{r.designation}</p>
                  </div>
                </Link>
                <button
                  onClick={() => removeReportee(r.id)}
                  className="p-1.5 rounded-lg text-ink-faint hover:text-rose-ink hover:bg-rose-soft transition-colors cursor-pointer shrink-0"
                  title="Remove as report"
                >
                  <UserRoundMinus size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[12.5px] text-ink-faint">No direct reports.</p>
        )}

        {/* Add reportee */}
        {reporteeOptions.length > 0 && (
          <div className="relative mt-2">
            <select
              value={addingReportee}
              onChange={(e) => addReportee(e.target.value)}
              className={cx(selectCls, 'text-ink-faint pl-8')}
            >
              <option value="">Add a report…</option>
              {reporteeOptions.map((r) => (
                <option key={r.id} value={r.id} className="text-ink">
                  {r.name} · {r.designation}
                </option>
              ))}
            </select>
            <Plus
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-iris"
            />
            <ChevronDown
              size={14}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-ink-faint"
            />
          </div>
        )}
      </div>
    </SectionCard>
  )
}
