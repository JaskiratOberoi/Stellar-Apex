import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowElbowRightUp, CaretDown, Plus, UserMinus, UsersThree } from '@phosphor-icons/react'
import { useEmployees } from '../store/EmployeeStore'
import { useEntity } from '../store/EntityContext'
import { ancestorIds, buildForest, descendantIds } from '../lib/org'
import { useAuth } from '../store/AuthContext'
import { canEdit, cx } from '../lib/utils'
import { listItem } from '../lib/motion'
import { Avatar, SectionCard } from './ui'
import { useToast } from './kit'

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
  const { user } = useAuth()
  const toast = useToast()
  const editable = canEdit(user)
  const [addingReportee, setAddingReportee] = useState('')
  const [saving, setSaving] = useState(false)

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

  // Every change is saved straight away; say so, and say when it fails.
  const save = async (patch, message) => {
    setSaving(true)
    try {
      await updateEmployee(patch)
      toast.success(message)
    } catch (err) {
      toast.error(err.message || 'Could not save the reporting line')
    } finally {
      setSaving(false)
    }
  }
  const setManager = (id) =>
    save({ id: employee.id, reportsTo: id || null }, id ? `${employee.name} now reports to ${byId.get(id)?.name}` : 'Manager removed')
  const addReportee = (id) => {
    if (id) save({ id, reportsTo: employee.id }, `${byId.get(id)?.name} now reports to ${employee.name}`)
    setAddingReportee('')
  }
  const removeReportee = (id) => save({ id, reportsTo: null }, `${byId.get(id)?.name} no longer reports to ${employee.name}`)

  const selectCls =
    'w-full h-9 appearance-none rounded-[10px] border border-hairline bg-surface pl-3 pr-8 text-[13px] font-medium outline-none cursor-pointer focus:border-accent focus:ring-2 focus:ring-accent/15'

  return (
    <SectionCard title="Reporting" className="lg:col-span-1">
      {/* Reports to */}
      <div>
        <p className="flex items-center gap-1.5 text-[11.5px] uppercase tracking-[0.1em] text-ink-faint font-semibold mb-2">
          <ArrowElbowRightUp size={13} /> Reports to
        </p>
        <div className="relative">
          <select
            value={employee.reportsTo || ''}
            onChange={(e) => setManager(e.target.value)}
            disabled={!editable || saving}
            aria-label="Reports to"
            className={cx(selectCls, !employee.reportsTo && 'text-ink-faint', 'disabled:opacity-60 disabled:cursor-not-allowed transition-[border-color,opacity]')}
          >
            <option value="">No manager (top level)</option>
            {managerOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} · {m.designation}
              </option>
            ))}
          </select>
          <CaretDown
            size={14}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-ink-faint"
          />
        </div>
        {manager && (
          <Link
            to={`/people/${manager.id}`}
            className="flex items-center gap-2.5 mt-2 rounded-xl border border-hairline p-2 hover:border-accent/40 transition-colors"
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
          <UsersThree size={13} /> Manages
          <span className="text-ink-faint/70 normal-case tracking-normal">· {reports.length}</span>
        </p>

        {reports.length > 0 ? (
          <div className="space-y-1.5">
            <AnimatePresence initial={false} mode="popLayout">
            {reports.map((r) => (
              <motion.div
                key={r.id}
                layout
                {...listItem}
                className="group flex items-center gap-2.5 rounded-xl border border-hairline p-2"
              >
                <Link to={`/people/${r.id}`} className="flex items-center gap-2.5 min-w-0 flex-1">
                  <Avatar name={r.name} size={28} />
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-medium truncate hover:text-accent-text">
                      {r.name}
                    </p>
                    <p className="text-[11px] text-ink-faint truncate">{r.designation}</p>
                  </div>
                </Link>
                {editable && (
                  <button
                    onClick={() => removeReportee(r.id)}
                    disabled={saving}
                    className="p-1.5 rounded-lg text-ink-faint hover:text-rose-ink hover:bg-rose-soft active:scale-90 transition-[color,background-color,transform] cursor-pointer shrink-0 disabled:opacity-50"
                    title="Remove as report"
                    aria-label={`Remove ${r.name} as a report`}
                  >
                    <UserMinus size={14} />
                  </button>
                )}
              </motion.div>
            ))}
            </AnimatePresence>
          </div>
        ) : (
          <p className="text-[12.5px] text-ink-faint">No direct reports.</p>
        )}

        {/* Add reportee */}
        {editable && reporteeOptions.length > 0 && (
          <div className="relative mt-2">
            <select
              value={addingReportee}
              onChange={(e) => addReportee(e.target.value)}
              disabled={saving}
              aria-label="Add a report"
              className={cx(selectCls, 'text-ink-faint pl-8 disabled:opacity-60')}
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
              className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-accent"
            />
            <CaretDown
              size={14}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-ink-faint"
            />
          </div>
        )}
      </div>
    </SectionCard>
  )
}
