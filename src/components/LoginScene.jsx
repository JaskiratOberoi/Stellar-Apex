import { useEffect } from 'react'
import { animate, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion'
import { CheckCircle, Lock, TreeStructure } from '@phosphor-icons/react'
import { cx } from '../lib/utils'
import { EASE_OUT } from '../lib/motion'

/* ------------------------------------------------------------------
 * The sign-in page's 3D scene: the product's three records (attendance
 * register, salary sheet, organisation) as sheets floating at different
 * depths. The whole stage leans toward the pointer; each sheet bobs on
 * its own clock. Purely decorative, so it is hidden from assistive tech.
 * Looping motion is CSS (see "Sign-in scene" in index.css) and stops
 * under prefers-reduced-motion; the pointer tilt is skipped there too.
 * ------------------------------------------------------------------ */

const TILT = { x: 16, y: -22 } // resting lean of the stage, in degrees

// A believable month: mostly present, a few leaves, weekly offs on the 7th column.
const CELLS = 'PPPPPPWPPAPPPWPPPPLPWPHPPPPW'.split('')
const CELL_TONE = {
  P: 'bg-[#4fc493]',
  A: 'bg-[#f08aa2]',
  L: 'bg-[#9a97f5]',
  H: 'bg-[#e3bd5c]',
  W: 'bg-white/12',
}

/* One sheet: depth comes from the outer layer, the entrance from the middle
 * one, and the endless bob from the inner one, so the three never fight
 * over the same transform. */
function Sheet({ z, order, bob = 7, className, children }) {
  return (
    <div className={cx('absolute [transform-style:preserve-3d]', className)} style={{ transform: `translateZ(${z}px)` }}>
      <motion.div
        initial={{ opacity: 0, y: 46, rotateX: -24 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ duration: 0.9, delay: 0.15 + order * 0.13, ease: EASE_OUT }}
        className="[transform-style:preserve-3d]"
      >
        <div className="login-bob" style={{ '--bob': `${bob}s`, '--bob-delay': `${order * -1.7}s` }}>
          {children}
        </div>
      </motion.div>
    </div>
  )
}

const GLASS = 'rounded-2xl border border-white/14 bg-[linear-gradient(145deg,rgb(255_255_255/0.13),rgb(255_255_255/0.04))] shadow-[0_30px_60px_-24px_rgb(0_0_0/0.65)]'
const EYEBROW = 'text-[9px] uppercase tracking-[0.16em] font-semibold text-white/55'

function NetPay() {
  const value = useMotionValue(0)
  const text = useTransform(value, (v) => Math.round(v).toLocaleString('en-IN'))
  useEffect(() => {
    const controls = animate(value, 1842650, { duration: 2.2, delay: 0.9, ease: EASE_OUT })
    return () => controls.stop()
  }, [value])
  return <motion.span>{text}</motion.span>
}

export default function LoginScene({ className }) {
  const reduced = useReducedMotion()
  const px = useMotionValue(0)
  const py = useMotionValue(0)
  const rotateY = useSpring(useTransform(px, [-1, 1], [TILT.y - 9, TILT.y + 9]), { stiffness: 60, damping: 16 })
  const rotateX = useSpring(useTransform(py, [-1, 1], [TILT.x + 7, TILT.x - 7]), { stiffness: 60, damping: 16 })

  useEffect(() => {
    if (reduced) return
    const move = (e) => {
      px.set((e.clientX / window.innerWidth) * 2 - 1)
      py.set((e.clientY / window.innerHeight) * 2 - 1)
    }
    window.addEventListener('pointermove', move, { passive: true })
    return () => window.removeEventListener('pointermove', move)
  }, [reduced, px, py])

  return (
    <div aria-hidden className={cx('relative select-none pointer-events-none', className)} style={{ perspective: 1100 }}>
      {/* soft light behind the stage */}
      <div className="login-glow absolute left-1/2 top-1/2 size-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(79_196_147/0.30),transparent)]" />

      {/* The stage is drawn at one size and scaled down on shorter or narrower panels. */}
      <div className="absolute inset-0 [transform-style:preserve-3d] scale-[0.74] xl:scale-[0.9] 2xl:scale-100 [@media(max-height:720px)]:scale-[0.7]">
      <motion.div className="absolute left-1/2 top-1/2 w-[400px] h-[330px] -ml-[176px] -mt-[160px] [transform-style:preserve-3d]" style={{ rotateX, rotateY }}>
        {/* orbit rings, far back */}
        <div className="absolute inset-0 [transform-style:preserve-3d]" style={{ transform: 'translateZ(-150px) rotateX(48deg)' }}>
          <div className="login-orbit absolute -inset-8 rounded-full border border-white/20">
            <span className="absolute -top-[5px] left-1/2 size-[10px] rounded-full bg-[#e3bd5c] shadow-[0_0_18px_4px_rgb(227_189_92/0.55)]" />
          </div>
          <div className="login-orbit absolute inset-10 rounded-full border border-dashed border-white/22" style={{ animationDirection: 'reverse', animationDuration: '26s' }}>
            <span className="absolute -bottom-1 left-1/2 size-2 rounded-full bg-[#9a97f5] shadow-[0_0_16px_4px_rgb(154_151_245/0.55)]" />
          </div>
        </div>

        {/* attendance register */}
        <Sheet z={-20} order={0} bob={8} className="left-0 top-[18px]">
          <div className={cx(GLASS, 'w-[262px] p-4')}>
            <div className="flex items-center justify-between">
              <p className={EYEBROW}>Attendance · this month</p>
              <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-[#7fe0b6]">
                <span className="login-blink size-1.5 rounded-full bg-[#4fc493]" /> Live
              </span>
            </div>
            <div className="grid grid-cols-7 gap-[5px] mt-3">
              {CELLS.map((c, i) => (
                <span key={i} className={cx('login-cell h-[22px] rounded-[5px]', CELL_TONE[c])} style={{ animationDelay: `${(i % 7) * 0.16 + Math.floor(i / 7) * 0.22}s` }} />
              ))}
            </div>
            <div className="flex items-center gap-3 mt-3 text-[9.5px] text-white/55 font-mono">
              <span><span className="text-white font-semibold">96%</span> present</span>
              <span><span className="text-white font-semibold">2</span> on leave</span>
            </div>
          </div>
        </Sheet>

        {/* salary sheet */}
        <Sheet z={80} order={1} bob={6.5} className="right-[-44px] bottom-[-34px]">
          <div className={cx(GLASS, 'w-[214px] p-4')}>
            <p className={EYEBROW}>Salary sheet · net pay</p>
            <p className="font-display font-bold text-[25px] tracking-tight leading-none mt-2 tabular-nums">
              <span className="text-white/55 text-[16px] mr-0.5">₹</span>
              <NetPay />
            </p>
            <div className="space-y-[7px] mt-3.5">
              {[
                ['Earnings', 0.92, 'bg-[#4fc493]'],
                ['Deductions', 0.34, 'bg-[#f08aa2]'],
                ['Paid out', 0.71, 'bg-[#9a97f5]'],
              ].map(([label, w, tone], i) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="w-[58px] text-[8.5px] text-white/55">{label}</span>
                  <span className="flex-1 h-[5px] rounded-full bg-white/10 overflow-hidden">
                    <span className={cx('login-bar block h-full rounded-full origin-left', tone)} style={{ width: `${w * 100}%`, animationDelay: `${1 + i * 0.18}s` }} />
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Sheet>

        {/* organisation */}
        <Sheet z={150} order={2} bob={7.5} className="right-[-18px] top-[-14px]">
          <div className={cx(GLASS, 'w-[150px] p-3.5')}>
            <p className={cx(EYEBROW, 'flex items-center gap-1.5')}>
              <TreeStructure size={11} weight="bold" /> Organisation
            </p>
            <svg viewBox="0 0 120 62" className="mt-2.5 w-full overflow-visible" fill="none">
              <path className="login-wire" d="M60 14 V30 M60 30 H22 V44 M60 30 H98 V44 M60 30 V44" stroke="rgb(255 255 255 / 0.4)" strokeWidth="1.2" strokeLinecap="round" />
              <circle cx="60" cy="9" r="7" fill="#e3bd5c" />
              <circle cx="22" cy="51" r="6" fill="#4fc493" />
              <circle cx="60" cy="51" r="6" fill="#9a97f5" />
              <circle cx="98" cy="51" r="6" fill="#f08aa2" />
              <circle className="login-ping" cx="60" cy="9" r="7" stroke="#e3bd5c" strokeWidth="1.5" />
            </svg>
          </div>
        </Sheet>

        {/* loose chips, nearest the viewer */}
        <Sheet z={215} order={3} bob={5.5} className="left-[96px] bottom-[-10px]">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white text-[#0f231b] pl-2 pr-3 py-1.5 text-[10.5px] font-semibold shadow-[0_18px_34px_-12px_rgb(0_0_0/0.7)]">
            <Lock size={12} weight="fill" className="text-[#1b6a4a]" /> Month locked
          </div>
        </Sheet>
        <Sheet z={230} order={4} bob={6} className="right-[-52px] top-[132px]">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#4fc493] text-[#06281a] pl-2 pr-3 py-1.5 text-[10.5px] font-bold shadow-[0_18px_34px_-12px_rgb(0_0_0/0.7)]">
            <CheckCircle size={13} weight="fill" /> Paid
          </div>
        </Sheet>
      </motion.div>
      </div>
    </div>
  )
}
