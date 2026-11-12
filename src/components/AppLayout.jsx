import { NavLink, useLocation, useNavigate, useOutlet, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowsLeftRight,
  CalendarCheck,
  Files,
  IdentificationCard,
  List,
  MagnifyingGlass,
  Plus,
  ShieldCheck,
  SignOut,
  SquaresFour,
  TreeStructure,
  UsersThree,
  Wallet,
  X,
} from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { canEdit, cx } from '../lib/utils'
import { DUR, EASE_IN, EASE_OUT, spring } from '../lib/motion'
import { HoldEntity, useEntity } from '../store/EntityContext'
import { useAuth } from '../store/AuthContext'
import { ENTITY_MARK } from './logos'
import { Button, Skeleton } from './kit'
import PortalPicker from '../pages/PortalPicker'
import Login from '../pages/Login'

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: SquaresFour },
  { to: '/people', label: 'People', icon: UsersThree },
  { to: '/org', label: 'Organisation', icon: TreeStructure },
  { to: '/onboarding', label: 'Onboarding', icon: IdentificationCard, staff: true },
  { to: '/attendance', label: 'Attendance', icon: CalendarCheck },
  { to: '/payroll', label: 'Payroll', icon: Wallet, staff: true },
  { to: '/documents', label: 'Documents', icon: Files },
]

const ROLE_LABEL = {
  super_admin: 'Super Admin',
  entity_admin: 'Admin',
  entity_hr: 'HR',
  viewer: 'Viewer',
}

