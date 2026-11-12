import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Circle, SealCheck, UsersThree } from '@phosphor-icons/react'
import { DOCUMENT_TYPES } from '../data/seed'
import { useEmployees } from '../store/EmployeeStore'
import { useEntity } from '../store/EntityContext'
import { cx } from '../lib/utils'
import { Avatar, EmptyState, SectionCard } from '../components/ui'
import { HBarList, Stat } from '../components/charts'
import { AnimatedNumber } from '../components/kit'
import { stagger } from '../lib/motion'

/* ------------------------------------------------------------------
 * Document collection across the roster.
 * Only documents the register can vouch for are shown: identity and
 * banking, read from each record. The others need file uploads and
 * are left out rather than guessed.
 * ------------------------------------------------------------------ */

const REAL_CHECKS = {
  pan: (e) => !!e.pan,
  aadhaar: (e) => !!e.aadhaar,
  photo: (e) => !!e.photo,
  bank: (e) => !!e.bank?.accountNumber,
}

const TRACKED = DOCUMENT_TYPES.filter((d) => REAL_CHECKS[d.id])
const collected = (e, doc) => REAL_CHECKS[doc.id](e)

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
      TRACKED.map((doc, i) => ({
        label: doc.label,
        value: roster.filter((e) => collected(e, doc, i)).length,
      })),
    [roster],
  )
  const totalCells = roster.length * TRACKED.length
  const totalDone = byDoc.reduce((a, b) => a + b.value, 0)
  const pct = totalCells ? Math.round((totalDone / totalCells) * 100) : 0

  const pending = useMemo(
    () =>
      roster
        .map((e) => ({
          e,
          missing: TRACKED.filter((doc, i) => !collected(e, doc, i)),
        }))
        .filter((r) => r.missing.length > 0)
        .sort((a, b) => b.missing.length - a.missing.length),
    [roster],
  )

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center gap-2.5 flex-wrap">
        <h1 className="font-display text-[28px] font-bold tracking-tight">Documents</h1>
      </div>
      <p className="text-[13px] text-ink-faint mt-0.5 max-w-2xl">
        Identity and banking details, read live from each person's record. Letters and certificates are not tracked
        until file uploads are added.
      </p>

      {roster.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-hairline shadow-card mt-5">
          <EmptyState icon={UsersThree} title="No files to track" hint="Add employees first." />
        </div>
      ) : (
        <motion.div variants={stagger(0.06)} initial="initial" animate="animate" className="mt-5 space-y-4">
          {/* Collection summary */}
          <div className="bg-surface rounded-2xl border border-hairline shadow-card px-5 py-4 sm:px-6 sm:py-5">
            <div className="flex flex-wrap items-start gap-x-10 gap-y-4">
              <Stat label="Collected" value={<><AnimatedNumber value={pct} />%</>} hint={`${totalDone} of ${totalCells} items`} />
              <div className="flex-1 min-w-64">
                <HBarList items={byDoc.slice(0, 5)} />
              </div>
            </div>
          </div>

          {/* Matrix */}
          <SectionCard title="Collection matrix">
            <div className="overflow-x-auto -mx-5 px-5">
              <table className="w-full border-collapse min-w-[520px]">
                <thead>
                  <tr className="text-[10.5px] uppercase tracking-[0.1em] text-ink-faint border-b border-hairline">
                    <th className="text-left py-2 pr-3 font-semibold">Employee</th>
                    {TRACKED.map((doc) => (
                      <th key={doc.id} className="px-2 py-2 font-semibold whitespace-nowrap">
                        {doc.label}
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
                      {TRACKED.map((doc, i) => {
                        const ok = collected(e, doc, i)
                        return (
                          <td key={doc.id} className="text-center px-1.5" title={`${doc.label}: ${ok ? 'on record' : 'missing'}`}>
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
                        : `${missing.length} items missing`}
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
