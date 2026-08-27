import { motion } from 'framer-motion'
import { ArrowRight, MapPin, SignOut, UsersThree } from '@phosphor-icons/react'
import { COMPANIES } from '../data/seed'
import { useEmployees } from '../store/EmployeeStore'
import { useEntity } from '../store/EntityContext'
import { useAuth } from '../store/AuthContext'
import { cx } from '../lib/utils'
import { ENTITY_LOGO } from '../components/logos'

/* Each entity is a full "door" into its own brand world. */
const DOOR = {
  noble: {
    wrap: 'bg-noble-soft text-ink',
    wash: 'radial-gradient(720px 420px at 30% 110%, rgb(59 56 151 / 0.16), transparent 65%)',
    sub: 'text-ink-soft',
    meta: 'text-ink-soft',
    rule: 'bg-noble/20',
    cta: 'text-noble',
    logoBox: 'bg-white/85',
  },
  ares: {
    wrap: 'bg-[#15100a] text-white',
    wash: 'radial-gradient(720px 420px at 70% 110%, rgb(212 175 55 / 0.14), transparent 65%)',
    sub: 'text-[#c9b98d]',
    meta: 'text-[#a3946f]',
    rule: 'bg-ares-gold/25',
    cta: 'text-ares-gold',
    logoBox: '',
  },
}

function Door({ company, count, onEnter, index }) {
  const d = DOOR[company.hue]
  const Logo = ENTITY_LOGO[company.hue]
  return (
    <motion.button
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: index * 0.12 }}
      onClick={() => onEnter(company.id)}
      className={cx(
        'group relative flex-1 hover:flex-[1.25] min-h-[50dvh] lg:min-h-0 overflow-hidden text-left cursor-pointer',
        'transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]',
        d.wrap,
      )}
    >
      <span aria-hidden className="absolute inset-0" style={{ background: d.wash }} />

      <div className="relative h-full flex flex-col justify-end p-8 sm:p-12 lg:p-14">
        <div
          className={cx(
            'w-fit rounded-2xl p-4 transition-transform duration-500 group-hover:-translate-y-1.5',
            d.logoBox,
          )}
        >
          <Logo className="h-12 sm:h-14 w-auto max-w-[300px] object-contain object-left" />
        </div>

        <p className={cx('text-[13.5px] mt-5 max-w-sm', d.sub)}>
          {company.brand && <span className="font-semibold">{company.brand} · </span>}
          {company.legalName}
        </p>

        <div className={cx('h-px w-24 my-5', d.rule)} />

        <div className={cx('flex items-center gap-5 text-[12.5px]', d.meta)}>
          {count > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <UsersThree size={14} /> {count} people
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <MapPin size={14} /> {company.branches.length}{' '}
            {company.branches.length === 1 ? 'branch' : 'branches'}
          </span>
        </div>

        <span
          className={cx(
            'inline-flex items-center gap-2 mt-6 text-[14px] font-semibold transition-all duration-300',
            'opacity-70 group-hover:opacity-100 group-hover:gap-3',
            d.cta,
          )}
        >
          Enter portal <ArrowRight size={16} weight="bold" />
        </span>
      </div>
    </motion.button>
  )
}

export default function PortalPicker() {
  const { enterPortal } = useEntity()
  const { logout } = useAuth()
  const { employees } = useEmployees()

  return (
    <div className="relative min-h-dvh flex flex-col lg:flex-row">
      {/* Top band — Stellar owns the software, not the data */}
      <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between px-6 sm:px-8 h-[68px] pointer-events-none">
        <div className="flex items-center gap-2.5 pointer-events-auto">
          <div className="size-8 rounded-[10px] bg-ink grid place-items-center">
            <span className="font-display font-black text-[15px] text-paper leading-none translate-y-px">
              S
            </span>
          </div>
          <div className="leading-tight">
            <p className="font-display font-bold text-[14px] tracking-tight text-ink">
              Stellar Apex
            </p>
          </div>
        </div>
        <button
          onClick={logout}
          className="pointer-events-auto inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-faint hover:text-ink transition-colors cursor-pointer bg-paper/70 backdrop-blur rounded-[10px] px-3 py-1.5"
        >
          <SignOut size={14} /> Sign out
        </button>
      </div>

      {/* Centered prompt overlapping both doors */}
      <div className="absolute z-10 inset-x-0 top-[16dvh] text-center px-4 pointer-events-none hidden lg:block">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="inline-block bg-paper/90 backdrop-blur rounded-2xl shadow-pop px-8 py-5"
        >
          <h1 className="font-display text-[28px] font-bold tracking-tight text-ink">
            Choose your portal
          </h1>
          <p className="text-[13px] text-ink-soft mt-1">
            Each entity is a separate workspace. Its people data stays inside its portal.
          </p>
        </motion.div>
      </div>

      {Object.values(COMPANIES).map((c, i) => (
        <Door
          key={c.id}
          company={c}
          index={i}
          count={employees.filter((e) => e.company === c.id && e.status !== 'exited').length}
          onEnter={enterPortal}
        />
      ))}
    </div>
  )
}
