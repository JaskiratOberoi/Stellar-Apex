import { motion } from 'framer-motion'
import { ArrowRight, MapPin, Sparkles, UsersRound } from 'lucide-react'
import { COMPANIES } from '../data/seed'
import { useEmployees } from '../store/EmployeeStore'
import { useEntity } from '../store/EntityContext'
import { cx } from '../lib/utils'
import { ENTITY_LOGO } from '../components/logos'

const HUE_STYLES = {
  noble: { ring: 'hover:border-noble/50', arrow: 'text-noble' },
  ares: { ring: 'hover:border-ares/50', arrow: 'text-ares' },
}

export default function PortalPicker() {
  const { enterPortal } = useEntity()
  const { employees } = useEmployees()

  return (
    <div className="min-h-dvh grid place-items-center px-4 py-10">
      <div className="w-full max-w-2xl">
        {/* Product brand — Stellar owns the software, not the data */}
        <div className="flex items-center justify-center gap-2.5 mb-2">
          <div className="size-9 rounded-xl bg-iris grid place-items-center text-white">
            <Sparkles size={17} strokeWidth={2.5} />
          </div>
          <div className="leading-tight">
            <p className="font-display font-bold text-[17px] tracking-tight">Stellar Apex</p>
            <p className="text-[10.5px] text-ink-faint uppercase tracking-[0.14em]">People OS</p>
          </div>
        </div>

        <h1 className="font-display text-[24px] font-bold tracking-tight text-center mt-8">
          Choose your portal
        </h1>
        <p className="text-[13.5px] text-ink-faint text-center mt-1 mb-8">
          Each entity is a separate workspace — its people data stays inside its portal.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Object.values(COMPANIES).map((c, i) => {
            const count = employees.filter(
              (e) => e.company === c.id && e.status !== 'exited',
            ).length
            const hue = HUE_STYLES[c.hue]
            const Logo = ENTITY_LOGO[c.hue]
            return (
              <motion.button
                key={c.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                onClick={() => enterPortal(c.id)}
                className={cx(
                  'group text-left bg-surface rounded-2xl border border-hairline shadow-card p-6 transition-all cursor-pointer hover:shadow-pop',
                  hue.ring,
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="h-11 flex items-center">
                    <Logo className="h-9 w-auto max-w-[190px] object-contain object-left" />
                  </div>
                  <ArrowRight
                    size={17}
                    className={cx(
                      'mt-1 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all',
                      hue.arrow,
                    )}
                  />
                </div>
                <p className="text-[13px] text-ink-soft mt-4">
                  {c.brand && <span className="font-semibold text-ink">{c.brand} · </span>}
                  {c.legalName}
                </p>
                <div className="flex items-center gap-4 mt-4 pt-4 border-t border-hairline text-[12px] text-ink-soft">
                  <span className="inline-flex items-center gap-1.5">
                    <UsersRound size={13} /> {count} people
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin size={13} /> {c.branches.length}{' '}
                    {c.branches.length === 1 ? 'branch' : 'branches'}
                  </span>
                </div>
              </motion.button>
            )
          })}
        </div>

        <p className="text-[11.5px] text-ink-faint text-center mt-8">
          Powered by Stellar Group · portal access will be tied to your sign-in once accounts land
        </p>
      </div>
    </div>
  )
}
