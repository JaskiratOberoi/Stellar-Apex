import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowsClockwise,
  CalendarCheck,
  CalendarStar,
  CheckCircle,
  CircleNotch,
  DownloadSimple,
  Eraser,
  FileXls,
  Lock,
  LockOpen,
  MagnifyingGlass,
  Trash,
  UploadSimple,
  Warning,
} from '@phosphor-icons/react'
import { apiFetch } from '../lib/api'
import { cx, currentMonth, dayISO, daysInMonth, fmtDate, fmtStamp, isAdmin, canEdit, monthLabel } from '../lib/utils'
import { fadeUp, pop } from '../lib/motion'
import { downloadWorkbook, readSheet } from '../lib/sheets'
import { useEntity } from '../store/EntityContext'
import { useAuth } from '../store/AuthContext'
import { useReference } from '../store/ReferenceStore'
import { Avatar, EmptyState, SectionCard } from '../components/ui'
import { Stat } from '../components/charts'
import {
  AnimatedNumber,
  Banner,
  Button,
  ConfirmDialog,
  Dialog,
  Field,
  MonthPicker,
  Select,
  SkeletonRows,
  TextInput,
  useToast,
} from '../components/kit'

/* ------------------------------------------------------------------
 * Monthly attendance register.
 * Pick a status, then click or drag across days to mark them. Changes
 * save in the background. Unmarked days fall back to the holiday list
 * and the weekly off; anything else must be filled before locking.
 *   paid days = P + PL + WO + H + ½·HD      LOP = A + UL + ½·HD
 * ------------------------------------------------------------------ */

const STATUS = {
  P: { label: 'Present', key: 'P', cell: 'bg-mint-soft text-mint' },
  A: { label: 'Absent', key: 'A', cell: 'bg-rose-soft text-rose-ink' },
  HD: { label: 'Half day', key: 'D', cell: 'bg-amber-soft text-amber-ink' },
  PL: { label: 'Paid leave', key: 'L', cell: 'bg-accent-soft text-accent-text' },
  UL: { label: 'Unpaid leave', key: 'U', cell: 'bg-rose-soft text-rose-ink ring-1 ring-inset ring-rose-ink/30' },
  WO: { label: 'Week off', key: 'W', cell: 'bg-slate-soft text-ink-faint' },
  H: { label: 'Holiday', key: 'H', cell: 'bg-slate-soft text-ink-soft ring-1 ring-inset ring-hairline-strong' },
}
const CODES = Object.keys(STATUS)
const KEY_TO_CODE = Object.fromEntries(CODES.map((c) => [STATUS[c].key, c]))
// Click order in "Cycle" mode: blank, then every status, then blank again.
const CYCLE = [null, ...CODES]
const nextInCycle = (status) => CYCLE[(CYCLE.indexOf(status ?? null) + 1) % CYCLE.length]
const WEEKDAY = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

// Loose spellings accepted on import.
const IMPORT_ALIASES = {
  P: 'P', PRESENT: 'P', A: 'A', ABSENT: 'A', AB: 'A',
  HD: 'HD', 'H/D': 'HD', HALF: 'HD', 'HALF DAY': 'HD', '0.5': 'HD',
  PL: 'PL', L: 'PL', CL: 'PL', SL: 'PL', EL: 'PL', LEAVE: 'PL',
  UL: 'UL', LOP: 'UL', LWP: 'UL',
  WO: 'WO', W: 'WO', OFF: 'WO', 'W/O': 'WO', 'WEEK OFF': 'WO',
  H: 'H', HOL: 'H', HOLIDAY: 'H', PH: 'H',
}

const inRange = (emp, date) => (!emp.joiningDate || date >= emp.joiningDate) && (!emp.endDate || date <= emp.endDate)

function rowTotals(emp, marks, days) {
  const t = { paid: 0, lop: 0, unmarked: 0 }
  for (const d of days) {
    if (!inRange(emp, d.date)) continue
    const s = marks?.[d.date] ?? d.fallback
    if (!s) t.unmarked++
    else if (s === 'HD') {
      t.paid += 0.5
      t.lop += 0.5
    } else if (s === 'A' || s === 'UL') t.lop++
    else t.paid++
  }
  return t
}

/* ---------------- one employee row ---------------- */
const ROW_MARK = 'grid place-items-center size-[20px] rounded-[5px] text-[9.5px] font-mono font-bold cursor-pointer transition-[transform,box-shadow] duration-[var(--dur-fast)] hover:ring-1 hover:ring-inset hover:ring-current active:scale-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent'

