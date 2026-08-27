import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check, UserPlus } from '@phosphor-icons/react'
import { BLOOD_GROUPS, DEPARTMENTS, EMPLOYMENT_TYPES } from '../data/seed'
import { useEmployees } from '../store/EmployeeStore'
import { useEntity } from '../store/EntityContext'
import { cx, fmtDate } from '../lib/utils'
import { Avatar } from '../components/ui'

const STEPS = ['Personal', 'Job & Org', 'Statutory & Bank', 'Review']

/* ---------------- form field primitives ---------------- */
function Field({ label, required, hint, children, className }) {
  return (
    <label className={cx('block', className)}>
      <span className="block text-[12.5px] font-semibold mb-1.5">
        {label} {required && <span className="text-rose-ink">*</span>}
      </span>
      {children}
      {hint && <span className="block text-[11.5px] text-ink-faint mt-1">{hint}</span>}
    </label>
  )
}

const inputCls =
  'w-full h-10 rounded-[10px] border border-hairline bg-surface px-3 text-[13.5px] outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 placeholder:text-ink-faint'

function TextInput(props) {
  return <input {...props} className={cx(inputCls, props.className)} />
}

function Select({ options, placeholder, ...props }) {
  return (
    <select {...props} className={cx(inputCls, 'cursor-pointer', !props.value && 'text-ink-faint')}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value ?? o} value={o.value ?? o}>
          {o.label ?? o}
        </option>
      ))}
    </select>
  )
}