function Rail({ onNavigate, layoutId }) {
  const { entity, exitPortal, canSwitch } = useEntity()
  const { user, logout } = useAuth()
  const Mark = ENTITY_MARK[entity.hue]
  const staff = canEdit(user)

  return (
    <div className="relative flex flex-col h-full overflow-hidden">
      {/* Product brand — typographic nameplate */}
      <div className="flex items-center gap-3 px-5 h-[68px] shrink-0">
        <div className="size-8 rounded-[10px] bg-surface grid place-items-center shrink-0">
          <span className="font-display font-black text-[15px] text-rail leading-none translate-y-px">S</span>
        </div>
        <div className="leading-tight">
          <p className="font-display font-bold text-[15px] text-white tracking-tight">Stellar Apex</p>
          <p className="text-[10.5px] text-rail-text uppercase tracking-[0.14em]">People OS</p>
        </div>
      </div>

      <div className="mx-5 h-px bg-rail-line shrink-0" />

      {/* Active entity portal */}
      <div className="px-3 pt-3">
        <div className="flex items-center gap-2.5 rounded-xl bg-rail-soft px-3 py-2.5">
          <div className="size-8 rounded-[10px] grid place-items-center shrink-0 bg-white">
            <Mark size={22} />
          </div>
          <div className="leading-tight min-w-0 flex-1">
            <p className="text-[12.5px] font-semibold text-white truncate">{entity.brand || entity.name}</p>
            <p className="text-[10.5px] text-rail-text truncate">{entity.legalName}</p>
          </div>
          {canSwitch && (
            <button
              onClick={exitPortal}
              className="p-1.5 rounded-lg text-rail-text hover:text-white hover:bg-white/10 active:scale-90 transition-[color,background-color,transform] cursor-pointer"
              title="Switch portal"
              aria-label="Switch portal"
            >
              <ArrowsLeftRight size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Nav — the paper tab slides to the active item */}
      <nav className="px-3 pt-5 flex-1 overflow-y-auto" aria-label="Workspace">
        <p className="px-3 pb-2 text-[10.5px] uppercase tracking-[0.14em] text-rail-text/70">Workspace</p>
        <ul className="space-y-1">
          {NAV.filter((n) => !n.staff || staff).map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                onClick={() => onNavigate?.()}
                className={({ isActive }) =>
                  cx(
                    'relative flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[13.5px] font-medium',
                    'transition-[color,transform] duration-[var(--dur-base)] active:scale-[0.98]',
                    isActive ? 'text-ink font-semibold' : 'text-rail-text hover:text-white',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive ? (
                      <motion.span layoutId={layoutId} transition={spring} className="absolute inset-0 rounded-[10px] bg-paper shadow-card" />
                    ) : (
                      <span className="absolute inset-0 rounded-[10px] bg-white/0 hover:bg-white/5 transition-colors" />
                    )}
                    <Icon size={17} weight={isActive ? 'fill' : 'regular'} className="relative" />
                    <span className="relative">{label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Signed-in user */}
      <div className="p-3 shrink-0">
        <div className="flex items-center gap-2.5 rounded-xl border border-rail-line pl-3 pr-1.5 py-2">
          <div className="size-[30px] rounded-[10px] bg-rail-soft grid place-items-center text-rail-text shrink-0">
            <ShieldCheck size={15} weight="fill" />
          </div>
          <div className="leading-tight min-w-0 flex-1">
            <p className="text-[12.5px] font-semibold text-white truncate">{user?.name || 'Administrator'}</p>
            <p className="text-[11px] text-rail-text truncate">
              {ROLE_LABEL[user?.role] || 'HR'} · {entity.name}
            </p>
          </div>
          <button
            onClick={logout}
            className="p-2 rounded-lg text-rail-text hover:text-white hover:bg-white/10 active:scale-90 transition-[color,background-color,transform] cursor-pointer"
            title="Sign out"
            aria-label="Sign out"
          >
            <SignOut size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

/* Top-bar search: types straight into the People list (?q=). */
function GlobalSearch() {
  const { entity } = useEntity()
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const onPeople = location.pathname === '/people'
  const value = onPeople ? params.get('q') || '' : ''

  const search = (text) => {
    const next = new URLSearchParams(onPeople ? params : undefined)
    if (text) next.set('q', text)
    else next.delete('q')
    navigate({ pathname: '/people', search: next.toString() }, { replace: onPeople })
  }

  return (
    <div className="relative flex-1 max-w-md">
      <MagnifyingGlass size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
      <input
        type="search"
        value={value}
        onChange={(e) => search(e.target.value)}
        placeholder={`Search ${entity.name} people…`}
        aria-label="Search people"
        className="w-full h-9 rounded-[10px] border border-hairline bg-surface pl-9 pr-3 text-[13px] outline-none hover:border-hairline-strong focus:border-accent focus:ring-2 focus:ring-accent/15 placeholder:text-ink-faint transition-[border-color,box-shadow] duration-[var(--dur-fast)]"
      />
    </div>
  )
}

/* The signed-in shell: rail, top bar and the routed page. Rendered inside
   <HoldEntity>, so `entity` is always set here, even while exiting. */
/* The signed-in shell: rail, top bar and the routed page. Always rendered
   inside <HoldEntity>, so `entity` is set here even while it animates out. */
function Shell() {
  const navigate = useNavigate()
  const location = useLocation()
  const outlet = useOutlet()
  const { user } = useAuth()
  const { entity } = useEntity()
  const [mobileNav, setMobileNav] = useState(false)

  // Close the drawer with Escape.
  useEffect(() => {
    if (!mobileNav) return
    const onKey = (e) => e.key === 'Escape' && setMobileNav(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mobileNav])

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1, transition: { duration: DUR.slow, ease: EASE_OUT } }}
      exit={{ opacity: 0, transition: { duration: DUR.base } }}
      className={cx('min-h-dvh flex', `portal-${entity.hue}`)}
    >
      {/* Desktop rail */}
      <aside className="no-print hidden lg:block w-60 shrink-0 bg-rail sticky top-0 h-dvh">
        <Rail layoutId="rail-tab" />
      </aside>

      {/* Mobile rail — slides in over a fading scrim */}
      <AnimatePresence>
        {mobileNav && (
          <div className="no-print lg:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Menu">
            <motion.div
              className="absolute inset-0 bg-ink/50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: DUR.base } }}
              exit={{ opacity: 0, transition: { duration: DUR.base } }}
              onClick={() => setMobileNav(false)}
            />
            <motion.aside
              className="absolute inset-y-0 left-0 w-64 bg-rail shadow-pop"
              initial={{ x: '-100%' }}
              animate={{ x: 0, transition: { duration: DUR.slow, ease: EASE_OUT } }}
              exit={{ x: '-100%', transition: { duration: DUR.base, ease: EASE_IN } }}
            >
              <button
                onClick={() => setMobileNav(false)}
                className="absolute top-5 right-3 z-10 p-1.5 rounded-lg text-rail-text hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
              <Rail layoutId="rail-tab-mobile" onNavigate={() => setMobileNav(false)} />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="no-print h-[68px] shrink-0 sticky top-0 z-40 bg-paper/85 backdrop-blur border-b border-hairline flex items-center gap-3 px-4 sm:px-6">
          <button
            className="lg:hidden -ml-1 p-1.5 rounded-lg hover:bg-hairline/60 active:scale-90 transition-[background-color,transform] cursor-pointer"
            onClick={() => setMobileNav(true)}
            aria-label="Open menu"
          >
            <List size={19} />
          </button>

          <GlobalSearch />

          {canEdit(user) && (
            <Button className="ml-auto" icon={Plus} onClick={() => navigate('/people/new')}>
              <span className="hidden sm:inline">Add employee</span>
            </Button>
          )}
        </header>

        {/* Route change: the outgoing page fades, the incoming one rises
            (each page animates its own entrance). */}
        <main className="flex-1 px-4 sm:px-6 py-6 print:p-0">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={location.pathname} exit={{ opacity: 0, transition: { duration: DUR.fast, ease: EASE_IN } }}>
              {outlet}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </motion.div>
  )
}

export default function AppLayout() {
  const { user, ready } = useAuth()
  const { entity } = useEntity()

  // Which of the three top-level screens is showing: they cross-fade.
  const stage = !ready ? 'boot' : !user ? 'login' : !entity ? 'picker' : 'app'

  return (
    <AnimatePresence mode="wait" initial={false}>
      {stage === 'boot' && (
        // No exit animation: the first paint of the app must never wait on one
        // (a background tab gets no animation frames).
        <div key="boot" className="min-h-dvh grid place-items-center">
          <div className="w-56 space-y-2.5" role="status" aria-label="Loading">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
      )}

      {stage === 'login' && (
        <motion.div key="login" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: DUR.slow } }} exit={{ opacity: 0, transition: { duration: DUR.base } }}>
          <Login />
        </motion.div>
      )}

      {stage === 'picker' && (
        <motion.div
          key="picker"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: DUR.slow } }}
          exit={{ opacity: 0, scale: 1.04, transition: { duration: DUR.slow, ease: EASE_IN } }}
        >
          <PortalPicker />
        </motion.div>
      )}

      {stage === 'app' && (
        <HoldEntity key="app">
          <Shell />
        </HoldEntity>
      )}
    </AnimatePresence>
  )
}
