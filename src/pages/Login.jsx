import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { SignIn } from '@phosphor-icons/react'
import { collapse, item, stagger } from '../lib/motion'
import { Button } from '../components/kit'
import { useAuth } from '../store/AuthContext'
import { NobleMark, AresMark } from '../components/logos'

export default function Login() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(email.trim(), password)
    } catch (err) {
      setError(err.status === 401 ? 'Invalid email or password.' : err.message)
      setBusy(false)
    }
  }

  return (
    <div className="min-h-dvh flex flex-col lg:flex-row">
      {/* ---- Brand panel ---- */}
      <div className="relative lg:w-[46%] xl:w-[42%] shrink-0 bg-rail text-white flex flex-col justify-between px-8 py-8 lg:px-12 lg:py-12 overflow-hidden">
        {/* Ledger rules — faint horizontal lines, like a paper register */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(to bottom, transparent 0, transparent 39px, #fff 39px, #fff 40px)',
          }}
        />

        <div className="relative flex items-center gap-3">
          <div className="size-9 rounded-[11px] bg-surface grid place-items-center">
            <span className="font-display font-black text-[17px] text-rail leading-none translate-y-px">
              S
            </span>
          </div>
          <div className="leading-tight">
            <p className="font-display font-bold text-[16px] tracking-tight">Stellar Apex</p>
            <p className="text-[10.5px] text-rail-text uppercase tracking-[0.16em]">People OS</p>
          </div>
        </div>

        <motion.div variants={stagger(0.09)} initial="initial" animate="animate" className="relative py-10 lg:py-0">
          <motion.h1 variants={item} className="font-display font-bold tracking-tight text-[clamp(28px,3.4vw,44px)] leading-[1.08] max-w-md text-balance">
            Every person, every branch, one register.
          </motion.h1>
          <motion.p variants={item} className="text-rail-text text-[14px] leading-relaxed mt-4 max-w-sm">
            People, attendance and payroll for Noble Diagnostics and Ares Labs, kept private to each portal.
          </motion.p>
        </motion.div>

        <div className="relative hidden lg:flex items-center gap-3">
          <div className="size-9 rounded-[11px] bg-white grid place-items-center">
            <NobleMark size={24} />
          </div>
          <div className="size-9 rounded-[11px] bg-white grid place-items-center">
            <AresMark size={24} />
          </div>
          <p className="text-[11.5px] text-rail-text ml-1">
            Noble Diagnostics · Ares Labs
          </p>
        </div>
      </div>

      {/* ---- Form panel ---- */}
      <div className="flex-1 grid place-items-center px-4 py-10 lg:px-8">
        <motion.div variants={stagger(0.06)} initial="initial" animate="animate" className="w-full max-w-sm">
          <motion.h2 variants={item} className="font-display text-[24px] font-bold tracking-tight">Sign in</motion.h2>
          <motion.p variants={item} className="text-[13px] text-ink-faint mt-1 mb-7">
            Your portal is determined by your account.
          </motion.p>

          <motion.form variants={item} onSubmit={submit} className="space-y-4">
            <label className="block">
              <span className="text-[12.5px] font-semibold text-ink-soft">Email</span>
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1.5 w-full h-11 rounded-[10px] border border-hairline bg-surface px-3.5 text-[14px] outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 placeholder:text-ink-faint transition-colors"
                placeholder="you@company.in"
              />
            </label>
            <label className="block">
              <span className="text-[12.5px] font-semibold text-ink-soft">Password</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-1.5 w-full h-11 rounded-[10px] border border-hairline bg-surface px-3.5 text-[14px] outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 placeholder:text-ink-faint transition-colors"
                placeholder="Your password"
              />
            </label>

            <AnimatePresence initial={false}>
              {error && (
                <motion.div key="error" {...collapse} className="overflow-hidden" role="alert">
                  <p className="text-[12.5px] text-rose-ink bg-rose-soft rounded-[10px] px-3 py-2">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <Button type="submit" size="lg" icon={SignIn} loading={busy} className="w-full">
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </motion.form>

          {/* Dev-only credential hint */}
          {import.meta.env.DEV && (
            <div className="mt-7 text-[11.5px] text-ink-faint border border-hairline rounded-xl p-3.5 space-y-1 bg-surface">
              <p className="font-semibold text-ink-soft">
                Demo accounts · password <span className="font-mono">Apex@1234</span>
              </p>
              <p><span className="font-mono">hr@noblediagnostics.in</span> · Noble Diagnostics</p>
              <p><span className="font-mono">hr@areshealthcare.in</span> · Ares</p>
              <p><span className="font-mono">admin@stellarapex.local</span> · super admin (both)</p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
