import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  BadgeCheck,
  Banknote,
  CalendarDays,
  CircleAlert,
  FileText,
  Landmark,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  UserRound,
  UsersRound,
} from 'lucide-react'
import { DOCUMENT_TYPES } from '../data/seed'
import { useEmployees } from '../store/EmployeeStore'
import { useEntity } from '../store/EntityContext'
import {
  age,
  completeness,
  cx,
  fmtDate,
  groupAadhaar,
  maskAadhaar,
  maskAccount,
  maskPan,
  tenure,
} from '../lib/utils'
import {
  Avatar,
  FieldRow,
  MaskedValue,
  ProgressRing,
  SectionCard,
  StatusPill,
} from '../components/ui'

const TABS = [
  { id: 'overview', label: 'Overview', icon: UserRound },
  { id: 'job', label: 'Job & Org', icon: UsersRound },
  { id: 'statutory', label: 'Statutory & Bank', icon: Landmark },
  { id: 'documents', label: 'Documents', icon: FileText },
]

/* ---------------- Timeline ---------------- */
function Timeline({ e }) {
  const events = useMemo(() => {
    const list = [{ date: e.joiningDate, label: 'Joined', detail: `as ${e.designation}` }]
    if (e.confirmationDate)
      list.push({ date: e.confirmationDate, label: 'Confirmed', detail: 'Probation completed' })
    if (e.status === 'notice')
      list.push({
        date: e.lastWorkingDay,
        label: 'Notice period',
        detail: `Last working day ${fmtDate(e.lastWorkingDay)}`,
        tone: 'rose',
      })
    if (e.exitDate) list.push({ date: e.exitDate, label: 'Exited', detail: 'Employment ended', tone: 'slate' })
    return list.filter((ev) => ev.date).sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [e])

  return (
    <ol className="relative ml-1.5 border-l-2 border-hairline space-y-4 py-1">
      {events.map((ev, i) => (
        <li key={i} className="relative pl-5">
          <span
            className={cx(
              'absolute -left-[7px] top-1 size-3 rounded-full border-2 border-surface',
              ev.tone === 'rose' ? 'bg-rose-ink' : ev.tone === 'slate' ? 'bg-ink-faint' : 'bg-iris',
            )}
          />
          <p className="text-[13px] font-semibold leading-tight">{ev.label}</p>
          <p className="text-[12px] text-ink-faint">{ev.detail}</p>
          <p className="text-[11px] text-ink-faint mt-0.5 font-mono">{fmtDate(ev.date)}</p>
        </li>
      ))}
    </ol>
  )
}

/* ---------------- Statutory checklist row ---------------- */
function ComplianceRow({ label, ok, children }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-hairline last:border-0">
      <div className="flex items-center gap-2.5 min-w-0">
        {ok ? (
          <BadgeCheck size={16} className="text-mint shrink-0" />
        ) : (
          <CircleAlert size={16} className="text-amber-ink shrink-0" />
        )}
        <span className="text-[13px] font-medium">{label}</span>
      </div>
      <div className="text-[13px] text-right">{children}</div>
    </div>
  )
}

