import { useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check, IdentificationCard, PencilSimple, UserPlus } from '@phosphor-icons/react'
import { BLOOD_GROUPS, EMPLOYMENT_TYPES, STATUSES } from '../data/seed'
import { apiFetch } from '../lib/api'
import { useEmployees } from '../store/EmployeeStore'
import { useEntity } from '../store/EntityContext'
import { useReference } from '../store/ReferenceStore'
import { cx, fmtDate, inr, todayISO } from '../lib/utils'
import { DUR, EASE_OUT, collapse, slideX } from '../lib/motion'
import { Avatar } from '../components/ui'
import { Banner, Button, Field, Select, SkeletonRows, TextInput, useToast } from '../components/kit'

/* Field-form designation codes, spelled out for the employee record. */
const FIELD_DESIGNATIONS = { TM: 'Territory Manager', ASM: 'Area Sales Manager', RSM: 'Regional Sales Manager', ZSM: 'Zonal Sales Manager' }

const STEPS = ['Personal', 'Job & Org', 'Statutory & Bank', 'Review']

const Options = ({ items, placeholder }) => (
  <>
    {placeholder && <option value="">{placeholder}</option>}
    {items.map((o) => (
      <option key={o.value ?? o} value={o.value ?? o}>
        {o.label ?? o}
      </option>
    ))}
  </>
)

const EMPTY = {
  name: '', gender: '', dob: '', bloodGroup: '', maritalStatus: 'Single', mobile: '', email: '', personalEmail: '',
  addressLine: '', city: '', state: '', pincode: '', ecName: '', ecRelation: '', ecPhone: '',
  branch: '', department: '', designation: '', employmentType: 'Full-time', reportsTo: '', joiningDate: '',
  status: 'probation', confirmationDate: '', lastWorkingDay: '', exitDate: '',
  aadhaar: '', pan: '', uan: '', esiNumber: '', bankAccountName: '', bankAccountNumber: '', bankName: '', ifsc: '',
}

const fromEmployee = (e) => ({
  ...EMPTY,
  name: e.name || '', gender: e.gender || '', dob: e.dob || '', bloodGroup: e.bloodGroup || '',
  maritalStatus: e.maritalStatus || 'Single', mobile: e.mobile || '', email: e.email || '', personalEmail: e.personalEmail || '',
  addressLine: e.address?.line || '', city: e.address?.city || '', state: e.address?.state || '', pincode: e.address?.pincode || '',
  ecName: e.emergencyContact?.name || '', ecRelation: e.emergencyContact?.relation || '', ecPhone: e.emergencyContact?.phone || '',
  branch: e.branch || '', department: e.department || '', designation: e.designation || '',
  employmentType: e.employmentType || 'Full-time', reportsTo: e.reportsTo || '', joiningDate: e.joiningDate || '',
  status: e.status || 'probation', confirmationDate: e.confirmationDate || '', lastWorkingDay: e.lastWorkingDay || '', exitDate: e.exitDate || '',
  uan: e.uan || '', esiNumber: e.esiNumber || '',
  bankAccountName: e.bank?.accountName || '', bankName: e.bank?.bankName || '', ifsc: e.bank?.ifsc || '',
})

/* Add a new employee, or edit an existing one (/people/:id/edit).
 * A new employee can be started from an onboarding submission, which
 * pre-fills what the field form collected and sets the first salary. */