const Row = memo(function Row({ emp, marks, days, activeDay, rowIndex, onMarkMonth }) {
  const totals = useMemo(() => rowTotals(emp, marks, days), [emp, marks, days])
  return (
    <tr className="group">
      <th scope="row" className="sticky left-0 z-10 bg-surface group-hover:bg-paper transition-colors text-left font-normal px-3 py-1 border-b border-hairline">
        <div className={cx('flex items-center gap-2.5', onMarkMonth ? 'w-[132px] sm:w-[224px]' : 'w-[104px] sm:w-[188px]')}>
          <Avatar name={emp.name} size={26} className="hidden sm:grid" />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="text-[12.5px] font-semibold truncate">{emp.name}</p>
            <p className="text-[10.5px] text-ink-faint font-mono truncate">{emp.code}</p>
          </div>
          {onMarkMonth && (
            <div className="flex items-center gap-1 shrink-0">
              <button type="button" onClick={() => onMarkMonth(emp, 'P')} title={`Mark ${emp.name} present for the whole month`} aria-label={`Mark ${emp.name} present for the whole month`} className={cx(ROW_MARK, STATUS.P.cell)}>
                P
              </button>
              <button type="button" onClick={() => onMarkMonth(emp, 'A')} title={`Mark ${emp.name} absent for the whole month`} aria-label={`Mark ${emp.name} absent for the whole month`} className={cx(ROW_MARK, STATUS.A.cell)}>
                A
              </button>
            </div>
          )}
        </div>
      </th>
      {days.map((d) => {
        const ok = inRange(emp, d.date)
        const stored = marks?.[d.date]
        const s = ok ? stored ?? d.fallback : null
        const active = activeDay === d.day
        return (
          <td key={d.day} className={cx('p-[2px] border-b border-hairline', d.off && 'bg-paper/70')}>
            {ok ? (
              <div
                data-r={rowIndex}
                data-d={d.day}
                title={`${emp.name} · ${d.day} ${s ? '· ' + STATUS[s].label : '· not marked'}`}
                className={cx(
                  'att-cell grid place-items-center size-[26px] rounded-[6px] text-[10px] font-bold font-mono select-none',
                  s ? STATUS[s].cell : 'border border-dashed border-hairline-strong text-transparent',
                  s && !stored && 'opacity-60',
                  active && 'outline outline-2 outline-accent outline-offset-1',
                )}
              >
                {s || '·'}
              </div>
            ) : (
              <div className="size-[26px] rounded-[6px] bg-[repeating-linear-gradient(135deg,transparent_0_3px,var(--color-hairline)_3px_4px)]" title="Not employed on this day" />
            )}
          </td>
        )
      })}
      <td className="sm:sticky right-0 z-10 bg-surface group-hover:bg-paper transition-colors border-b border-l border-hairline px-3 py-1">
        <div className="flex items-center gap-3 justify-end font-mono tabular-nums text-[12px] w-[112px]">
          <span className="font-semibold" title="Paid days">{totals.paid}</span>
          <span className={cx('w-7 text-right', totals.lop ? 'text-rose-ink font-semibold' : 'text-ink-faint')} title="Loss-of-pay days">
            {totals.lop}
          </span>
          <span className={cx('w-6 text-right', totals.unmarked ? 'text-amber-ink font-semibold' : 'text-ink-faint')} title="Unmarked days">
            {totals.unmarked}
          </span>
        </div>
      </td>
    </tr>
  )
})