/* ---------------- Page ---------------- */
export default function Profile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { byId, reportsOf } = useEmployees()
  const { entity } = useEntity()
  const [tab, setTab] = useState('overview')

  const e = byId(id)
  /* Entity isolation: a record from another portal is indistinguishable
     from a missing one — never confirm it exists. */
  if (!e || e.company !== entity.id) {
    return (
      <div className="max-w-3xl mx-auto text-center py-20">
        <p className="font-display text-lg font-semibold">Employee not found</p>
        <Link to="/people" className="text-iris-text text-[13px] font-medium mt-2 inline-block">
          ← Back to People
        </Link>
      </div>
    )
  }

  const manager = e.reportsTo ? byId(e.reportsTo) : null
  const reports = reportsOf(e.id)
  const comp = completeness(e)
  const isHQ = e.branch === entity.headOffice

  return (
    <div className="max-w-6xl mx-auto">
      <button
        onClick={() => navigate('/people')}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-faint hover:text-ink transition-colors mb-4 cursor-pointer"
      >
        <ArrowLeft size={14} /> People
      </button>

      {/* ---- Header card ---- */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-surface rounded-2xl border border-hairline shadow-card p-6"
      >
        <div className="flex flex-wrap items-start gap-5">
          <Avatar name={e.name} photo={e.photo} size={72} />

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="font-display text-[22px] font-bold tracking-tight">{e.name}</h1>
              <StatusPill status={e.status} />
            </div>
            <p className="text-[14px] text-ink-soft mt-0.5">
              {e.designation} · {e.department}
            </p>
            <div className="flex items-center gap-2 mt-2.5 flex-wrap text-[12.5px] text-ink-faint">
              <span className="inline-flex items-center gap-1">
                <MapPin size={12} /> {e.branch}
              </span>
              {isHQ && (
                <span className="text-[9.5px] font-bold uppercase tracking-wider text-iris-text bg-iris-soft rounded px-1.5 py-0.5">
                  HQ
                </span>
              )}
              <span className="font-mono text-[11.5px]">{e.code}</span>
              <span>· {tenure(e.joiningDate, e.exitDate)} tenure</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Completeness — payroll readiness */}
            <div className="flex items-center gap-2.5" title={comp.missing.length ? `Missing: ${comp.missing.join(', ')}` : 'Profile complete'}>
              <ProgressRing pct={comp.pct} />
              <div className="leading-tight hidden sm:block">
                <p className="text-[12px] font-semibold">Profile</p>
                <p className="text-[11px] text-ink-faint">
                  {comp.missing.length ? `${comp.missing.length} missing` : 'Complete'}
                </p>
              </div>
            </div>

            <div className="flex gap-1.5">
              <a
                href={`mailto:${e.email}`}
                className="p-2.5 rounded-xl border border-hairline text-ink-soft hover:text-iris hover:border-iris/40 transition-colors"
                title={e.email}
              >
                <Mail size={16} />
              </a>
              <a
                href={`tel:${e.mobile}`}
                className="p-2.5 rounded-xl border border-hairline text-ink-soft hover:text-iris hover:border-iris/40 transition-colors"
                title={e.mobile}
              >
                <Phone size={16} />
              </a>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-6 -mb-2 overflow-x-auto">
          {TABS.map(({ id: tid, label, icon: Icon }) => (
            <button
              key={tid}
              onClick={() => setTab(tid)}
              className={cx(
                'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold whitespace-nowrap transition-colors cursor-pointer',
                tab === tid ? 'bg-iris-soft text-iris-text' : 'text-ink-faint hover:text-ink',
              )}
            >
              <Icon size={14.5} />
              {label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* ---- Tab content ---- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        {tab === 'overview' && (
          <>
            <SectionCard title="Personal" className="lg:col-span-1">
              <dl>
                <FieldRow label="Date of birth">
                  {fmtDate(e.dob)} {age(e.dob) && <span className="text-ink-faint">({age(e.dob)})</span>}
                </FieldRow>
                <FieldRow label="Gender">{e.gender}</FieldRow>
                <FieldRow label="Blood group">
                  <span className="font-semibold text-rose-ink">{e.bloodGroup}</span>
                </FieldRow>
                <FieldRow label="Marital status">{e.maritalStatus}</FieldRow>
              </dl>
            </SectionCard>

            <SectionCard title="Contact" className="lg:col-span-1">
              <dl>
                <FieldRow label="Work email">{e.email}</FieldRow>
                <FieldRow label="Personal email">{e.personalEmail}</FieldRow>
                <FieldRow label="Mobile" mono>{e.mobile}</FieldRow>
                <FieldRow label="Address">
                  {e.address ? (
                    <span className="block max-w-52 text-right">
                      {e.address.line}, {e.address.city}, {e.address.state} {e.address.pincode}
                    </span>
                  ) : (
                    '—'
                  )}
                </FieldRow>
              </dl>
            </SectionCard>

            <div className="space-y-4">
              <SectionCard title="Emergency contact">
                <dl>
                  <FieldRow label="Name">{e.emergencyContact?.name}</FieldRow>
                  <FieldRow label="Relation">{e.emergencyContact?.relation}</FieldRow>
                  <FieldRow label="Phone" mono>{e.emergencyContact?.phone}</FieldRow>
                </dl>
              </SectionCard>

              <SectionCard title="Timeline">
                <Timeline e={e} />
              </SectionCard>
            </div>
          </>
        )}

        {tab === 'job' && (
          <>
            <SectionCard title="Employment" className="lg:col-span-1">
              <dl>
                <FieldRow label="Employee code" mono>{e.code}</FieldRow>
                <FieldRow label="Company">{entity.legalName}</FieldRow>
                <FieldRow label="Branch / Lab">
                  {e.branch}
                  {isHQ && <span className="text-ink-faint"> (Head Office)</span>}
                </FieldRow>
                <FieldRow label="Department">{e.department}</FieldRow>
                <FieldRow label="Designation">{e.designation}</FieldRow>
                <FieldRow label="Employment type">{e.employmentType}</FieldRow>
                <FieldRow label="Work mode">{e.workMode}</FieldRow>
              </dl>
            </SectionCard>

            <SectionCard title="Key dates" className="lg:col-span-1">
              <dl>
                <FieldRow label="Joining date">{fmtDate(e.joiningDate)}</FieldRow>
                <FieldRow label="Confirmation date">
                  {e.confirmationDate ? fmtDate(e.confirmationDate) : e.status === 'probation' ? (
                    <span className="text-amber-ink font-semibold">On probation</span>
                  ) : '—'}
                </FieldRow>
                {e.lastWorkingDay && (
                  <FieldRow label="Last working day">
                    <span className="text-rose-ink font-semibold">{fmtDate(e.lastWorkingDay)}</span>
                  </FieldRow>
                )}
                {e.exitDate && <FieldRow label="Exit date">{fmtDate(e.exitDate)}</FieldRow>}
                <FieldRow label="Tenure">{tenure(e.joiningDate, e.exitDate)}</FieldRow>
              </dl>
            </SectionCard>

            {/* Org context — manager above, reports below */}
            <SectionCard title="Org context" className="lg:col-span-1">
              {manager ? (
                <Link
                  to={`/people/${manager.id}`}
                  className="flex items-center gap-3 rounded-xl border border-hairline p-3 hover:border-iris/40 transition-colors"
                >
                  <Avatar name={manager.name} size={36} />
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold truncate">{manager.name}</p>
                    <p className="text-[11.5px] text-ink-faint truncate">
                      {manager.designation} · Manager
                    </p>
                  </div>
                </Link>
              ) : (
                <p className="text-[13px] text-ink-faint">No reporting manager</p>
              )}

              {reports.length > 0 && (
                <>
                  <p className="text-[11.5px] uppercase tracking-[0.1em] text-ink-faint font-semibold mt-4 mb-2">
                    Direct reports · {reports.length}
                  </p>
                  <div className="space-y-1.5">
                    {reports.map((r) => (
                      <Link
                        key={r.id}
                        to={`/people/${r.id}`}
                        className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-iris-soft/50 transition-colors"
                      >
                        <Avatar name={r.name} size={28} />
                        <div className="min-w-0">
                          <p className="text-[12.5px] font-medium truncate">{r.name}</p>
                          <p className="text-[11px] text-ink-faint truncate">{r.designation}</p>
                        </div>
                        <StatusPill status={r.status} className="ml-auto scale-90 origin-right" />
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </SectionCard>
          </>
        )}

        {tab === 'statutory' && (
          <>
            <SectionCard title="Statutory & compliance" className="lg:col-span-2">
              <p className="text-[12px] text-ink-faint -mt-1 mb-2 flex items-center gap-1.5">
                <ShieldCheck size={13} /> Sensitive fields are masked. Reveals auto-hide after 10s.
              </p>
              <ComplianceRow label="PAN" ok={!!e.pan}>
                <MaskedValue masked={maskPan(e.pan)} revealed={e.pan} />
              </ComplianceRow>
              <ComplianceRow label="Aadhaar" ok={!!e.aadhaar}>
                <MaskedValue masked={maskAadhaar(e.aadhaar)} revealed={groupAadhaar(e.aadhaar)} />
              </ComplianceRow>
              <ComplianceRow label="PF — UAN" ok={!!e.uan || ['Consultant', 'Intern'].includes(e.employmentType)}>
                {e.uan ? (
                  <MaskedValue masked={`••••••${e.uan.slice(-4)}`} revealed={e.uan} />
                ) : ['Consultant', 'Intern'].includes(e.employmentType) ? (
                  <span className="text-ink-faint text-[12px]">Not applicable · {e.employmentType}</span>
                ) : (
                  <span className="text-amber-ink text-[12px] font-medium">Missing</span>
                )}
              </ComplianceRow>
              <ComplianceRow label="ESI" ok={!!e.esiNumber || !e.esiNumber}>
                {e.esiNumber ? (
                  <MaskedValue masked={`••••••${e.esiNumber.slice(-4)}`} revealed={e.esiNumber} />
                ) : (
                  <span className="text-ink-faint text-[12px]">Not eligible (wage &gt; ₹21,000)</span>
                )}
              </ComplianceRow>
            </SectionCard>

            <SectionCard title="Bank & payment">
              <p className="text-[12px] text-ink-faint -mt-1 mb-2 flex items-center gap-1.5">
                <Banknote size={13} /> Salary account
              </p>
              <dl>
                <FieldRow label="Account name">{e.bank?.accountName}</FieldRow>
                <FieldRow label="Account no.">
                  <MaskedValue masked={maskAccount(e.bank?.accountNumber)} revealed={e.bank?.accountNumber} />
                </FieldRow>
                <FieldRow label="Bank">{e.bank?.bankName}</FieldRow>
                <FieldRow label="IFSC" mono>{e.bank?.ifsc}</FieldRow>
              </dl>
            </SectionCard>
          </>
        )}

        {tab === 'documents' && (
          <SectionCard title="Document vault" className="lg:col-span-3">
            <p className="text-[12px] text-ink-faint -mt-1 mb-3">
              Uploads land in Phase 2 — this checklist tracks what has been collected.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {DOCUMENT_TYPES.map((d, i) => {
                /* Demo: mark a deterministic subset collected */
                const collected = (e.id.charCodeAt(2) + i) % 3 !== 0
                return (
                  <div
                    key={d.id}
                    className="flex items-center gap-3 rounded-xl border border-hairline p-3.5"
                  >
                    <div
                      className={cx(
                        'size-9 rounded-lg grid place-items-center shrink-0',
                        collected ? 'bg-mint-soft text-mint' : 'bg-amber-soft text-amber-ink',
                      )}
                    >
                      <FileText size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium truncate">{d.label}</p>
                      <p className={cx('text-[11.5px]', collected ? 'text-mint' : 'text-amber-ink')}>
                        {collected ? 'Collected' : 'Pending'}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </SectionCard>
        )}
      </div>
    </div>
  )
}
