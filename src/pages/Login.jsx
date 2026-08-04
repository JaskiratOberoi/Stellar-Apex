import { useState } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, LogIn, Loader2 } from 'lucide-react'
import { useAuth } from '../store/AuthContext'

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
    <div className="relative min-h-dvh grid place-items-center px-4 py-10 overflow-hidden">
      {/* Aurora backdrop */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[680px] h-[420px] rounded-full bg-iris/15 blur-3xl" />
        <div className="absolute top-1/3 -left-32 w-[420px] h-[320px] rounded-full bg-aurora/10 blur-3xl" />
        <div className="absolute -bottom-36 right-[6%] w-[460px] h-[320px] rounded-full bg-rose-soft blur-3xl opacity-60" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-sm"
      >
        {/* Product brand */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="size-10 rounded-xl bg-gradient-to-br from-iris to-aurora grid place-items-center text-white shadow-glow">
            <Sparkles size={18} strokeWidth={2.5} />
          </div>
          <div className="leading-tight">
            <p className="font-display font-bold text-[19px] tracking-tight aurora-text">Stellar Apex</p>
            <p className="text-[10.5px] text-ink-faint uppercase tracking-[0.16em]">People OS</p>
          </div>
        </div>

        <div className="bg-surface/90 backdrop-blur rounded-2xl border border-hairline shadow-pop p-6">
          <h1 className="font-display text-[20px] font-bold tracking-tight">Sign in</h1>
          <p className="text-[12.5px] text-ink-faint mt-1 mb-5">
            Your portal is determined by your account.
          </p>

          <form onSubmit={submit} className="space-y-3.5">
            <label className="block">
              <span className="text-[12px] font-medium text-ink-soft">Email</span>
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1 w-full h-10 rounded-xl border border-hairline bg-paper px-3 text-[13.5px] outline-none focus:border-iris focus:ring-2 focus:ring-iris/15"
                placeholder="you@company.in"
              />
            </label>
            <label className="block">
              <span className="text-[12px] font-medium text-ink-soft">Password</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-1 w-full h-10 rounded-xl border border-hairline bg-paper px-3 text-[13.5px] outline-none focus:border-iris focus:ring-2 focus:ring-iris/15"
                placeholder="••••••••"
              />
            </label>

            {error && (
              <p className="text-[12.5px] text-rose-ink bg-rose-soft rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full h-10 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-iris to-iris-deep hover:brightness-110 disabled:opacity-60 text-white text-[13.5px] font-semibold shadow-glow transition-all cursor-pointer"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        {/* Dev-only credential hint */}
        {import.meta.env.DEV && (
          <div className="mt-5 text-[11.5px] text-ink-faint bg-paper border border-hairline rounded-xl p-3.5 space-y-1">
            <p className="font-semibold text-ink-soft">Demo accounts · password <span className="font-mono">Apex@1234</span></p>
            <p><span className="font-mono">hr@noblediagnostics.in</span> — Noble (Qugen)</p>
            <p><span className="font-mono">hr@areshealthcare.in</span> — Ares</p>
            <p><span className="font-mono">admin@stellarapex.local</span> — super admin (both)</p>
          </div>
        )}
      </motion.div>
    </div>
  )
}