/* ---------------- page ---------------- */
export default function AddEmployee() {
  const navigate = useNavigate()
  const { employees, nextCode, addEmployee } = useEmployees()
  const { entity } = useEntity()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [f, setF] = useState({
    name: '',
    gender: '',
    dob: '',
    bloodGroup: '',
    maritalStatus: 'Single',
    mobile: '',
    email: '',
    personalEmail: '',
    addressLine: '',
    city: '',
    state: '',
    pincode: '',
    ecName: '',
    ecRelation: '',
    ecPhone: '',
    branch: '',
    department: '',
    designation: '',
    employmentType: 'Full-time',
    reportsTo: '',
    joiningDate: '',
    aadhaar: '',
    pan: '',
    uan: '',
    esiNumber: '',
    bankAccountName: '',
    bankAccountNumber: '',
    bankName: '',
    ifsc: '',
  })

  const set = (k) => (ev) => setF((prev) => ({ ...prev, [k]: ev.target.value }))

  const code = useMemo(() => nextCode(entity.code), [entity.code, nextCode])

  /* Entity isolation: managers can only come from this portal's roster. */
  const managers = useMemo(
    () =>
      employees
        .filter((e) => e.company === entity.id && e.status !== 'exited')
        .sort((a, b) => a.name.localeCompare(b.name)),
    [employees, entity.id],
  )

  const stepValid = [
    f.name && f.mobile && f.dob,
    f.department && f.designation && f.branch && f.joiningDate,
    true, // statutory can be completed later — completeness meter tracks it
    true,
  ][step]

  const submit = async () => {
    setSaving(true)
    setSaveError(null)
    try {
    const created = await addEmployee({
      name: f.name.trim(),
      photo: null,
      gender: f.gender || undefined,
      dob: f.dob,
      bloodGroup: f.bloodGroup || undefined,
      maritalStatus: f.maritalStatus,
      mobile: f.mobile,
      email: f.email || undefined,
      personalEmail: f.personalEmail || undefined,
      address: f.addressLine
        ? { line: f.addressLine, city: f.city, state: f.state, pincode: f.pincode }
        : undefined,
      emergencyContact: f.ecName
        ? { name: f.ecName, relation: f.ecRelation, phone: f.ecPhone }
        : undefined,
      branch: f.branch,
      department: f.department,
      designation: f.designation,
      employmentType: f.employmentType,
      workMode: 'On-site',
      reportsTo: f.reportsTo || null,
      joiningDate: f.joiningDate,
      confirmationDate: null,
      status: 'probation',
      aadhaar: f.aadhaar || undefined,
      pan: f.pan ? f.pan.toUpperCase() : undefined,
      uan: f.uan || undefined,
      esiNumber: f.esiNumber || undefined,
      bank: f.bankAccountNumber
        ? {
            accountName: f.bankAccountName || f.name.trim(),
            accountNumber: f.bankAccountNumber,
            bankName: f.bankName,
            ifsc: f.ifsc.toUpperCase(),
          }
        : undefined,
    })
    navigate(`/people/${created.id}`)
    } catch (err) {
      setSaveError(err.message || 'Could not save employee')
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <button
        onClick={() => navigate('/people')}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-faint hover:text-ink transition-colors mb-4 cursor-pointer"
      >
        <ArrowLeft size={14} /> People
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="size-10 rounded-xl bg-accent-soft text-accent-text grid place-items-center">
          <UserPlus size={19} />
        </div>
        <div>
          <h1 className="font-display text-[24px] font-bold tracking-tight">Add employee</h1>
          <p className="text-[12.5px] text-ink-faint">
            New joiners start on probation. Statutory details can be completed later.
          </p>
        </div>
      </div>

      {/* Stepper */}
      <ol className="flex items-center gap-2 mb-6">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-2 flex-1 last:flex-none">
            <button
              onClick={() => i < step && setStep(i)}
              className={cx(
                'flex items-center gap-2 text-[12.5px] font-semibold whitespace-nowrap',
                i <= step ? 'text-accent-text' : 'text-ink-faint',
                i < step && 'cursor-pointer',
              )}
            >
              <span
                className={cx(
                  'size-6 rounded-full grid place-items-center text-[11px] border-2',
                  i < step
                    ? 'bg-accent border-accent text-white'
                    : i === step
                      ? 'border-accent text-accent-text'
                      : 'border-hairline-strong text-ink-faint',
                )}
              >
                {i < step ? <Check size={12} weight="bold" /> : i + 1}
              </span>
              <span className="hidden sm:inline">{s}</span>
            </button>
            {i < STEPS.length - 1 && <span className="h-px flex-1 bg-hairline-strong" />}
          </li>
        ))}
      </ol>

      <motion.div
        key={step}
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2 }}
        className="bg-surface rounded-2xl border border-hairline shadow-card p-6"
      >
        {step === 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Full name" required className="sm:col-span-2">
              <TextInput value={f.name} onChange={set('name')} placeholder="As per Aadhaar / bank records" />
            </Field>
            <Field label="Mobile" required>
              <TextInput value={f.mobile} onChange={set('mobile')} placeholder="+91 …" />
            </Field>
            <Field label="Date of birth" required>
              <TextInput type="date" value={f.dob} onChange={set('dob')} />
            </Field>
            <Field label="Gender">
              <Select value={f.gender} onChange={set('gender')} placeholder="Select" options={['Female', 'Male', 'Other', 'Prefer not to say']} />
            </Field>
            <Field label="Blood group">
              <Select value={f.bloodGroup} onChange={set('bloodGroup')} placeholder="Select" options={BLOOD_GROUPS} />
            </Field>
            <Field label="Marital status">
              <Select value={f.maritalStatus} onChange={set('maritalStatus')} options={['Single', 'Married', 'Other']} />
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
                <TextInput value={f.pincode} onChange={set('pincode')} maxLength={6} />
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
                <TextInput value={f.ecPhone} onChange={set('ecPhone')} placeholder="+91 …" />
              </Field>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <p className="sm:col-span-2 text-[12.5px] text-ink-soft -mb-1">
              Joining <span className="font-semibold">{entity.legalName}</span> · employee code
              will be <span className="font-mono text-[11.5px] text-accent-text">{code}</span>
            </p>
            <Field label="Branch / Lab" required>
              <Select
                value={f.branch}
                onChange={set('branch')}
                placeholder="Select branch"
                options={entity.branches.map((b) => ({
                  value: b,
                  label: b === entity.headOffice ? `${b} · Head Office` : b,
                }))}
              />
            </Field>
            <Field label="Department" required>
              <Select value={f.department} onChange={set('department')} placeholder="Select department" options={DEPARTMENTS} />
            </Field>
            <Field label="Designation" required>
              <TextInput value={f.designation} onChange={set('designation')} placeholder="e.g. Lab Technician" />
            </Field>
            <Field label="Employment type">
              <Select value={f.employmentType} onChange={set('employmentType')} options={EMPLOYMENT_TYPES} />
            </Field>
            <Field label="Joining date" required>
              <TextInput type="date" value={f.joiningDate} onChange={set('joiningDate')} />
            </Field>
            <Field label="Reporting manager" className="sm:col-span-2">
              <Select
                value={f.reportsTo}
                onChange={set('reportsTo')}
                placeholder="Select manager"
                options={managers.map((m) => ({ value: m.id, label: `${m.name} · ${m.designation}` }))}
              />
            </Field>
            <Field label="Work email">
              <TextInput type="email" value={f.email} onChange={set('email')} placeholder="name@company.in" />
            </Field>
          </div>
        )}

        {step === 2 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <p className="sm:col-span-2 text-[12.5px] text-ink-faint -mb-1">
              All optional at this stage. The profile completeness meter will flag anything missing
              before payroll.
            </p>
            <Field label="Aadhaar number">
              <TextInput value={f.aadhaar} onChange={set('aadhaar')} maxLength={12} placeholder="12 digits" />
            </Field>
            <Field label="PAN">
              <TextInput value={f.pan} onChange={set('pan')} maxLength={10} placeholder="ABCDE1234F" className="uppercase" />
            </Field>
            <Field label="UAN (PF)">
              <TextInput value={f.uan} onChange={set('uan')} maxLength={12} placeholder="From previous employer, if any" />
            </Field>
            <Field label="ESI number" hint="Only if gross wage ≤ ₹21,000/month">
              <TextInput value={f.esiNumber} onChange={set('esiNumber')} />
            </Field>
            <div className="sm:col-span-2 border-t border-hairline pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Account holder name" hint="Exactly as per bank records">
                <TextInput value={f.bankAccountName} onChange={set('bankAccountName')} placeholder={f.name || 'Account name'} />
              </Field>
              <Field label="Account number">
                <TextInput value={f.bankAccountNumber} onChange={set('bankAccountNumber')} />
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
                ['PAN', f.pan ? f.pan.toUpperCase() : 'To be collected'],
                ['Bank account', f.bankAccountNumber || 'To be collected'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 py-2 border-b border-hairline">
                  <dt className="text-[13px] text-ink-faint">{label}</dt>
                  <dd className="text-[13px] font-medium text-right">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="text-[12.5px] text-ink-faint mt-4">
              {f.name ? f.name.split(' ')[0] : 'They'} will be created with status{' '}
              <span className="font-semibold text-amber-ink">Probation</span>.
            </p>
          </div>
        )}
      </motion.div>

      {saveError && (
        <p className="mt-4 text-[12.5px] text-rose-ink bg-rose-soft rounded-lg px-3 py-2">{saveError}</p>
      )}

      {/* Footer nav */}
      <div className="flex items-center justify-between mt-4">
        <button
          onClick={() => (step === 0 ? navigate('/people') : setStep(step - 1))}
          className="inline-flex items-center gap-1.5 h-10 px-4 rounded-[10px] border border-hairline bg-surface text-[13px] font-semibold text-ink-soft hover:border-hairline-strong transition-colors cursor-pointer"
        >
          <ArrowLeft size={14} /> {step === 0 ? 'Cancel' : 'Back'}
        </button>
        <button
          disabled={!stepValid || saving}
          onClick={() => (step === STEPS.length - 1 ? submit() : setStep(step + 1))}
          className={cx(
            'inline-flex items-center gap-1.5 h-10 px-5 rounded-[10px] text-[13px] font-semibold text-white transition-colors',
            stepValid && !saving ? 'bg-accent hover:bg-accent-deep cursor-pointer' : 'bg-ink-faint/40 cursor-not-allowed',
          )}
        >
          {step === STEPS.length - 1 ? (
            <>
              <Check size={15} weight="bold" /> {saving ? 'Saving…' : 'Create employee'}
            </>
          ) : (
            <>
              Continue <ArrowRight size={14} />
            </>
          )}
        </button>
      </div>
    </div>
  )
}