/* ---------------- holidays ---------------- */
function HolidayDialog({ open, onClose, month, holidays, locked, editable, onChanged }) {
  const { entity } = useEntity()
  const toast = useToast()
  const [date, setDate] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const dim = daysInMonth(month)

  const add = async (ev) => {
    ev.preventDefault()
    setBusy(true)
    try {
      await apiFetch('/holidays', { method: 'POST', body: { date, name }, entity: entity.id })
      setDate('')
      setName('')
      toast.success('Holiday added')
      onChanged()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }
  const remove = async (h) => {
    try {
      await apiFetch(`/holidays/${h.id}`, { method: 'DELETE', entity: entity.id })
      toast.success(`Removed ${h.name}`)
      onChanged()
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={`Holidays in ${monthLabel(month)}`} description="A holiday counts as a paid day for everyone unless a day is marked otherwise.">
      {holidays.length === 0 ? (
        <p className="text-[13px] text-ink-faint py-3">No holidays this month.</p>
      ) : (
        <ul className="divide-y divide-hairline mb-2">
          <AnimatePresence initial={false}>
            {holidays.map((h) => (
              <motion.li key={h.id} layout {...pop} className="flex items-center gap-3 py-2">
                <span className="grid place-items-center size-8 rounded-lg bg-accent-soft text-accent-text text-[12px] font-mono font-bold">{h.date.slice(8)}</span>
                <span className="flex-1 text-[13.5px] font-medium">{h.name}</span>
                <span className="text-[12px] text-ink-faint">{fmtDate(h.date)}</span>
                {editable && !locked && (
                  <button onClick={() => remove(h)} aria-label={`Remove ${h.name}`} className="p-1.5 rounded-lg text-ink-faint hover:text-rose-ink hover:bg-rose-soft transition-colors cursor-pointer">
                    <Trash size={14} />
                  </button>
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
      {editable && !locked && (
        <form onSubmit={add} className="grid grid-cols-[130px_1fr_auto] gap-2 items-end pt-3 border-t border-hairline">
          <Field label="Date">
            <TextInput type="date" required min={dayISO(month, 1)} max={dayISO(month, dim)} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Holiday">
            <TextInput required maxLength={96} placeholder="e.g. Diwali" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Button type="submit" loading={busy} className="h-10">
            Add
          </Button>
        </form>
      )}
    </Dialog>
  )
}

/* ---------------- Excel import ---------------- */
function ImportDialog({ open, onClose, month, employees, onApply }) {
  const toast = useToast()
  const [parsed, setParsed] = useState(null) // { cells, rows, errors, fileName }
  const [busy, setBusy] = useState(false)
  const dim = daysInMonth(month)

  useEffect(() => {
    if (!open) setParsed(null)
  }, [open])

  const template = () =>
    downloadWorkbook(`attendance-template-${month}.xlsx`, [
      {
        name: 'Attendance',
        freeze: 2,
        columns: [
          { header: 'Code', key: 'code', width: 12 },
          { header: 'Name', key: 'name', width: 28 },
          ...Array.from({ length: dim }, (_, i) => ({ header: String(i + 1), key: `d${i + 1}`, width: 5, align: 'center' })),
        ],
        rows: employees.map((e) => ({ code: e.code, name: e.name })),
      },
    ])

  const onFile = async (file) => {
    if (!file) return
    setBusy(true)
    try {
      const rows = await readSheet(file)
      const headIdx = rows.findIndex((r) => r.some((c) => /^(emp(loyee)?\s*)?code$/i.test(c)))
      if (headIdx < 0) throw new Error('No "Code" column found. Use the template so the columns match.')
      const head = rows[headIdx]
      const codeCol = head.findIndex((c) => /^(emp(loyee)?\s*)?code$/i.test(c))
      const dayCols = head.map((c, i) => (/^\d{1,2}$/.test(c) && +c >= 1 && +c <= dim ? [i, +c] : null)).filter(Boolean)
      if (!dayCols.length) throw new Error('No day columns (1, 2, 3 …) found in the header row.')
      const byCode = new Map(employees.map((e) => [e.code.toUpperCase(), e]))
      const cells = []
      const errors = []
      let matched = 0
      rows.slice(headIdx + 1).forEach((r, n) => {
        const code = (r[codeCol] || '').toUpperCase()
        if (!code) return
        const emp = byCode.get(code)
        if (!emp) {
          errors.push(`Row ${headIdx + n + 2}: employee code ${code} is not in this month's roster`)
          return
        }
        matched++
        for (const [col, day] of dayCols) {
          const raw = (r[col] || '').toUpperCase()
          if (!raw) continue
          const status = IMPORT_ALIASES[raw]
          const date = dayISO(month, day)
          if (!status) errors.push(`${emp.code} day ${day}: "${r[col]}" is not a status`)
          else if (!inRange(emp, date)) errors.push(`${emp.code} day ${day}: outside employment dates`)
          else cells.push({ employeeId: emp.id, date, status })
        }
      })
      setParsed({ cells, rows: matched, errors, fileName: file.name })
    } catch (err) {
      toast.error(err.message || 'Could not read that file')
    } finally {
      setBusy(false)
    }
  }

  const apply = async () => {
    setBusy(true)
    try {
      await onApply(parsed.cells)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Import ${monthLabel(month)} attendance`}
      description="One row per employee, one column per day. Imported days replace what is marked now."
      footer={
        parsed && (
          <>
            <Button variant="ghost" onClick={() => setParsed(null)} disabled={busy}>
              Choose another file
            </Button>
            <Button onClick={apply} loading={busy} disabled={!parsed.cells.length}>
              Import {parsed.cells.length.toLocaleString('en-IN')} days
            </Button>
          </>
        )
      }
    >
      {!parsed ? (
        <div className="space-y-3">
          <label className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-hairline-strong bg-paper/60 px-4 py-9 text-center cursor-pointer hover:border-accent hover:bg-accent-soft/40 transition-colors">
            {busy ? <CircleNotch size={22} className="animate-spin text-accent" /> : <UploadSimple size={22} className="text-accent" />}
            <span className="text-[13.5px] font-semibold">Choose an Excel or CSV file</span>
            <span className="text-[12px] text-ink-faint">Statuses: P, A, HD, PL, UL, WO, H</span>
            <input type="file" accept=".xlsx,.csv" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
          <Button variant="secondary" icon={FileXls} onClick={template}>
            Download template for {monthLabel(month, true)}
          </Button>
        </div>
      ) : (
        <motion.div {...fadeUp} className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Employees" value={parsed.rows} />
            <Stat label="Days to import" value={parsed.cells.length.toLocaleString('en-IN')} />
            <Stat label="Skipped" value={parsed.errors.length} />
          </div>
          <p className="text-[12px] text-ink-faint font-mono truncate">{parsed.fileName}</p>
          {parsed.errors.length > 0 && (
            <Banner tone="amber" icon={Warning}>
              <p className="font-semibold mb-1">These entries will be skipped</p>
              <ul className="max-h-36 overflow-y-auto space-y-0.5 font-mono text-[11.5px]">
                {parsed.errors.slice(0, 60).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
                {parsed.errors.length > 60 && <li>… and {parsed.errors.length - 60} more</li>}
              </ul>
            </Banner>
          )}
        </motion.div>
      )}
    </Dialog>
  )
}

/* ---------------- page ---------------- */
export default function Attendance() {
  const { entity } = useEntity()
  const { user } = useAuth()
  const ref = useReference()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const month = /^\d{4}-\d{2}$/.test(params.get('month') || '') ? params.get('month') : currentMonth()
  const setMonth = (m) => setParams({ month: m }, { replace: true })

  const [data, setData] = useState(null)
  const [marks, setMarks] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [brush, setBrush] = useState('CYCLE') // 'CYCLE' | a status code | 'CLEAR'
  const [markAll, setMarkAll] = useState(null) // { status: 'P' | 'A', emp?: one person } while its confirmation is open
  const [branch, setBranch] = useState('')
  const [department, setDepartment] = useState('')
  const [q, setQ] = useState('')
  const [active, setActive] = useState(null) // { r, d }
  const [saveState, setSaveState] = useState('idle') // idle | saving | saved | error
  const [dialog, setDialog] = useState(null) // 'holidays' | 'import' | 'lock' | 'unlock'
  const [busy, setBusy] = useState(false)

  const queue = useRef(new Map())
  const timer = useRef(null)
  const painting = useRef(false)
  const dragStatus = useRef(null) // what a drag paints; set by the cell the drag started on
  const gridRef = useRef(null)

  const editable = canEdit(user)
  const locked = data?.status === 'locked'
  const writable = editable && !locked && !!data

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch(`/attendance?month=${month}`, { entity: entity.id })
      setData(res)
      setMarks(res.marks || {})
    } catch (err) {
      setError(err.message)
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [month, entity.id])

  useEffect(() => {
    queue.current.clear()
    setActive(null)
    load()
  }, [load])

  /* ---- derived ---- */
  const days = useMemo(() => {
    if (!data) return []
    const holidays = new Map(data.holidays.map((h) => [h.date, h.name]))
    return Array.from({ length: daysInMonth(month) }, (_, i) => {
      const day = i + 1
      const date = dayISO(month, day)
      const dow = new Date(date + 'T00:00:00').getDay()
      const holiday = holidays.get(date)
      const weeklyOff = data.weeklyOff.includes(dow)
      return { day, date, dow, holiday, off: !!holiday || weeklyOff, fallback: holiday ? 'H' : weeklyOff ? 'WO' : null }
    })
  }, [data, month])

  const employees = useMemo(() => {
    if (!data) return []
    const needle = q.trim().toLowerCase()
    return data.employees.filter(
      (e) =>
        (!branch || e.branch === branch) &&
        (!department || e.department === department) &&
        (!needle || e.name.toLowerCase().includes(needle) || e.code.toLowerCase().includes(needle)),
    )
  }, [data, branch, department, q])

  const summary = useMemo(() => {
    const s = { people: data?.employees.length ?? 0, paid: 0, lop: 0, unmarked: 0, payable: 0 }
    for (const e of data?.employees ?? []) {
      const t = rowTotals(e, marks[e.id], days)
      s.paid += t.paid
      s.lop += t.lop
      s.unmarked += t.unmarked
      s.payable += t.paid + t.lop + t.unmarked
    }
    return s
  }, [data, marks, days])

  /* ---- saving ---- */
  const flush = useCallback(async () => {
    if (!queue.current.size) return
    const cells = [...queue.current.entries()].map(([k, status]) => {
      const [employeeId, date] = k.split('|')
      return { employeeId, date, status }
    })
    queue.current.clear()
    setSaveState('saving')
    try {
      await apiFetch('/attendance', { method: 'PUT', body: { month, cells }, entity: entity.id })
      setSaveState(queue.current.size ? 'saving' : 'saved')
    } catch (err) {
      setSaveState('error')
      toast.error(`Could not save: ${err.message}`)
      load()
    }
  }, [month, entity.id, toast, load])

  // Flush pending marks when leaving the month or the page.
  useEffect(() => () => {
    clearTimeout(timer.current)
    flush()
  }, [flush])

  const applyCells = useCallback(
    (list) => {
      if (!list.length) return
      setMarks((prev) => {
        const next = { ...prev }
        for (const { employeeId, date, status } of list) {
          const row = { ...(next[employeeId] || {}) }
          if (status) row[date] = status
          else delete row[date]
          next[employeeId] = row
          queue.current.set(`${employeeId}|${date}`, status)
        }
        return next
      })
      setSaveState('saving')
      clearTimeout(timer.current)
      timer.current = setTimeout(flush, 600)
    },
    [flush],
  )

  const paint = useCallback(
    (r, d, status) => {
      const emp = employees[r]
      if (!emp || !writable) return
      const date = dayISO(month, d)
      if (!inRange(emp, date)) return
      if ((marks[emp.id]?.[date] ?? null) === status) return
      applyCells([{ employeeId: emp.id, date, status }])
    },
    [employees, writable, month, marks, applyCells],
  )

  /* ---- pointer: click or drag to paint (delegated on the grid) ---- */
  const cellFrom = (target) => {
    const el = target.closest?.('.att-cell')
    return el ? { el, r: +el.dataset.r, d: +el.dataset.d } : null
  }
  const press = (el) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    el.animate([{ transform: 'scale(0.78)' }, { transform: 'scale(1)' }], { duration: 160, easing: 'cubic-bezier(0.16,1,0.3,1)' })
  }
  const onPointerDown = (e) => {
    const c = cellFrom(e.target)
    if (!c) return
    setActive({ r: c.r, d: c.d })
    if (!writable) return
    painting.current = true
    press(c.el)
    // Cycle mode: each click moves the cell to its next state, and dragging on
    // from there spreads that state. Otherwise the chosen status is painted.
    const emp = employees[c.r]
    const current = emp ? marks[emp.id]?.[dayISO(month, c.d)] ?? null : null
    dragStatus.current = brush === 'CYCLE' ? nextInCycle(current) : brush === 'CLEAR' ? null : brush
    paint(c.r, c.d, dragStatus.current)
  }
  const onPointerOver = (e) => {
    if (!painting.current) return
    const c = cellFrom(e.target)
    if (!c) return
    press(c.el)
    paint(c.r, c.d, dragStatus.current)
  }
  useEffect(() => {
    const up = () => (painting.current = false)
    window.addEventListener('pointerup', up)
    return () => window.removeEventListener('pointerup', up)
  }, [])

  /* ---- keyboard: arrows move, letters mark ---- */
  const onKeyDown = (e) => {
    if (!active || e.metaKey || e.ctrlKey || e.altKey) return
    const move = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[e.key]
    if (move) {
      e.preventDefault()
      const r = Math.max(0, Math.min(employees.length - 1, active.r + move[0]))
      const d = Math.max(1, Math.min(days.length, active.d + move[1]))
      setActive({ r, d })
      gridRef.current?.querySelector(`.att-cell[data-r="${r}"][data-d="${d}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      return
    }
    const code = KEY_TO_CODE[e.key.toUpperCase()]
    if (code || e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault()
      paint(active.r, active.d, code || null)
      if (code && active.d < days.length) setActive({ r: active.r, d: active.d + 1 })
    }
  }

  /* ---- bulk actions ---- */
  const fillDay = (d) => {
    if (!writable || d.off) return
    const list = employees
      .filter((e) => inRange(e, d.date) && !marks[e.id]?.[d.date])
      .map((e) => ({ employeeId: e.id, date: d.date, status: brush === 'CLEAR' || brush === 'CYCLE' ? 'P' : brush }))
    applyCells(list)
    if (list.length) toast.success(`Marked ${list.length} on the ${d.day}${['th', 'st', 'nd', 'rd'][d.day % 10 > 3 || (d.day > 10 && d.day < 14) ? 0 : d.day % 10]}`)
  }
  const fillBlanks = () => {
    const list = []
    for (const e of employees) {
      for (const d of days) {
        if (d.fallback || !inRange(e, d.date) || marks[e.id]?.[d.date]) continue
        list.push({ employeeId: e.id, date: d.date, status: 'P' })
      }
    }
    applyCells(list)
    toast.success(list.length ? `Marked ${list.length} blank days present` : 'No blank days to fill')
  }

  // Every working day (not a weekly off or holiday) for the people shown.
  const workingCells = useMemo(() => {
    const list = []
    for (const e of employees) {
      for (const d of days) {
        if (d.fallback || !inRange(e, d.date)) continue
        list.push({ employeeId: e.id, date: d.date, current: marks[e.id]?.[d.date] ?? null })
      }
    }
    return list
  }, [employees, days, marks])
  // The working days a mark-all covers: one person's, or everyone shown.
  const scopeCells = (emp) => (emp ? workingCells.filter((c) => c.employeeId === emp.id) : workingCells)
  const applyMarkAll = ({ status, emp }) => {
    const list = scopeCells(emp).filter((c) => c.current !== status).map((c) => ({ employeeId: c.employeeId, date: c.date, status }))
    applyCells(list)
    const word = STATUS[status].label.toLowerCase()
    const who = emp ? `${emp.name}: ` : ''
    toast.success(list.length ? `${who}marked ${list.length} ${list.length === 1 ? 'day' : 'days'} ${word}`.replace(/^m/, 'M') : `${who}every working day is already ${word}`.replace(/^e/, 'E'))
    setMarkAll(null)
  }
  // One person's whole month. Asks first only when it would overwrite marks.
  const markMonth = (emp, status) => {
    const req = { status, emp }
    if (scopeCells(emp).some((c) => c.current && c.current !== status)) setMarkAll(req)
    else applyMarkAll(req)
  }
  // Rows are memoised, so they get one stable callback that reads the latest state.
  const markMonthRef = useRef(markMonth)
  useEffect(() => {
    markMonthRef.current = markMonth
  })
  const onMarkMonth = useCallback((emp, status) => markMonthRef.current(emp, status), [])

  const importCells = async (cells) => {
    clearTimeout(timer.current)
    await flush()
    try {
      const res = await apiFetch('/attendance', { method: 'PUT', body: { month, cells, source: 'import' }, entity: entity.id })
      toast.success(`Imported ${res.saved} days${res.skipped ? `, skipped ${res.skipped}` : ''}`)
      await load()
    } catch (err) {
      toast.error(err.message)
      throw err
    }
  }

  const setLock = async (lock) => {
    setBusy(true)
    try {
      clearTimeout(timer.current)
      await flush()
      const res = await apiFetch(`/attendance/${lock ? 'lock' : 'unlock'}`, { method: 'POST', body: { month }, entity: entity.id })
      setData(res)
      setMarks(res.marks || {})
      toast.success(lock ? `${monthLabel(month)} locked. Ready for payroll.` : `${monthLabel(month)} unlocked`)
      setDialog(null)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const exportSheet = () =>
    downloadWorkbook(`attendance-${entity.code}-${month}.xlsx`, [
      {
        name: 'Attendance',
        title: `${entity.legalName} · Attendance register`,
        subtitle: `${monthLabel(month)}${locked ? ' · locked' : ' · open (not final)'}`,
        freeze: 2,
        columns: [
          { header: 'Code', key: 'code', width: 12 },
          { header: 'Name', key: 'name', width: 28 },
          { header: 'Branch', key: 'branch', width: 16 },
          ...days.map((d) => ({ header: String(d.day), key: `d${d.day}`, width: 5, align: 'center' })),
          { header: 'Paid days', key: 'paid', width: 10 },
          { header: 'LOP days', key: 'lop', width: 10 },
          { header: 'Unmarked', key: 'unmarked', width: 10 },
        ],
        rows: employees.map((e) => ({
          code: e.code,
          name: e.name,
          branch: e.branch,
          ...Object.fromEntries(days.map((d) => [`d${d.day}`, inRange(e, d.date) ? marks[e.id]?.[d.date] ?? d.fallback ?? '' : '-'])),
          ...rowTotals(e, marks[e.id], days),
        })),
      },
    ])

  const attendancePct = summary.payable ? Math.round(((summary.paid) / summary.payable) * 100) : 0

  return (
    <motion.div {...fadeUp} className="max-w-full mx-auto">
      {/* heading */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-[28px] font-bold tracking-tight">Attendance</h1>
          <p className="text-[13px] text-ink-faint mt-0.5">{entity.legalName} · monthly register</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <AnimatePresence mode="wait" initial={false}>
            {saveState !== 'idle' && !locked && (
              <motion.span key={saveState} {...pop} className={cx('inline-flex items-center gap-1.5 text-[12px] font-medium', saveState === 'error' ? 'text-rose-ink' : 'text-ink-faint')} role="status">
                {saveState === 'saving' && <CircleNotch size={13} className="animate-spin" />}
                {saveState === 'saved' && <CheckCircle size={14} weight="fill" className="text-mint" />}
                {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'All changes saved' : 'Not saved'}
              </motion.span>
            )}
          </AnimatePresence>
          <MonthPicker value={month} onChange={setMonth} />
        </div>
      </div>

      {/* summary */}
      <SectionCard className="mt-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4 pt-2">
          <Stat label="On the register" value={<AnimatedNumber value={summary.people} />} hint="employed this month" />
          <Stat label="Attendance" value={<><AnimatedNumber value={attendancePct} />%</>} hint="paid days of payable days" />
          <Stat label="Loss-of-pay days" value={<AnimatedNumber value={summary.lop} format={(n) => (Math.round(n * 2) / 2).toLocaleString('en-IN')} />} hint="absent, unpaid leave, half days" />
          <Stat
            label="Unmarked days"
            value={<AnimatedNumber value={summary.unmarked} />}
            hint={summary.unmarked ? 'fill these before locking' : 'nothing left to mark'}
          />
        </div>
      </SectionCard>

      {/* lock state */}
      <AnimatePresence initial={false}>
        {locked && (
          <motion.div key="locked" {...fadeUp} className="mt-3">
            <Banner
              tone="accent"
              icon={Lock}
              action={
                isAdmin(user) &&
                !data.payrollFinalised && (
                  <Button size="sm" variant="secondary" icon={LockOpen} onClick={() => setDialog('unlock')}>
                    Unlock
                  </Button>
                )
              }
            >
              <span className="font-semibold">Locked</span>
              {data.lockedAt && ` on ${fmtStamp(data.lockedAt)}`}.{' '}
              {data.payrollFinalised ? 'Payroll for this month is finalised, so the register can no longer change.' : 'Payroll can now be run from this register.'}
            </Banner>
          </motion.div>
        )}
      </AnimatePresence>

      {/* toolbar */}
      <div className="mt-4 flex items-center gap-2 flex-wrap">
        <div className="relative">
          <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find a person"
            className="h-9 w-44 rounded-[10px] border border-hairline bg-surface pl-8 pr-3 text-[13px] outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 placeholder:text-ink-faint transition-[border-color,box-shadow]"
          />
        </div>
        <Select value={branch} onChange={(e) => setBranch(e.target.value)} className="!h-9 !w-auto text-[13px]">
          <option value="">All branches</option>
          {ref.branches.map((b) => (
            <option key={b.id}>{b.name}</option>
          ))}
        </Select>
        <Select value={department} onChange={(e) => setDepartment(e.target.value)} className="!h-9 !w-auto text-[13px]">
          <option value="">All departments</option>
          {ref.departments.map((d) => (
            <option key={d.id}>{d.name}</option>
          ))}
        </Select>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <Button variant="secondary" icon={CalendarStar} onClick={() => setDialog('holidays')}>
            Holidays{data?.holidays.length ? ` · ${data.holidays.length}` : ''}
          </Button>
          {writable && (
            <Button variant="secondary" icon={UploadSimple} onClick={() => setDialog('import')}>
              Import
            </Button>
          )}
          <Button variant="secondary" icon={DownloadSimple} onClick={exportSheet} disabled={!employees.length}>
            Export
          </Button>
          {writable && (
            <Button icon={Lock} onClick={() => setDialog('lock')} disabled={!data.employees.length}>
              Lock month
            </Button>
          )}
        </div>
      </div>

      {/* brush palette */}
      {writable && (
        <div className="mt-3 flex items-center gap-1.5 flex-wrap">
          <span className="text-[11.5px] uppercase tracking-[0.1em] font-semibold text-ink-faint mr-1">Click to</span>
          <button
            type="button"
            aria-pressed={brush === 'CYCLE'}
            onClick={() => setBrush('CYCLE')}
            title="Each click moves a day to its next status"
            className={cx(
              'inline-flex items-center gap-1.5 h-8 rounded-lg px-2.5 text-[12px] font-semibold cursor-pointer border transition-[background-color,border-color,transform] duration-[var(--dur-fast)] active:scale-95',
              brush === 'CYCLE' ? 'border-ink bg-surface-high shadow-card' : 'border-transparent text-ink-soft hover:bg-slate-soft',
            )}
          >
            <ArrowsClockwise size={14} /> Cycle
          </button>
          <span className="text-[11.5px] text-ink-faint mx-0.5">or set</span>
          {CODES.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={brush === c}
              onClick={() => setBrush(c)}
              title={`${STATUS[c].label} (key ${STATUS[c].key})`}
              className={cx(
                'inline-flex items-center gap-1.5 h-8 rounded-lg pl-1 pr-2.5 text-[12px] font-semibold cursor-pointer border',
                'transition-[background-color,border-color,transform] duration-[var(--dur-fast)] active:scale-95',
                brush === c ? 'border-ink bg-surface-high shadow-card' : 'border-transparent hover:bg-slate-soft',
              )}
            >
              <span className={cx('grid place-items-center size-6 rounded-[6px] text-[10px] font-mono font-bold', STATUS[c].cell)}>{c}</span>
              {STATUS[c].label}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={brush === 'CLEAR'}
            onClick={() => setBrush('CLEAR')}
            className={cx(
              'inline-flex items-center gap-1.5 h-8 rounded-lg px-2.5 text-[12px] font-semibold cursor-pointer border transition-[background-color,border-color,transform] duration-[var(--dur-fast)] active:scale-95',
              brush === 'CLEAR' ? 'border-ink bg-surface-high shadow-card' : 'border-transparent text-ink-soft hover:bg-slate-soft',
            )}
          >
            <Eraser size={14} /> Clear
          </button>
          <div className="ml-auto flex items-center gap-1.5 flex-wrap">
            {summary.unmarked > 0 && (
              <Button size="sm" variant="ghost" onClick={fillBlanks}>
                Fill blanks as present
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={() => setMarkAll({ status: 'P' })} disabled={!workingCells.length}>
              <span className={cx('grid place-items-center size-5 rounded-[5px] text-[9.5px] font-mono font-bold', STATUS.P.cell)}>P</span>
              All present
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setMarkAll({ status: 'A' })} disabled={!workingCells.length}>
              <span className={cx('grid place-items-center size-5 rounded-[5px] text-[9.5px] font-mono font-bold', STATUS.A.cell)}>A</span>
              All absent
            </Button>
          </div>
        </div>
      )}

      {/* grid */}
      <div className="mt-3 bg-surface rounded-2xl border border-hairline shadow-card overflow-hidden">
        {loading && !data ? (
          <div className="p-5">
            <SkeletonRows rows={6} />
          </div>
        ) : error ? (
          <EmptyState icon={Warning} title="Could not load attendance" hint={error} />
        ) : employees.length === 0 ? (
          <EmptyState
            icon={CalendarCheck}
            title={data.employees.length ? 'No one matches these filters' : 'No one on the register this month'}
            hint={data.employees.length ? 'Clear the search or filters to see everyone.' : 'People appear here from their joining date.'}
          />
        ) : (
          <div
            ref={gridRef}
            tabIndex={0}
            onKeyDown={onKeyDown}
            onPointerDown={onPointerDown}
            onPointerOver={onPointerOver}
            className={cx('overflow-auto max-h-[68vh] outline-none focus-visible:ring-2 focus-visible:ring-accent/30', writable && 'cursor-cell', loading && 'opacity-60 transition-opacity')}
            aria-label={`Attendance grid for ${monthLabel(month)}`}
          >
            <table className="border-separate border-spacing-0 touch-pan-x touch-pan-y">
              <thead>
                <tr>
                  <th className="sticky left-0 top-0 z-30 bg-surface text-left px-3 py-2 border-b border-hairline text-[10.5px] uppercase tracking-[0.1em] font-semibold text-ink-faint">
                    {employees.length} {employees.length === 1 ? 'person' : 'people'}
                  </th>
                  {days.map((d) => (
                    <th key={d.day} className={cx('sticky top-0 z-20 bg-surface border-b border-hairline p-[2px] font-normal', d.off && 'bg-paper')}>
                      <button
                        type="button"
                        disabled={!writable || d.off}
                        onClick={() => fillDay(d)}
                        title={d.holiday ? `Holiday: ${d.holiday}` : d.off ? 'Weekly off' : writable ? 'Mark everyone still blank on this day' : undefined}
                        className={cx(
                          'grid w-[26px] py-1 rounded-[6px] leading-none text-center',
                          'enabled:cursor-pointer enabled:hover:bg-accent-soft enabled:hover:text-accent-text transition-colors',
                          d.holiday ? 'text-accent-text' : d.off ? 'text-ink-faint' : 'text-ink-soft',
                        )}
                      >
                        <span className="text-[9.5px] font-semibold">{WEEKDAY[d.dow]}</span>
                        <span className="text-[11.5px] font-mono font-semibold mt-0.5">{d.day}</span>
                      </button>
                    </th>
                  ))}
                  <th className="sticky top-0 sm:right-0 z-20 sm:z-30 bg-surface border-b border-l border-hairline px-3 py-2">
                    <div className="flex items-center gap-3 justify-end text-[10px] uppercase tracking-[0.08em] font-semibold text-ink-faint w-[112px]">
                      <span>Paid</span>
                      <span className="w-7 text-right">LOP</span>
                      <span className="w-6 text-right" title="Unmarked">?</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {employees.map((e, i) => (
                  <Row key={e.id} emp={e} marks={marks[e.id]} days={days} rowIndex={i} activeDay={active?.r === i ? active.d : null} onMarkMonth={writable ? onMarkMonth : undefined} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {writable && employees.length > 0 && (
        <p className="text-[12px] text-ink-faint mt-2.5">
          Click a day to step through its statuses, or pick one status and click or drag to set it. Arrow keys move; press P, A, D (half day), L (paid leave),
          U (unpaid), W or H to mark; Backspace clears.
          The P and A buttons beside a name mark that person's whole month. Faded days are the weekly off and holidays, applied automatically.
        </p>
      )}

      <HolidayDialog open={dialog === 'holidays'} onClose={() => setDialog(null)} month={month} holidays={data?.holidays ?? []} locked={locked} editable={editable} onChanged={load} />
      <ImportDialog open={dialog === 'import'} onClose={() => setDialog(null)} month={month} employees={data?.employees ?? []} onApply={importCells} />
      <ConfirmDialog
        open={dialog === 'lock'}
        onClose={() => setDialog(null)}
        onConfirm={() => {
          if (!summary.unmarked) return setLock(true)
          fillBlanks()
          setDialog(null)
        }}
        title={`Lock ${monthLabel(month)}?`}
        confirmLabel={summary.unmarked ? 'Fill blanks as present' : 'Lock month'}
        busy={busy}
      >
        {summary.unmarked ? (
          <>
            <span className="font-semibold text-amber-ink">{summary.unmarked} working days are still unmarked.</span> Every day needs a status before the
            month can be locked. Fill them as present now, or cancel and mark them by hand.
          </>
        ) : (
          <>
            Locking freezes the register for {summary.people} people so payroll can be run from it:{' '}
            <span className="font-semibold text-ink">{summary.lop} loss-of-pay days</span> in total. An admin can unlock it until payroll is finalised.
          </>
        )}
      </ConfirmDialog>
      <ConfirmDialog
        open={!!markAll}
        onClose={() => setMarkAll(null)}
        onConfirm={() => applyMarkAll(markAll)}
        title={markAll ? `Mark ${markAll.emp ? markAll.emp.name : 'everyone'} ${STATUS[markAll.status].label.toLowerCase()} for ${monthLabel(month)}?` : ''}
        confirmLabel={markAll?.emp ? `Mark ${STATUS[markAll.status].label.toLowerCase()}` : markAll?.status === 'A' ? 'Mark all absent' : 'Mark all present'}
        danger={markAll?.status === 'A'}
      >
        {markAll &&
          (() => {
            const word = STATUS[markAll.status].label.toLowerCase()
            const marked = scopeCells(markAll.emp).filter((c) => c.current && c.current !== markAll.status).length
            return (
              <>
                {markAll.emp ? (
                  <>
                    Every working day for <span className="font-semibold text-ink">{markAll.emp.name}</span> is set to {word}.
                  </>
                ) : (
                  <>
                    Every working day for{' '}
                    <span className="font-semibold text-ink">
                      {employees.length} {employees.length === 1 ? 'person' : 'people'}
                    </span>
                    {employees.length !== data.employees.length && ' (the ones shown by your filters)'} is set to {word}.
                  </>
                )}{' '}
                Weekly offs and holidays are left alone.
                {marked > 0 && (
                  <span className="block mt-2 font-semibold text-amber-ink">
                    {marked} {marked === 1 ? 'day is' : 'days are'} already marked as something else and will be overwritten.
                  </span>
                )}
              </>
            )
          })()}
      </ConfirmDialog>
      <ConfirmDialog open={dialog === 'unlock'} onClose={() => setDialog(null)} onConfirm={() => setLock(false)} title={`Unlock ${monthLabel(month)}?`} confirmLabel="Unlock" busy={busy}>
        The register becomes editable again. If a draft payroll run exists, recalculate it after you re-lock.
      </ConfirmDialog>
    </motion.div>
  )
}
