import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  ArrowsLeftRight,
  CalendarCheck,
  Files,
  List,
  MagnifyingGlass,
  Plus,
  ShieldCheck,
  SquaresFour,
  TreeStructure,
  UsersThree,
  Wallet,
  X,
} from '@phosphor-icons/react'
import { useState } from 'react'
import { cx } from '../lib/utils'
import { useEntity } from '../store/EntityContext'
import { useAuth } from '../store/AuthContext'
import { ENTITY_MARK } from './logos'
import PortalPicker from '../pages/PortalPicker'
import Login from '../pages/Login'

const NAV = [
  { to: '/people', label: 'People', icon: UsersThree },
  { to: '/org', label: 'Org chart', icon: TreeStructure },
  { to: '/dashboard', label: 'Dashboard', icon: SquaresFour, soon: true },
  { to: '/attendance', label: 'Attendance', icon: CalendarCheck, soon: true },
  { to: '/payroll', label: 'Payroll', icon: Wallet, soon: true },
  { to: '/documents', label: 'Documents', icon: Files, soon: true },
]

const ROLE_LABEL = {
  super_admin: 'Super Admin',
  entity_admin: 'Admin',
  entity_hr: 'HR',
  viewer: 'Viewer',
}

function Rail({ onNavigate }) {
  const { entity, exitPortal, canSwitch } = useEntity()
  const { user } = useAuth()
  const Mark = ENTITY_MARK[entity.hue]

  return (
    <div className="relative flex flex-col h-full overflow-hidden">
      {/* Product brand — typographic nameplate */}
      <div className="flex items-center gap-3 px-5 h-[68px] shrink-0">
        <div className="size-8 rounded-[10px] bg-surface grid place-items-center shrink-0">
          <span className="font-display font-black text-[15px] text-rail leading-none translate-y-px">
            S
          </span>
        </div>
        <div className="leading-tight">
          <p className="font-display font-bold text-[15px] text-white tracking-tight">
            Stellar Apex
          </p>
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
            <p className="text-[12.5px] font-semibold text-white truncate">
              {entity.name}
              {entity.brand && <span className="text-rail-text"> · {entity.brand}</span>}
            </p>
            <p className="text-[10.5px] text-rail-text truncate">Entity portal</p>
          </div>
          <button
            onClick={exitPortal}
            className="p-1.5 rounded-lg text-rail-text hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title={canSwitch ? 'Switch portal' : 'Sign out'}
          >
            <ArrowsLeftRight size={13} />
          </button>
        </div>
      </div>

      {/* Nav — active item becomes a paper tab */}
      <nav className="px-3 pt-5 flex-1">
        <p className="px-3 pb-2 text-[10.5px] uppercase tracking-[0.14em] text-rail-text/70">
          Workspace
        </p>
        <ul className="space-y-1">
          {NAV.map(({ to, label, icon: Icon, soon }) => (
            <li key={to}>
              <NavLink
                to={to}
                onClick={(e) => {
                  if (soon) e.preventDefault()
                  else onNavigate?.()
                }}
                className={({ isActive }) =>
                  cx(
                    'flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[13.5px] font-medium transition-all duration-200',
                    !soon && isActive
                      ? 'bg-paper text-ink shadow-card font-semibold'
                      : soon
                        ? 'text-rail-text/45 cursor-default'
                        : 'text-rail-text hover:bg-white/5 hover:text-white active:scale-[0.98]',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon size={17} weight={!soon && isActive ? 'fill' : 'regular'} />
                    {label}
                    {soon && (
                      <span className="ml-auto text-[9.5px] font-semibold uppercase tracking-[0.1em] text-rail-text/60">
                        Soon
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Signed-in user */}
      <div className="p-3 shrink-0">
        <div className="flex items-center gap-2.5 rounded-xl border border-rail-line px-3 py-2.5">
          <div className="size-[30px] rounded-[10px] bg-rail-soft grid place-items-center text-rail-text shrink-0">
            <ShieldCheck size={15} weight="fill" />
          </div>
          <div className="leading-tight min-w-0">
            <p className="text-[12.5px] font-semibold text-white truncate">
              {user?.name || 'Administrator'}
            </p>
            <p className="text-[11px] text-rail-text truncate">
              {ROLE_LABEL[user?.role] || 'HR'} · {entity.name}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AppLayout() {
  const navigate = useNavigate()
  const { user, ready } = useAuth()
  const { entity } = useEntity()
  const [mobileNav, setMobileNav] = useState(false)

  // Restoring the session (validating a stored token) — avoid a flash of login.
  if (!ready) {
    return <div className="min-h-dvh grid place-items-center text-ink-faint text-[13px]">Loading…</div>
  }
  // Not signed in → the login screen is the only thing that renders.
  if (!user) return <Login />
  // Signed in but no entity resolved (super_admin who hasn't picked) → picker.
  if (!entity) return <PortalPicker />

  return (
    <div className={cx('min-h-dvh flex', `portal-${entity.hue}`)}>
      {/* Desktop rail */}
      <aside className="hidden lg:block w-60 shrink-0 bg-rail sticky top-0 h-dvh">
        <Rail />
      </aside>

      {/* Mobile rail */}
      {mobileNav && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-ink/50" onClick={() => setMobileNav(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-rail shadow-pop">
            <button
              onClick={() => setMobileNav(false)}
              className="absolute top-4 right-3 text-rail-text hover:text-white"
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
            <Rail onNavigate={() => setMobileNav(false)} />
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-[68px] shrink-0 sticky top-0 z-40 bg-paper/85 backdrop-blur border-b border-hairline flex items-center gap-3 px-4 sm:px-6">
          <button
            className="lg:hidden -ml-1 p-1.5 rounded-lg hover:bg-hairline/60"
            onClick={() => setMobileNav(true)}
            aria-label="Open menu"
          >
            <List size={19} />
          </button>

          <div className="relative flex-1 max-w-md">
            <MagnifyingGlass
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
            />
            <input
              placeholder={`Search ${entity.name} people…`}
              className="w-full h-9 rounded-[10px] border border-hairline bg-surface pl-9 pr-3 text-[13px] outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 placeholder:text-ink-faint transition-colors"
              onFocus={() => navigate('/people')}
            />
          </div>

          <button
            onClick={() => navigate('/people/new')}
            className="ml-auto inline-flex items-center gap-1.5 h-9 rounded-[10px] bg-accent hover:bg-accent-deep active:scale-[0.98] text-white text-[13px] font-semibold px-3.5 transition-all cursor-pointer"
          >
            <Plus size={15} weight="bold" />
            <span className="hidden sm:inline">Add employee</span>
          </button>
        </header>

        <main className="flex-1 px-4 sm:px-6 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
