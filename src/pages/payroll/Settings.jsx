import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Info, Plus, Trash } from '@phosphor-icons/react'
import { cx } from '../../lib/utils'
import { listItem } from '../../lib/motion'
import { useReference } from '../../store/ReferenceStore'
import { SectionCard } from '../../components/ui'
import { AmountInput, Banner, Button, Field, SkeletonRows, TextInput, useToast } from '../../components/kit'

/* Statutory rates and the weekly off, per entity. Kept as settings so a
 * change in the law is an edit here, not a code change. */

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const RATE_FIELDS = [
  ['pfRate', 'PF rate', '% of PF wages, employee and employer each'],
  ['pfWageCeiling', 'PF wage ceiling', 'Basic above this is not counted. 0 = no ceiling'],
  ['esiEmployeeRate', 'ESI employee rate', '% of gross'],
  ['esiEmployerRate', 'ESI employer rate', '% of gross'],
  ['esiWageCeiling', 'ESI wage ceiling', 'Monthly gross above this is outside ESI'],
]

export default function PayrollSettings() {
  const ref = useReference()
  const toast = useToast()
  const [weeklyOff, setWeeklyOff] = useState([0])
  const [rates, setRates] = useState({})
  const [slabs, setSlabs] = useState([]) // [{ state, rows: [{ upTo, amount }] }]
  const [newState, setNewState] = useState('')
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    const s = ref.settings
    if (!s) return
    setWeeklyOff(s.weeklyOff)
    setRates(Object.fromEntries(RATE_FIELDS.map(([k]) => [k, String(s.payroll[k] ?? '')])))
    setSlabs(
      Object.entries(s.payroll.ptSlabs || {}).map(([state, rows]) => ({
        state,
        rows: rows.map((r) => ({ upTo: r.upTo == null ? '' : String(r.upTo), amount: String(r.amount) })),
      })),
    )
    setDirty(false)
  }, [ref.settings])

  const branchStates = useMemo(
    () => [...new Set(ref.branches.map((b) => b.state).filter(Boolean))].filter((s) => !slabs.some((x) => x.state === s)),
    [ref.branches, slabs],
  )
  const touch = (fn) => (...args) => {
    fn(...args)
    setDirty(true)
  }
  const toggleDay = touch((d) => setWeeklyOff((w) => (w.includes(d) ? w.filter((x) => x !== d) : [...w, d].sort())))
  const editSlab = touch((si, ri, key, value) =>
    setSlabs((all) => all.map((s, i) => (i !== si ? s : { ...s, rows: s.rows.map((r, j) => (j !== ri ? r : { ...r, [key]: value })) }))),
  )
  const addRow = touch((si) => setSlabs((all) => all.map((s, i) => (i !== si ? s : { ...s, rows: [...s.rows, { upTo: '', amount: '' }] }))))
  const dropRow = touch((si, ri) => setSlabs((all) => all.map((s, i) => (i !== si ? s : { ...s, rows: s.rows.filter((_, j) => j !== ri) })).filter((s) => s.rows.length)))
  const addState = touch((state) => {
    const name = state.trim()
    if (!name || slabs.some((s) => s.state.toLowerCase() === name.toLowerCase())) return
    setSlabs((all) => [...all, { state: name, rows: [{ upTo: '', amount: '' }] }])
    setNewState('')
  })

  const save = async () => {
    setBusy(true)
    try {
      await ref.saveSettings({
        weeklyOff,
        payroll: {
          ...Object.fromEntries(Object.entries(rates).map(([k, v]) => [k, Number(v) || 0])),
          ptSlabs: Object.fromEntries(
            slabs.map((s) => [
              s.state,
              s.rows.filter((r) => r.amount !== '').map((r) => ({ upTo: r.upTo === '' ? null : Number(r.upTo), amount: Number(r.amount) })),
            ]),
          ),
        },
      })
      toast.success('Payroll settings saved')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!ref.settings) {
    return (
      <SectionCard>
        <SkeletonRows rows={4} />
      </SectionCard>
    )
  }

  return (
    <div className="grid lg:grid-cols-2 gap-4 max-w-5xl">
      <Banner tone="accent" icon={Info} className="lg:col-span-2">
        These figures drive every salary sheet from the next draft or recalculation onward. Have your accountant confirm them, in particular the ESI wage
        ceiling and how the new wage code affects your PF base. Finalised sheets are never changed.
      </Banner>

      <SectionCard title="Weekly off">
        <p className="text-[12.5px] text-ink-faint mb-3">Unmarked days on these weekdays count as a paid week off in attendance.</p>
        <div className="flex gap-1.5 flex-wrap">
          {WEEKDAYS.map((label, d) => {
            const on = weeklyOff.includes(d)
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                onClick={() => toggleDay(d)}
                className={cx(
                  'h-9 w-12 rounded-[10px] text-[12.5px] font-semibold border cursor-pointer transition-[background-color,border-color,color,transform] duration-[var(--dur-fast)] active:scale-95',
                  on ? 'bg-accent text-white border-accent' : 'bg-surface-high border-hairline text-ink-soft hover:border-hairline-strong',
                )}
              >
                {label}
              </button>
            )
          })}
        </div>
      </SectionCard>

      <SectionCard title="PF and ESI">
        <div className="grid grid-cols-2 gap-3">
          {RATE_FIELDS.map(([k, label, hint]) => (
            <Field key={k} label={label} hint={hint}>
              {k.endsWith('Ceiling') ? (
                <AmountInput value={rates[k] ?? ''} onChange={(v) => { setRates((r) => ({ ...r, [k]: v })); setDirty(true) }} />
              ) : (
                <div className="relative">
                  <TextInput inputMode="decimal" value={rates[k] ?? ''} onChange={(e) => { setRates((r) => ({ ...r, [k]: e.target.value.replace(/[^\d.]/g, '') })); setDirty(true) }} className="pr-8 text-right font-mono tabular-nums" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12.5px] text-ink-faint pointer-events-none">%</span>
                </div>
              )}
            </Field>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Professional tax slabs" className="lg:col-span-2">
        <p className="text-[12.5px] text-ink-faint mb-3">
          Per state, by monthly gross. An employee's state comes from their branch (set it under Organisation → Branches). States without slabs deduct nothing.
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          <AnimatePresence initial={false}>
            {slabs.map((s, si) => (
              <motion.div key={s.state} layout {...listItem} className="rounded-xl border border-hairline p-3.5">
                <p className="font-display text-[14px] font-bold tracking-tight mb-2">{s.state}</p>
                <div className="space-y-2">
                  <div className="grid grid-cols-[1fr_1fr_28px] gap-2 text-[10.5px] uppercase tracking-[0.1em] font-semibold text-ink-faint">
                    <span>Gross up to</span>
                    <span>Tax per month</span>
                  </div>
                  {s.rows.map((r, ri) => (
                    <div key={ri} className="grid grid-cols-[1fr_1fr_28px] gap-2 items-center">
                      <AmountInput value={r.upTo} onChange={(v) => editSlab(si, ri, 'upTo', v)} placeholder="and above" className="!h-9" />
                      <AmountInput value={r.amount} onChange={(v) => editSlab(si, ri, 'amount', v)} className="!h-9" />
                      <button type="button" onClick={() => dropRow(si, ri)} aria-label="Remove slab" className="grid place-items-center size-7 rounded-lg text-ink-faint hover:text-rose-ink hover:bg-rose-soft transition-colors cursor-pointer">
                        <Trash size={13} />
                      </button>
                    </div>
                  ))}
                </div>
                <Button size="sm" variant="ghost" icon={Plus} className="mt-2" onClick={() => addRow(si)}>
                  Add slab
                </Button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        <div className="flex items-end gap-2 flex-wrap mt-4 pt-4 border-t border-hairline">
          {branchStates.map((s) => (
            <Button key={s} size="sm" variant="secondary" icon={Plus} onClick={() => addState(s)}>
              {s}
            </Button>
          ))}
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              addState(newState)
            }}
          >
            <TextInput value={newState} onChange={(e) => setNewState(e.target.value)} placeholder="Add another state" className="!h-8 !w-44 text-[12.5px]" />
            <Button size="sm" variant="secondary" type="submit" disabled={!newState.trim()}>
              Add
            </Button>
          </form>
        </div>
      </SectionCard>

      <div className="lg:col-span-2 flex items-center justify-end gap-3">
        {dirty && <span className="text-[12px] text-amber-ink font-medium animate-pop">Unsaved changes</span>}
        <Button size="lg" onClick={save} loading={busy} disabled={!dirty}>
          Save settings
        </Button>
      </div>
    </div>
  )
}