export default function AddEmployee() {
  const navigate = useNavigate()
  const { id } = useParams()
  const location = useLocation()
  const submission = location.state?.submission ?? null
  const { employees, byId, nextCode, addEmployee, updateEmployee, loading } = useEmployees()
  const { entity } = useEntity()
  const ref = useReference()
  const toast = useToast()

  const existing = id ? byId(id) : null
  const editing = !!id
  const [step, setStep] = useState(0)
  const dir = useRef(1)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [f, setF] = useState(() =>
    existing
      ? fromEmployee(existing)
      : {
          ...EMPTY,
          name: submission?.name || '',
          joiningDate: submission ? todayISO() : '',
          designation: FIELD_DESIGNATIONS[submission?.designation] || '',
          department: submission && ref.departmentNames.includes('Sales & Marketing') ? 'Sales & Marketing' : '',
        },
  )
  // The roster may still be loading on a hard refresh of the edit page.
  const [seeded, setSeeded] = useState(!!existing || !editing)
  if (editing && existing && !seeded) {
    setF(fromEmployee(existing))
    setSeeded(true)
  }

  const set = (k) => (ev) => setF((prev) => ({ ...prev, [k]: ev.target.value }))
  const code = useMemo(() => existing?.code ?? nextCode(entity.code), [existing, entity.code, nextCode])

  /* Entity isolation: managers can only come from this portal's roster. */
  const managers = useMemo(
    () =>
      employees
        .filter((e) => e.company === entity.id && e.status !== 'exited' && e.id !== id)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [employees, entity.id, id],
  )
  // Keep a value that has since been made inactive selectable on its own record.
  const withCurrent = (names, value) => (value && !names.includes(value) ? [value, ...names] : names)

  const stepValid = [
    f.name && f.mobile && f.dob,
    f.department && f.designation && f.branch && f.joiningDate,
    true, // statutory can be completed later — completeness meter tracks it
    true,
  ][step]

  const go = (next) => {
    dir.current = next > step ? 1 : -1
    setStep(next)
  }

  const submit = async () => {
    setSaving(true)
    setSaveError(null)
    const body = {
      name: f.name.trim(),
      gender: f.gender || null,
      dob: f.dob,
      bloodGroup: f.bloodGroup || null,
      maritalStatus: f.maritalStatus,
      mobile: f.mobile,
      email: f.email || null,
      personalEmail: f.personalEmail || null,
      address: { line: f.addressLine, city: f.city, state: f.state, pincode: f.pincode },
      emergencyContact: { name: f.ecName, relation: f.ecRelation, phone: f.ecPhone },
      branch: f.branch,
      department: f.department,
      designation: f.designation.trim(),
      employmentType: f.employmentType,
      reportsTo: f.reportsTo || null,
      joiningDate: f.joiningDate,
      uan: f.uan || null,
      esiNumber: f.esiNumber || null,
      // Sensitive values are only sent when typed; blank keeps what is stored.
      ...(f.aadhaar ? { aadhaar: f.aadhaar } : {}),
      ...(f.pan ? { pan: f.pan.toUpperCase() } : {}),
      bank: {
        accountName: f.bankAccountName || (f.bankAccountNumber ? f.name.trim() : ''),
        bankName: f.bankName,
        ifsc: f.ifsc.toUpperCase(),
        ...(f.bankAccountNumber ? { accountNumber: f.bankAccountNumber } : {}),
      },
    }
    try {
      if (editing) {
        await updateEmployee({
          id,
          ...body,
          status: f.status,
          confirmationDate: f.confirmationDate || null,
          lastWorkingDay: f.lastWorkingDay || null,
          exitDate: f.exitDate || null,
        })
        toast.success(`Saved ${body.name}`)
        navigate(`/people/${id}`)
        return
      }
      const created = await addEmployee({ ...body, photo: null, workMode: 'On-site', confirmationDate: null, status: 'probation' })
      if (submission) {
        // Carry the field form's pay into the first salary structure, then
        // close the submission. Either failing must not lose the new record.
        try {
          const gross = Number(submission.fixedSalary) || 0
          if (gross > 0) {
            const basic = Math.round(gross * 0.5)
            const hra = Math.round(basic * 0.4)
            const conveyance = Math.min(1600, Math.max(0, gross - basic - hra))
            await apiFetch(`/employees/${created.id}/salary`, {
              method: 'POST',
              entity: entity.id,
              body: {
                effectiveFrom: f.joiningDate, basic, hra, conveyance,
                specialAllowance: Math.max(0, gross - basic - hra - conveyance),
                expenseComponent: Number(submission.expenseComponent) || 0,
                pfApplicable: true, esiApplicable: true, ptApplicable: true,
                note: 'From the onboarding form',
              },
            })
          }
          await apiFetch(`/onboarding/${submission.id}`, { method: 'PUT', entity: entity.id, body: { status: 'processed', employeeId: created.id } })
          toast.success(`${created.name} added as ${created.code}. Salary set from the onboarding form; review it under Compensation.`, { duration: 6000 })
        } catch (err) {
          toast.error(`${created.name} was added, but the onboarding follow-up failed: ${err.message}`)
        }
      } else {
        toast.success(`${created.name} added as ${created.code}`)
      }
      navigate(`/people/${created.id}`)
    } catch (err) {
      setSaveError(err.message || 'Could not save employee')
      setSaving(false)
    }
  }

  if (editing && !existing) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="bg-surface rounded-2xl border border-hairline shadow-card p-6 mt-10">
          {loading ? <SkeletonRows rows={4} /> : <p className="text-center text-[13.5px] text-ink-faint py-8">Employee not found.</p>}
        </div>
      </div>
    )
  }

  const back = editing ? `/people/${id}` : submission ? '/onboarding' : '/people'
  const HeadIcon = editing ? PencilSimple : UserPlus

  return (
    <div className="max-w-3xl mx-auto">
      <button
        onClick={() => navigate(back)}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-faint hover:text-ink transition-colors mb-4 cursor-pointer"
      >
        <ArrowLeft size={14} /> {editing ? existing.name : submission ? 'Onboarding' : 'People'}
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="size-10 rounded-xl bg-accent-soft text-accent-text grid place-items-center">
          <HeadIcon size={19} />
        </div>
        <div>
          <h1 className="font-display text-[24px] font-bold tracking-tight">{editing ? 'Edit employee' : 'Add employee'}</h1>
          <p className="text-[12.5px] text-ink-faint">
            {editing
              ? `${existing.code} · every change is recorded in the audit log.`
              : 'New joiners start on probation. Statutory details can be completed later.'}
          </p>
        </div>
      </div>

      {submission && (
        <Banner tone="accent" icon={IdentificationCard} className="mb-5">
          From the onboarding form: <span className="font-semibold">{submission.name}</span>
          {submission.designation && `, ${submission.designation}`}
          {(submission.area || submission.location) && ` · ${[submission.area, submission.location].filter(Boolean).join(', ')}`}
          {submission.fixedSalary != null && ` · fixed salary ${inr(submission.fixedSalary)}`}
          {submission.expenseComponent != null && ` · expenses ${inr(submission.expenseComponent)}`}. The salary is saved with the new record.
        </Banner>
      )}

      {/* Stepper — connectors fill as steps complete */}
      <ol className="flex items-center gap-2 mb-6">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-2 flex-1 last:flex-none">
            <button
              type="button"
              onClick={() => (i < step || editing) && go(i)}
              aria-current={i === step ? 'step' : undefined}
              className={cx(
                'flex items-center gap-2 text-[12.5px] font-semibold whitespace-nowrap transition-colors',
                i <= step ? 'text-accent-text' : 'text-ink-faint',
                (i < step || editing) && 'cursor-pointer',
              )}
            >
              <span
                className={cx(
                  'size-6 rounded-full grid place-items-center text-[11px] border-2 transition-colors duration-[var(--dur-base)]',
                  i < step ? 'bg-accent border-accent text-white' : i === step ? 'border-accent text-accent-text' : 'border-hairline-strong text-ink-faint',
                )}
              >
                {i < step ? <Check size={12} weight="bold" className="animate-pop" /> : i + 1}
              </span>
              <span className="hidden sm:inline">{s}</span>
            </button>
            {i < STEPS.length - 1 && (
              <span className="relative h-[2px] flex-1 rounded-full bg-hairline-strong/60 overflow-hidden">
                <motion.span
                  className="absolute inset-y-0 left-0 bg-accent"
                  initial={false}
                  animate={{ width: i < step ? '100%' : '0%' }}
                  transition={{ duration: DUR.slow, ease: EASE_OUT }}
                />
              </span>
            )}
          </li>
        ))}
      </ol>

      <div className="bg-surface rounded-2xl border border-hairline shadow-card p-6 overflow-hidden">
        <AnimatePresence mode="wait" initial={false} custom={dir.current}>
          <motion.div key={step} custom={dir.current} variants={slideX} initial="initial" animate="animate" exit="exit">
            {step === 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Full name" required className="sm:col-span-2">
                  <TextInput value={f.name} onChange={set('name')} placeholder="As per Aadhaar / bank records" />
                </Field>
                <Field label="Mobile" required>
                  <TextInput value={f.mobile} onChange={set('mobile')} placeholder="+91 …" inputMode="tel" />
                </Field>
                <Field label="Date of birth" required>
                  <TextInput type="date" value={f.dob} onChange={set('dob')} max={todayISO()} />
                </Field>
                <Field label="Gender">
                  <Select value={f.gender} onChange={set('gender')}>
                    <Options placeholder="Select" items={['Female', 'Male', 'Other', 'Prefer not to say']} />
                  </Select>
                </Field>
                <Field label="Blood group">
                  <Select value={f.bloodGroup} onChange={set('bloodGroup')}>
                    <Options placeholder="Select" items={BLOOD_GROUPS} />
                  </Select>
                </Field>
                <Field label="Marital status">
                  <Select value={f.maritalStatus} onChange={set('maritalStatus')}>
                    <Options items={['Single', 'Married', 'Other']} />
                  </Select>
                </Field>
                <Field label="Personal email">
                  <TextInput type="email" value={f.personalEmail} onChange={set('personalEmail')} placeholder="name@gmail.com" />
                </Field>
                <Field label="Address" className="sm:col-span-2">
                  <TextInput value={f.addressLine} onChange={set('addressLine')} placeholder="House / street / locality" />
                </Field>
                <Field label="City">
                  <TextInput value={f.city} onChange={set('city')} />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="State">
                    <TextInput value={f.state} onChange={set('state')} />
                  </Field>
                  <Field label="PIN code">
                    <TextInput value={f.pincode} onChange={set('pincode')} maxLength={6} inputMode="numeric" />
                  </Field>
                </div>
                <div className="sm:col-span-2 border-t border-hairline pt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Field label="Emergency contact name">
                    <TextInput value={f.ecName} onChange={set('ecName')} />
                  </Field>
                  <Field label="Relation">
                    <TextInput value={f.ecRelation} onChange={set('ecRelation')} placeholder="Spouse / Parent…" />
                  </Field>
                  <Field label="Emergency phone">
                    <TextInput value={f.ecPhone} onChange={set('ecPhone')} placeholder="+91 …" inputMode="tel" />
                  </Field>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <p className="sm:col-span-2 text-[12.5px] text-ink-soft -mb-1">
                  {editing ? 'Employed by' : 'Joining'} <span className="font-semibold">{entity.legalName}</span> · employee code{' '}
                  {!editing && 'will be '}
                  <span className="font-mono text-[11.5px] text-accent-text">{code}</span>
                </p>
                <Field label="Branch / Lab" required>
                  <Select value={f.branch} onChange={set('branch')}>
                    <Options
                      placeholder="Select branch"
                      items={withCurrent(ref.branchNames, f.branch).map((b) => ({ value: b, label: b === ref.headOffice ? `${b} · Head Office` : b }))}
                    />
                  </Select>
                </Field>
                <Field label="Department" required>
                  <Select value={f.department} onChange={set('department')}>
                    <Options placeholder="Select department" items={withCurrent(ref.departmentNames, f.department)} />
                  </Select>
                </Field>
                <Field label="Designation" required hint="Pick an existing one or type a new one.">
                  <TextInput value={f.designation} onChange={set('designation')} placeholder="e.g. Lab Technician" list="designation-options" />
                  <datalist id="designation-options">
                    {ref.designationNames.map((d) => (
                      <option key={d} value={d} />
                    ))}
                  </datalist>
                </Field>
                <Field label="Employment type">
                  <Select value={f.employmentType} onChange={set('employmentType')}>
                    <Options items={EMPLOYMENT_TYPES} />
                  </Select>
                </Field>
                <Field label="Joining date" required>
                  <TextInput type="date" value={f.joiningDate} onChange={set('joiningDate')} />
                </Field>
                <Field label="Work email">
                  <TextInput type="email" value={f.email} onChange={set('email')} placeholder="name@company.in" />
                </Field>
                <Field label="Reporting manager" className="sm:col-span-2">
                  <Select value={f.reportsTo} onChange={set('reportsTo')}>
                    <Options placeholder="No manager" items={managers.map((m) => ({ value: m.id, label: `${m.name} · ${m.designation}` }))} />
                  </Select>
                </Field>

                {editing && (
                  <div className="sm:col-span-2 border-t border-hairline pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Status">
                      <Select value={f.status} onChange={set('status')}>
                        <Options items={Object.values(STATUSES).map((s) => ({ value: s.id, label: s.label }))} />
                      </Select>
                    </Field>
                    <Field label="Confirmation date">
                      <TextInput type="date" value={f.confirmationDate} onChange={set('confirmationDate')} />
                    </Field>
                    <AnimatePresence initial={false}>
                      {(f.status === 'notice' || f.status === 'exited') && (
                        <motion.div key="exit-dates" {...collapse} className="sm:col-span-2 overflow-hidden">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Last working day" hint="Attendance and pay stop after this date.">
                              <TextInput type="date" value={f.lastWorkingDay} onChange={set('lastWorkingDay')} />
                            </Field>
                            <Field label="Exit date">
                              <TextInput type="date" value={f.exitDate} onChange={set('exitDate')} />
                            </Field>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <p className="sm:col-span-2 text-[12.5px] text-ink-faint -mb-1">
                  {editing
                    ? 'Aadhaar, PAN and the account number are stored encrypted. Leave them blank to keep what is on file.'
                    : 'All optional at this stage. The profile completeness meter flags anything missing before payroll.'}
                </p>
                <Field label="Aadhaar number">
                  <TextInput value={f.aadhaar} onChange={set('aadhaar')} maxLength={12} inputMode="numeric" placeholder={existing?.aadhaar || '12 digits'} />
                </Field>
                <Field label="PAN">
                  <TextInput value={f.pan} onChange={set('pan')} maxLength={10} placeholder={existing?.pan || 'ABCDE1234F'} className="uppercase" />
                </Field>
                <Field label="UAN (PF)">
                  <TextInput value={f.uan} onChange={set('uan')} maxLength={12} placeholder="From previous employer, if any" />
                </Field>
                <Field label="ESI number" hint="Only needed when the employee is covered by ESI.">
                  <TextInput value={f.esiNumber} onChange={set('esiNumber')} />
                </Field>
                <div className="sm:col-span-2 border-t border-hairline pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Account holder name" hint="Exactly as per bank records">
                    <TextInput value={f.bankAccountName} onChange={set('bankAccountName')} placeholder={f.name || 'Account name'} />
                  </Field>
                  <Field label="Account number">
                    <TextInput value={f.bankAccountNumber} onChange={set('bankAccountNumber')} inputMode="numeric" placeholder={existing?.bank?.accountNumber || ''} />
                  </Field>
                  <Field label="Bank name">
                    <TextInput value={f.bankName} onChange={set('bankName')} placeholder="e.g. HDFC Bank" />
                  </Field>
                  <Field label="IFSC">
                    <TextInput value={f.ifsc} onChange={set('ifsc')} maxLength={11} placeholder="HDFC0000123" className="uppercase" />
                  </Field>
                </div>
              </div>
            )}

            {step === 3 && (
              <div>
                <div className="flex items-center gap-4 pb-4 border-b border-hairline">
                  <Avatar name={f.name || '?'} size={52} />
                  <div>
                    <p className="font-display font-bold text-[17px]">{f.name}</p>
                    <p className="text-[13px] text-ink-soft">
                      {f.designation} · {f.department}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11.5px] font-semibold text-ink-soft">{entity.name}</span>
                      <span className="font-mono text-[11.5px] text-ink-faint">{code}</span>
                    </div>
                  </div>
                </div>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 mt-2">
                  {[
                    ['Mobile', f.mobile],
                    ['Date of birth', fmtDate(f.dob)],
                    ['Branch', f.branch],
                    ['Employment type', f.employmentType],
                    ['Joining date', fmtDate(f.joiningDate)],
                    ['Manager', managers.find((m) => m.id === f.reportsTo)?.name ?? '—'],
                    ['PAN', f.pan ? f.pan.toUpperCase() : existing?.pan || 'To be collected'],
                    ['Bank account', f.bankAccountNumber || existing?.bank?.accountNumber || 'To be collected'],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4 py-2 border-b border-hairline">
                      <dt className="text-[13px] text-ink-faint">{label}</dt>
                      <dd className="text-[13px] font-medium text-right">{value}</dd>
                    </div>
                  ))}
                </dl>
                <p className="text-[12.5px] text-ink-faint mt-4">
                  {editing ? (
                    <>
                      Status will be <span className="font-semibold text-ink">{STATUSES[f.status]?.label}</span>.
                    </>
                  ) : (
                    <>
                      {f.name ? f.name.split(' ')[0] : 'They'} will be created with status <span className="font-semibold text-amber-ink">Probation</span>.
                    </>
                  )}
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <AnimatePresence initial={false}>
        {saveError && (
          <motion.div key="err" {...collapse} className="overflow-hidden" role="alert">
            <p className="mt-4 text-[12.5px] text-rose-ink bg-rose-soft rounded-lg px-3 py-2">{saveError}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer nav */}
      <div className="flex items-center justify-between mt-4">
        <Button variant="secondary" size="lg" icon={ArrowLeft} onClick={() => (step === 0 ? navigate(back) : go(step - 1))} disabled={saving}>
          {step === 0 ? 'Cancel' : 'Back'}
        </Button>
        <div className="flex items-center gap-2">
          {editing && step < STEPS.length - 1 && (
            <Button variant="secondary" size="lg" onClick={submit} loading={saving} disabled={!(f.name && f.mobile && f.dob && f.department && f.designation && f.branch && f.joiningDate)}>
              Save now
            </Button>
          )}
          {step === STEPS.length - 1 ? (
            <Button size="lg" icon={Check} onClick={submit} loading={saving}>
              {editing ? 'Save changes' : 'Create employee'}
            </Button>
          ) : (
            <Button size="lg" onClick={() => go(step + 1)} disabled={!stepValid} title={stepValid ? undefined : 'Fill the required fields to continue'}>
              Continue <ArrowRight size={14} weight="bold" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
