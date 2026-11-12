import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowsInLineVertical,
  ArrowsOutLineVertical,
  Buildings,
  CaretRight,
  Certificate,
  MapPin,
  Minus,
  PencilSimple,
  Plus,
  Trash,
  TreeStructure,
  UserPlus,
  UsersThree,
} from '@phosphor-icons/react'
import { useEmployees } from '../store/EmployeeStore'
import { useEntity } from '../store/EntityContext'
import { useAuth } from '../store/AuthContext'
import { BRANCH_TYPES, useReference } from '../store/ReferenceStore'
import { buildForest, descendantIds, forestDepth } from '../lib/org'
import { cx, isAdmin } from '../lib/utils'
import { DUR, EASE_IN, EASE_OUT, fadeUp, item, stagger } from '../lib/motion'
import { Avatar, EmptyState, StatusPill } from '../components/ui'
import { Button, ConfirmDialog, Dialog, Field, Select, SkeletonRows, Tabs, TextInput, Toggle, useToast } from '../components/kit'

/* ================= Reporting tree ================= */
function Node({ e, childrenOf, collapsed, onToggle, onOpen, headOffice }) {
  const reports = childrenOf.get(e.id) || []
  const hasReports = reports.length > 0
  const isCollapsed = collapsed.has(e.id)
  const teamSize = useMemo(() => descendantIds(e.id, childrenOf).size, [e.id, childrenOf])

  return (
    <li>
      <div
        role="link"
        tabIndex={0}
        onClick={() => onOpen(e)}
        onKeyDown={(ev) => ev.key === 'Enter' && onOpen(e)}
        className="group relative w-[186px] bg-surface rounded-2xl border border-hairline shadow-card px-3.5 py-3 cursor-pointer hover:border-accent/40 hover:shadow-pop hover:-translate-y-0.5 transition-[border-color,box-shadow,transform] duration-[var(--dur-base)]"
      >
        <div className="flex items-center gap-2.5">
          <Avatar name={e.name} photo={e.photo} size={38} />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold truncate group-hover:text-accent-text transition-colors">{e.name}</p>
            <p className="text-[11.5px] text-ink-faint truncate">{e.designation}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-hairline text-[10.5px] text-ink-faint">
          <StatusPill status={e.status} className="scale-90 origin-left" />
          <span className="ml-auto truncate">{e.branch === headOffice ? 'HQ' : e.branch}</span>
        </div>

        {hasReports && (
          <button
            onClick={(ev) => {
              ev.stopPropagation()
              onToggle(e.id)
            }}
            aria-expanded={!isCollapsed}
            className={cx(
              'absolute -bottom-3 left-1/2 -translate-x-1/2 z-10 inline-flex items-center gap-1 h-6 rounded-full border px-2 text-[10.5px] font-semibold font-mono cursor-pointer',
              'transition-[background-color,border-color,color,transform] duration-[var(--dur-fast)] active:scale-95',
              isCollapsed
                ? 'bg-accent text-white border-accent'
                : 'bg-surface text-ink-soft border-hairline-strong hover:border-accent hover:text-accent',
            )}
            title={isCollapsed ? `Show team of ${teamSize}` : 'Hide team'}
          >
            {isCollapsed ? <Plus size={11} weight="bold" /> : <Minus size={11} weight="bold" />}
            {teamSize}
          </button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {hasReports && !isCollapsed && (
          <motion.ul
            key="reports"
            style={{ transformOrigin: 'top center' }}
            initial={{ opacity: 0, scaleY: 0.85, y: -8 }}
            animate={{ opacity: 1, scaleY: 1, y: 0, transition: { duration: DUR.base, ease: EASE_OUT } }}
            exit={{ opacity: 0, scaleY: 0.9, y: -6, transition: { duration: DUR.fast, ease: EASE_IN } }}
          >
            {reports.map((r) => (
              <Node key={r.id} e={r} childrenOf={childrenOf} collapsed={collapsed} onToggle={onToggle} onOpen={onOpen} headOffice={headOffice} />
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </li>
  )
}

function ReportingTree({ roster, loading }) {
  const navigate = useNavigate()
  const { headOffice } = useReference()
  const { roots, childrenOf } = useMemo(() => buildForest(roster), [roster])
  const [collapsed, setCollapsed] = useState(() => new Set())
  const managerIds = useMemo(
    () => roster.filter((e) => (childrenOf.get(e.id) || []).length > 0).map((e) => e.id),
    [roster, childrenOf],
  )
  const toggle = (id) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  if (loading && roster.length === 0) {
    return (
      <div className="rounded-2xl border border-hairline bg-surface p-6">
        <SkeletonRows rows={4} />
      </div>
    )
  }

  if (roster.length === 0) {
    return (
      <div className="bg-surface rounded-2xl border border-hairline shadow-card">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <span className="grid place-items-center size-11 rounded-xl bg-accent-soft text-accent-text mb-3">
            <UsersThree size={22} />
          </span>
          <p className="font-display font-bold text-[15px] tracking-tight">No org chart yet</p>
          <p className="text-[13px] text-ink-faint mt-1 max-w-xs">
            Add employees and set who they report to. The chart builds itself.
          </p>
          <Button className="mt-4" icon={UserPlus} onClick={() => navigate('/people/new')}>
            Add employee
          </Button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center justify-end gap-2 mb-3">
        <Button variant="secondary" icon={ArrowsOutLineVertical} onClick={() => setCollapsed(new Set())}>
          Expand all
        </Button>
        <Button variant="secondary" icon={ArrowsInLineVertical} onClick={() => setCollapsed(new Set(managerIds))}>
          Collapse all
        </Button>
      </div>
      <div className="rounded-2xl border border-hairline bg-surface/50 p-6 overflow-auto">
        <div className="org-tree min-w-max mx-auto w-fit">
          <ul>
            {roots.map((r) => (
              <Node
                key={r.id}
                e={r}
                childrenOf={childrenOf}
                collapsed={collapsed}
                onToggle={toggle}
                onOpen={(e) => navigate(`/people/${e.id}`)}
                headOffice={headOffice}
              />
            ))}
          </ul>
        </div>
      </div>
      {roots.length > 1 && (
        <p className="text-[12px] text-ink-faint mt-3 flex items-center gap-1.5">
          <CaretRight size={13} />
          {roots.length} people have no manager set. Set “Reports to” on a profile to place someone under another.
        </p>
      )}
    </>
  )
}

/* ================= Master editor (department / branch / designation) ================= */
const KIND = {
  departments: { one: 'department', field: 'department' },
  branches: { one: 'branch', field: 'branch' },
  designations: { one: 'designation', field: 'designation' },
}

function MasterDialog({ open, kind, record, roster, onClose }) {
  const ref = useReference()
  const toast = useToast()
  const isNew = !record?.id
  const [f, setF] = useState(() => ({
    name: record?.name ?? '',
    isActive: record?.isActive ?? true,
    headId: record?.headId ?? '',
    type: record?.type ?? 'branch',
    city: record?.city ?? '',
    state: record?.state ?? '',
    managerId: record?.managerId ?? '',
    level: record?.level ?? 5,
  }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e?.target ? e.target.value : e }))
  const label = KIND[kind].one
  const people = useMemo(() => [...roster].sort((a, b) => a.name.localeCompare(b.name)), [roster])

  const save = async (ev) => {
    ev.preventDefault()
    setBusy(true)
    setError(null)
    const body = { name: f.name.trim(), isActive: f.isActive }
    if (kind === 'departments') body.headId = f.headId || null
    if (kind === 'designations') body.level = Number(f.level) || 5
    if (kind === 'branches') Object.assign(body, { type: f.type, city: f.city, state: f.state, managerId: f.managerId || null })
    try {
      if (isNew) await ref.createMaster(kind, body)
      else await ref.updateMaster(kind, record.id, body)
      toast.success(isNew ? `Added ${body.name}` : `Saved ${body.name}`)
      onClose(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      await ref.deleteMaster(kind, record.id)
      toast.success(`Deleted ${record.name}`)
      onClose(true)
    } catch (err) {
      setConfirmDelete(false)
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onClose={() => onClose(false)}
        title={isNew ? `Add ${label}` : `Edit ${label}`}
        description={isNew ? undefined : 'Renaming updates every employee record that uses it.'}
        footer={
          <>
            {!isNew && (
              <Button variant="danger-ghost" icon={Trash} className="mr-auto" onClick={() => setConfirmDelete(true)} disabled={busy}>
                Delete
              </Button>
            )}
            <Button variant="ghost" onClick={() => onClose(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" form="master-form" loading={busy} disabled={!f.name.trim()}>
              {isNew ? `Add ${label}` : 'Save changes'}
            </Button>
          </>
        }
      >
        <form id="master-form" onSubmit={save} className="space-y-4">
          <Field label="Name" required error={error}>
            <TextInput value={f.name} onChange={set('name')} maxLength={64} data-autofocus invalid={!!error} />
          </Field>

          {kind === 'departments' && (
            <Field label="Department head" hint="Shown on the department card and profile pages.">
              <Select value={f.headId} onChange={set('headId')}>
                <option value="">No head assigned</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.designation || p.code}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          {kind === 'designations' && (
            <Field label="Level" hint="1 is the most senior. Used to order the list.">
              <TextInput type="number" min={1} max={20} value={f.level} onChange={set('level')} className="max-w-28" />
            </Field>
          )}

          {kind === 'branches' && (
            <>
              <Field label="Type">
                <Select value={f.type} onChange={set('type')}>
                  {Object.entries(BRANCH_TYPES).map(([id, l]) => (
                    <option key={id} value={id}>
                      {l}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="City">
                  <TextInput value={f.city} onChange={set('city')} />
                </Field>
                <Field label="State" hint="Decides professional tax in payroll.">
                  <TextInput value={f.state} onChange={set('state')} />
                </Field>
              </div>
              <Field label="Branch manager">
                <Select value={f.managerId} onChange={set('managerId')}>
                  <option value="">No manager assigned</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {p.designation || p.code}
                    </option>
                  ))}
                </Select>
              </Field>
            </>
          )}

          {!isNew && (
            <Toggle
              checked={f.isActive}
              onChange={set('isActive')}
              label="Active"
              hint="Inactive entries stay on existing records but can't be picked for new ones."
            />
          )}
        </form>
      </Dialog>
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        title={`Delete ${record?.name}?`}
        confirmLabel="Delete"
        danger
        busy={busy}
      >
        This can't be undone. It only works when no employee record uses this {label}.
      </ConfirmDialog>
    </>
  )
}

function Person({ person, fallback }) {
  if (!person) return <span className="text-[12.5px] text-ink-faint">{fallback}</span>
  return (
    <span className="inline-flex items-center gap-2 min-w-0">
      <Avatar name={person.name} photo={person.photo} size={24} />
      <span className="text-[12.5px] font-medium truncate">{person.name}</span>
    </span>
  )
}

function MasterHeader({ count, noun, plural = `${noun}s`, onAdd, admin }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <p className="text-[12.5px] text-ink-faint">
        {count} {count === 1 ? noun : plural}
      </p>
      {admin && (
        <Button icon={Plus} onClick={onAdd}>
          Add {noun}
        </Button>
      )}
    </div>
  )
}

const inactiveTag = (
  <span className="rounded-md bg-slate-soft text-ink-faint text-[10px] font-bold uppercase tracking-[0.08em] px-1.5 py-0.5">Inactive</span>
)

function Departments({ roster, byId, admin, onEdit }) {
  const { departments } = useReference()
  const members = useMemo(() => {
    const m = new Map()
    for (const e of roster) if (e.department) m.set(e.department, [...(m.get(e.department) || []), e])
    return m
  }, [roster])

  return (
    <>
      <MasterHeader count={departments.length} noun="department" admin={admin} onAdd={() => onEdit('departments', {})} />
      <motion.div variants={stagger()} initial="initial" animate="animate" className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {departments.map((d) => {
          const people = members.get(d.name) || []
          return (
            <motion.article
              key={d.id}
              variants={item}
              className={cx('bg-surface rounded-2xl border border-hairline shadow-card p-4', !d.isActive && 'opacity-70')}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-display text-[15px] font-bold tracking-tight truncate">{d.name}</h3>
                  <p className="text-[12px] text-ink-faint mt-0.5">
                    {people.length} {people.length === 1 ? 'person' : 'people'}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {!d.isActive && inactiveTag}
                  {admin && (
                    <button
                      onClick={() => onEdit('departments', d)}
                      aria-label={`Edit ${d.name}`}
                      className="p-1.5 rounded-lg text-ink-faint hover:text-accent hover:bg-accent-soft transition-colors cursor-pointer"
                    >
                      <PencilSimple size={14} />
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-hairline flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10.5px] uppercase tracking-[0.1em] text-ink-faint font-semibold mb-1">Head</p>
                  <Person person={byId.get(d.headId)} fallback="Not assigned" />
                </div>
                <div className="flex -space-x-1.5 shrink-0">
                  {people.slice(0, 4).map((p) => (
                    <Avatar key={p.id} name={p.name} photo={p.photo} size={24} className="ring-2 ring-surface" />
                  ))}
                  {people.length > 4 && (
                    <span className="grid place-items-center size-6 rounded-[7px] bg-slate-soft text-[10px] font-mono font-semibold text-ink-soft ring-2 ring-surface">
                      +{people.length - 4}
                    </span>
                  )}
                </div>
              </div>
            </motion.article>
          )
        })}
      </motion.div>
    </>
  )
}

function Branches({ roster, byId, admin, onEdit }) {
  const { branches } = useReference()
  const count = useMemo(() => {
    const m = new Map()
    for (const e of roster) if (e.branch) m.set(e.branch, (m.get(e.branch) || 0) + 1)
    return m
  }, [roster])

  return (
    <>
      <MasterHeader count={branches.length} noun="branch" plural="branches" admin={admin} onAdd={() => onEdit('branches', {})} />
      <div className="bg-surface rounded-2xl border border-hairline shadow-card overflow-x-auto">
        <table className="w-full min-w-[640px] text-left">
          <thead>
            <tr className="text-[10.5px] uppercase tracking-[0.1em] text-ink-faint border-b border-hairline">
              <th className="font-semibold px-4 py-2.5">Branch</th>
              <th className="font-semibold px-3 py-2.5">Type</th>
              <th className="font-semibold px-3 py-2.5">Location</th>
              <th className="font-semibold px-3 py-2.5">Manager</th>
              <th className="font-semibold px-3 py-2.5 text-right">People</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {branches.map((b) => (
              <tr key={b.id} className={cx('border-b border-hairline last:border-0 hover:bg-paper/60 transition-colors', !b.isActive && 'opacity-70')}>
                <td className="px-4 py-2.5">
                  <span className="text-[13.5px] font-semibold">{b.name}</span> {!b.isActive && inactiveTag}
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className={cx(
                      'rounded-md text-[11px] font-semibold px-1.5 py-0.5',
                      b.type === 'head_office' ? 'bg-accent-soft text-accent-text' : 'bg-slate-soft text-ink-soft',
                    )}
                  >
                    {BRANCH_TYPES[b.type] || b.type}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-[12.5px] text-ink-soft">
                  {[b.city, b.state].filter(Boolean).join(', ') || <span className="text-ink-faint">Not set</span>}
                </td>
                <td className="px-3 py-2.5">
                  <Person person={byId.get(b.managerId)} fallback="Not assigned" />
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[12.5px]">{count.get(b.name) || 0}</td>
                <td className="pr-3">
                  {admin && (
                    <button
                      onClick={() => onEdit('branches', b)}
                      aria-label={`Edit ${b.name}`}
                      className="p-1.5 rounded-lg text-ink-faint hover:text-accent hover:bg-accent-soft transition-colors cursor-pointer"
                    >
                      <PencilSimple size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function Designations({ roster, admin, onEdit }) {
  const { designations } = useReference()
  const count = useMemo(() => {
    const m = new Map()
    for (const e of roster) if (e.designation) m.set(e.designation, (m.get(e.designation) || 0) + 1)
    return m
  }, [roster])

  if (designations.length === 0) {
    return (
      <>
        <MasterHeader count={0} noun="designation" admin={admin} onAdd={() => onEdit('designations', {})} />
        <div className="bg-surface rounded-2xl border border-hairline shadow-card">
          <EmptyState icon={Certificate} title="No designations yet" hint="They are added automatically as you save employees, or add them here." />
        </div>
      </>
    )
  }

  return (
    <>
      <MasterHeader count={designations.length} noun="designation" admin={admin} onAdd={() => onEdit('designations', {})} />
      <div className="bg-surface rounded-2xl border border-hairline shadow-card divide-y divide-hairline">
        {designations.map((d) => (
          <div key={d.id} className={cx('flex items-center gap-3 px-4 py-2.5 hover:bg-paper/60 transition-colors', !d.isActive && 'opacity-70')}>
            <span className="grid place-items-center size-7 rounded-lg bg-slate-soft text-[11px] font-mono font-semibold text-ink-soft shrink-0" title="Level">
              L{d.level}
            </span>
            <span className="text-[13.5px] font-semibold flex-1 min-w-0 truncate">
              {d.name} {!d.isActive && inactiveTag}
            </span>
            <span className="text-[12px] text-ink-faint font-mono tabular-nums">
              {count.get(d.name) || 0} {(count.get(d.name) || 0) === 1 ? 'person' : 'people'}
            </span>
            {admin && (
              <button
                onClick={() => onEdit('designations', d)}
                aria-label={`Edit ${d.name}`}
                className="p-1.5 rounded-lg text-ink-faint hover:text-accent hover:bg-accent-soft transition-colors cursor-pointer"
              >
                <PencilSimple size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
    </>
  )
}

/* ================= Page ================= */
export default function Organisation() {
  const { employees, loading, refresh } = useEmployees()
  const { entity } = useEntity()
  const { user } = useAuth()
  const ref = useReference()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') || 'tree'
  const [editing, setEditing] = useState(null) // { kind, record, open, seq }
  const edit = (kind, record) => setEditing((prev) => ({ kind, record, open: true, seq: (prev?.seq || 0) + 1 }))
  const admin = isAdmin(user)

  const roster = useMemo(
    () => employees.filter((e) => e.company === entity.id && e.status !== 'exited'),
    [employees, entity.id],
  )
  const byId = useMemo(() => new Map(roster.map((e) => [e.id, e])), [roster])
  const depth = useMemo(() => {
    const { roots, childrenOf } = buildForest(roster)
    return forestDepth(roots, childrenOf)
  }, [roster])

  const tabs = [
    { id: 'tree', label: 'Reporting tree', icon: TreeStructure },
    { id: 'departments', label: 'Departments', icon: Buildings, count: ref.departments.length },
    { id: 'branches', label: 'Branches', icon: MapPin, count: ref.branches.length },
    { id: 'designations', label: 'Designations', icon: Certificate, count: ref.designations.length },
  ]

  return (
    <div className="max-w-full mx-auto">
      <div>
        <h1 className="font-display text-[28px] font-bold tracking-tight">Organisation</h1>
        <p className="text-[13px] text-ink-faint mt-0.5">
          {entity.legalName} · {roster.length} {roster.length === 1 ? 'person' : 'people'}
          {roster.length > 0 && ` · ${depth} reporting ${depth === 1 ? 'level' : 'levels'}`}
        </p>
      </div>

      <Tabs className="mt-4" tabs={tabs} value={tab} onChange={(id) => setParams(id === 'tree' ? {} : { tab: id }, { replace: true })} />

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={tab} {...fadeUp} className="mt-4">
          {tab === 'tree' && <ReportingTree roster={roster} loading={loading} />}
          {tab === 'departments' && <Departments roster={roster} byId={byId} admin={admin} onEdit={edit} />}
          {tab === 'branches' && <Branches roster={roster} byId={byId} admin={admin} onEdit={edit} />}
          {tab === 'designations' && <Designations roster={roster} admin={admin} onEdit={edit} />}
        </motion.div>
      </AnimatePresence>

      {editing && (
        <MasterDialog
          key={editing.seq}
          open={editing.open}
          kind={editing.kind}
          record={editing.record}
          roster={roster}
          onClose={(changed) => {
            setEditing((prev) => prev && { ...prev, open: false })
            if (changed) refresh() // a rename cascades to employee rows
          }}
        />
      )}
    </div>
  )
}
