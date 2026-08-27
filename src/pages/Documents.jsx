import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Circle, SealCheck, UsersThree } from '@phosphor-icons/react'
import { DOCUMENT_TYPES } from '../data/seed'
import { useEmployees } from '../store/EmployeeStore'
import { useEntity } from '../store/EntityContext'
import { cx } from '../lib/utils'
import { Avatar, EmptyState, SectionCard } from '../components/ui'
import { HBarList, SampleTag, Stat } from '../components/charts'

/* ------------------------------------------------------------------
 * Document collection across the roster.
 * Identity/banking columns are REAL (derived from record fields);
 * the rest reuse the Profile page's deterministic sample checklist
 * until file uploads land in Phase 2.
 * ------------------------------------------------------------------ */

const REAL_CHECKS = {
  pan: (e) => !!e.pan,
  aadhaar: (e) => !!e.aadhaar,
  photo: (e) => !!e.photo,
  bank: (e) => !!e.bank?.accountNumber,
}

const collected = (e, doc, index) => {
  const real = REAL_CHECKS[doc.id]
  if (real) return real(e)
  /* Same deterministic sample rule the Profile checklist uses */
  return (e.id.charCodeAt(2) + index) % 3 !== 0
}

export default function Documents() {
  const { employees } = useEmployees()
  const { entity } = useEntity()

  const roster = useMemo(
    () =>
      employees
        .filter((e) => e.company === entity.id && e.status !== 'exited')
        .sort((a, b) => a.name.localeCompare(b.name)),
    [employees, entity.id],
  )

  /* Collection rate per document type */
  const byDoc = useMemo(
    () =>
      DOCUMENT_TYPES.map((doc, i) => ({
        label: doc.label,
        value: roster.filter((e) => collected(e, doc, i)).length,
      })),
    [roster],
  )
  const totalCells = roster.length * DOCUMENT_TYPES.length
  const totalDone = byDoc.reduce((a, b) => a + b.value, 0)
  const pct = totalCells ? Math.round((totalDone / totalCells) * 100) : 0

  const pending = useMemo(
    () =>
      roster
        .map((e) => ({
          e,
          missing: DOCUMENT_TYPES.filter((doc, i) => !collected(e, doc, i)),
        }))
        .filter((r) => r.missing.length > 0)
        .sort((a, b) => b.missing.length - a.missing.length),
    [roster],
  )

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center gap-2.5 flex-wrap">
        <h1 className="font-display text-[28px] font-bold tracking-tight">Documents</h1>
        <SampleTag>Checklist only</SampleTag>
      </div>
      <p className="text-[13px] text-ink-faint mt-0.5 max-w-2xl">
        Identity and banking columns come from the register. Uploads land in Phase 2;
        the remaining columns are a sample tracking checklist until then.
      </p>

      {roster.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-hairline shadow-card mt-5">
          <EmptyState icon={UsersThree} title="No files to track" hint="Add employees first." />
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="mt-5 space-y-4"
        >
          {/* Collection summary */}
          <div className="bg-surface rounded-2xl border border-hairline shadow-card px-5 py-4 sm:px-6 sm:py-5">
            <div className="flex flex-wrap items-start gap-x-10 gap-y-4">
              <Stat label="Collected" value={`${pct}%`} hint={`${totalDone} of ${totalCells} items`} />
              <div className="flex-1 min-w-64">
                <HBarList items={byDoc.slice(0, 5)} />
              </div>
            </div>
          </div>

          {/* Matrix */}
          <SectionCard title="Collection matrix">
            <div className="overflow-x-auto -mx-5 px-5">
              <table className="w-full border-collapse min-w-[720px]">
                <thead>
                  <tr className="text-[10.5px] uppercase tracking-[0.1em] text-ink-faint border-b border-hairline">
                    <th className="text-left py-2 pr-3 font-semibold">Employee</th>
                    {DOCUMENT_TYPES.map((doc) => (
                      <th key={doc.id} className="px-1.5 pb-2 font-semibold">
                        <span
                          className="block [writing-mode:vertical-rl] rotate-180 mx-auto h-24 text-left"
                          title={doc.label}
                        >
                          {doc.label.length > 18 ? `${doc.label.slice(0, 17)}…` : doc.label}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {roster.map((e) => (
                    <tr key={e.id} className="border-b border-hairline last:border-0 hover:bg-accent-soft/30 transition-colors">
                      <td className="py-2 pr-3">
                        <Link to={`/people/${e.id}`} className="flex items-center gap-2.5 group min-w-0">
                          <Avatar name={e.name} photo={e.photo} size={30} />
                          <span className="text-[12.5px] font-semibold truncate group-hover:text-accent-text">
                            {e.name}
                          </span>
                        </Link>
                      </td>
                      {DOCUMENT_TYPES.map((doc, i) => {
                        const ok = collected(e, doc, i)
                        return (
                          <td key={doc.id} className="text-center px-1.5" title={`${doc.label}: ${ok ? 'collected' : 'pending'}`}>
                            {ok ? (
                              <SealCheck size={15} weight="fill" className="inline text-mint" />
                            ) : (
                              <Circle size={13} className="inline text-hairline-strong" />
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          {/* Chase list */}
          {pending.length > 0 && (
            <SectionCard title={`To chase · ${pending.length} ${pending.length === 1 ? 'person' : 'people'}`}>
              <ul className="divide-y divide-hairline -mx-1">
                {pending.slice(0, 8).map(({ e, missing }) => (
                  <li key={e.id} className="flex items-center gap-3 py-2.5 px-1">
                    <Avatar name={e.name} photo={e.photo} size={34} />
                    <Link
                      to={`/people/${e.id}`}
                      className="text-[13px] font-semibold truncate hover:text-accent-text min-w-0 flex-1"
                    >
                      {e.name}
                    </Link>
                    <span className={cx('text-[12px] text-ink-faint text-right', missing.length > 3 && 'text-amber-ink font-medium')}>
                      {missing.length <= 2
                        ? missing.map((m) => m.label).join(', ')
                        : `${missing.length} documents pending`}
                    </span>
                  </li>
                ))}
              </ul>
              {pending.length > 8 && (
                <p className="text-[12px] text-ink-faint mt-2 px-1">and {pending.length - 8} more.</p>
              )}
            </SectionCard>
          )}
        </motion.div>
      )}
    </div>
  )
}
