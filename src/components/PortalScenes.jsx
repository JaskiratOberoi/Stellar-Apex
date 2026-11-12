import { CheckCircle, Drop, GearSix, Pulse } from '@phosphor-icons/react'
import { cx } from '../lib/utils'
import { Box, Sheet, Stage } from './scene3d'

/* ------------------------------------------------------------------
 * The portal doors' 3D scenes, one per entity.
 *   Noble (diagnostics lab): a turning DNA helix, a lab report, a rack
 *   of sample tubes.
 *   Ares (medical machines and IVD instruments): an analyser with a
 *   spinning sample carousel, its readout and a turning gear.
 * Decorative only. Every figure shown is illustrative, not live data.
 * ------------------------------------------------------------------ */

const SCALE = 'scale-[0.62] xl:scale-[0.8] 2xl:scale-100 [@media(max-height:720px)]:scale-[0.56]'

/* ============================ Noble ============================ */

const RUNGS = 13
const TUBES = [
  ['#d9486e', 62],
  ['#6f6ce0', 78],
  ['#e0a43a', 48],
  ['#2a9d8f', 70],
]
const NOBLE_CARD = 'rounded-2xl border border-white bg-white/80 shadow-[0_28px_50px_-22px_rgb(45_43_120/0.45)]'
const NOBLE_EYEBROW = 'text-[9px] uppercase tracking-[0.16em] font-semibold text-noble/60'

function Helix() {
  return (
    <div className="scene-spin-y relative w-[92px] [transform-style:preserve-3d]" style={{ height: RUNGS * 19 }}>
      {Array.from({ length: RUNGS }, (_, i) => (
        <div key={i} className="absolute left-0 w-full h-[10px] [transform-style:preserve-3d]" style={{ top: i * 19, transform: `rotateY(${i * 28}deg)` }}>
          <span className="absolute left-[9px] right-[9px] top-[4px] h-[2px] rounded-full bg-noble/25" />
          <span className="absolute left-0 top-0 size-[10px] rounded-full bg-[radial-gradient(circle_at_30%_30%,#8f8cf0,#3b3897)] shadow-[0_3px_8px_rgb(59_56_151/0.45)]" />
          <span className="absolute right-0 top-0 size-[10px] rounded-full bg-[radial-gradient(circle_at_30%_30%,#f29ab0,#d9486e)] shadow-[0_3px_8px_rgb(217_72_110/0.4)]" />
        </div>
      ))}
    </div>
  )
}

export function NobleScene({ className }) {
  return (
    <Stage className={className} scaleClass={SCALE} rest={{ x: 12, y: 20 }}>
      <div className="login-glow absolute left-1/2 top-1/2 size-[440px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(111_108_224/0.28),transparent)]" style={{ transform: 'translateZ(-160px)' }} />

      {/* orbit, far back */}
      <div className="absolute inset-0 [transform-style:preserve-3d]" style={{ transform: 'translateZ(-150px) rotateX(52deg)' }}>
        <div className="login-orbit absolute -inset-6 rounded-full border border-noble/20">
          <span className="absolute -top-[5px] left-1/2 size-[10px] rounded-full bg-[#d9486e] shadow-[0_0_16px_4px_rgb(217_72_110/0.4)]" />
        </div>
      </div>

      {/* DNA helix */}
      <Sheet z={40} order={0} bob={9} className="left-[36px] top-[34px]">
        <Helix />
      </Sheet>

      {/* lab report */}
      <Sheet z={-10} order={1} bob={8} className="right-[-6px] top-[4px]">
        <div className={cx(NOBLE_CARD, 'w-[214px] p-4')}>
          <div className="flex items-center justify-between">
            <p className={NOBLE_EYEBROW}>Lab report · CBC</p>
            <Pulse size={13} weight="bold" className="text-noble" />
          </div>
          <svg viewBox="0 0 180 40" className="mt-2 w-full" fill="none">
            <path className="scene-draw" pathLength="100" d="M0 22 H34 l7 -15 l9 30 l8 -24 l6 9 H98 l7 -11 l7 11 H132 l6 -17 l8 26 l6 -9 H180" stroke="#3b3897" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="space-y-[7px] mt-2">
            {[
              ['Haemoglobin', 0.74],
              ['Platelets', 0.58],
              ['WBC count', 0.66],
            ].map(([label, w], i) => (
              <div key={label} className="flex items-center gap-2">
                <span className="w-[66px] text-[8.5px] font-medium text-ink-soft">{label}</span>
                <span className="flex-1 h-[5px] rounded-full bg-noble/12 overflow-hidden">
                  <span className="login-bar block h-full rounded-full origin-left bg-noble" style={{ width: `${w * 100}%`, animationDelay: `${0.9 + i * 0.2}s` }} />
                </span>
                <CheckCircle size={11} weight="fill" className="text-[#2a9d8f]" />
              </div>
            ))}
          </div>
        </div>
      </Sheet>

      {/* sample tubes */}
      <Sheet z={120} order={2} bob={6.5} className="right-[34px] bottom-[-8px]">
        <div className={cx(NOBLE_CARD, 'px-4 pt-3 pb-3.5')}>
          <p className={NOBLE_EYEBROW}>Samples</p>
          <div className="flex items-end gap-2.5 mt-2.5">
            {TUBES.map(([color, level], i) => (
              <span key={color} className="relative block w-[15px] h-[58px] rounded-b-full rounded-t-[3px] border-[1.5px] border-noble/35 bg-white/70 overflow-hidden">
                <span className="scene-liquid absolute inset-x-0 bottom-0 origin-bottom" style={{ height: `${level}%`, background: color, animationDelay: `${i * -0.9}s` }} />
                <span className="absolute left-[2px] top-[6px] w-[2px] h-[26px] rounded-full bg-white/70" />
              </span>
            ))}
          </div>
        </div>
      </Sheet>

      {/* loose pieces, nearest the viewer */}
      <Sheet z={200} order={3} bob={5.5} className="left-[150px] bottom-[26px]">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-noble text-white pl-2 pr-3 py-1.5 text-[10.5px] font-semibold shadow-[0_16px_30px_-12px_rgb(45_43_120/0.7)]">
          <CheckCircle size={13} weight="fill" /> Report ready
        </div>
      </Sheet>
      <Sheet z={170} order={4} bob={6} className="left-[150px] top-[6px]">
        <div className="grid place-items-center size-9 rounded-full bg-white shadow-[0_14px_26px_-10px_rgb(217_72_110/0.6)]">
          <Drop size={18} weight="fill" className="text-[#d9486e]" />
        </div>
      </Sheet>
    </Stage>
  )
}

/* ============================ Ares ============================ */

const SLOTS = 10
const ARES_CARD = 'rounded-2xl border border-ares-gold/25 bg-[linear-gradient(145deg,rgb(212_175_55/0.16),rgb(212_175_55/0.04))] shadow-[0_30px_60px_-24px_rgb(0_0_0/0.8)]'
const ARES_EYEBROW = 'text-[9px] uppercase tracking-[0.16em] font-semibold text-ares-gold/70'

/* Ring of sample cups that turns on top of the analyser. */
function Carousel() {
  return (
    <div className="scene-spin-y relative size-0 [transform-style:preserve-3d]" style={{ animationDuration: '11s' }}>
      <span className="absolute -left-[56px] -top-[56px] size-[112px] rounded-full border border-ares-gold/60 bg-[radial-gradient(circle,#8a7030,#3a2e15)]" style={{ transform: 'rotateX(90deg)' }} />
      {Array.from({ length: SLOTS }, (_, i) => (
        <span key={i} className="absolute -left-[7px] -top-[36px] w-[14px] h-[36px] [transform-style:preserve-3d]" style={{ transform: `rotateY(${(360 / SLOTS) * i}deg) translateZ(44px)` }}>
          <span className={cx('block size-full rounded-b-full rounded-t-[2px] border border-ares-gold/60', i % 3 === 0 ? 'bg-[#d9486e]' : i % 3 === 1 ? 'bg-ares-gold' : 'bg-[#f3e6b8]')} />
        </span>
      ))}
    </div>
  )
}

function AnalyserFront() {
  return (
    <div className="flex items-center gap-3 h-full px-3.5">
      {/* screen */}
      <div className="flex-1 h-[62px] rounded-[7px] bg-[#0b0804] border border-ares-gold/30 px-2 py-1.5 overflow-hidden">
        <p className="text-[6.5px] uppercase tracking-[0.16em] font-semibold text-ares-gold/70">Assay · run 24</p>
        <svg viewBox="0 0 120 30" className="w-full mt-0.5" fill="none">
          <path className="scene-draw" pathLength="100" d="M0 24 C14 24 16 6 28 6 S44 22 56 20 S72 4 84 8 S104 22 120 12" stroke="#d4af37" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
      {/* controls */}
      <div className="flex flex-col items-center gap-2">
        <span className="login-blink size-[7px] rounded-full bg-[#4fc493] shadow-[0_0_10px_2px_rgb(79_196_147/0.7)]" />
        <span className="login-blink size-[7px] rounded-full bg-ares-gold shadow-[0_0_10px_2px_rgb(212_175_55/0.6)]" style={{ animationDelay: '-0.8s' }} />
        <span className="w-[22px] h-[5px] rounded-full bg-black/60 border border-ares-gold/25" />
      </div>
    </div>
  )
}

export function AresScene({ className }) {
  return (
    <Stage className={className} scaleClass={SCALE} rest={{ x: -20, y: -28 }}>
      <div className="login-glow absolute left-1/2 top-1/2 size-[440px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(212_175_55/0.22),transparent)]" style={{ transform: 'translateZ(-160px)' }} />

      {/* orbit, far back */}
      <div className="absolute inset-0 [transform-style:preserve-3d]" style={{ transform: 'translateZ(-150px) rotateX(52deg)' }}>
        <div className="login-orbit absolute -inset-6 rounded-full border border-dashed border-ares-gold/30" style={{ animationDirection: 'reverse' }}>
          <span className="absolute -bottom-[5px] left-1/2 size-[10px] rounded-full bg-ares-gold shadow-[0_0_18px_4px_rgb(212_175_55/0.55)]" />
        </div>
      </div>

      {/* the analyser, with its carousel on top */}
      <Sheet z={20} order={0} bob={9} className="left-[84px] top-[150px]">
        <div className="relative [transform-style:preserve-3d]">
          <Box
            w={236}
            h={92}
            d={150}
            front="rounded-[10px] border border-ares-gold/50 bg-[linear-gradient(180deg,#4a3b1a,#231a0b)]"
            side="rounded-[10px] border border-ares-gold/30 bg-[linear-gradient(180deg,#33280f,#181106)]"
            top="rounded-[10px] border border-ares-gold/45 bg-[linear-gradient(135deg,#6e5a28,#3d3117)]"
            frontContent={<AnalyserFront />}
          />
          <div className="absolute left-[76px] top-[-2px] [transform-style:preserve-3d]">
            <Carousel />
          </div>
          {/* reagent bay beside the carousel */}
          <div className="absolute left-[166px] top-[-22px] [transform-style:preserve-3d]" style={{ transform: 'translateZ(-30px)' }}>
            <Box w={48} h={22} d={48} front="rounded-[5px] border border-ares-gold/35 bg-[#2f2512]" side="rounded-[5px] border border-ares-gold/25 bg-[#1f180b]" top="rounded-[5px] border border-ares-gold/40 bg-[#5a4820]" />
          </div>
        </div>
      </Sheet>

      {/* readout */}
      <Sheet z={110} order={1} bob={7} className="left-[-30px] top-[2px]">
        <div className={cx(ARES_CARD, 'w-[190px] p-4 text-white')}>
          <p className={ARES_EYEBROW}>IVD analyser · online</p>
          <p className="font-display font-bold text-[24px] tracking-tight leading-none mt-2 tabular-nums">
            98.6<span className="text-[14px] text-white/55 ml-0.5">% uptime</span>
          </p>
          <div className="flex items-center gap-2 mt-3">
            <span className="text-[8.5px] text-white/55 w-[44px]">Run 24</span>
            <span className="flex-1 h-[5px] rounded-full bg-white/10 overflow-hidden">
              <span className="login-bar block h-full w-[82%] rounded-full origin-left bg-ares-gold" style={{ animationDelay: '1s' }} />
            </span>
          </div>
        </div>
      </Sheet>

      {/* loose pieces, nearest the viewer */}
      <Sheet z={150} order={2} bob={6} className="right-[-26px] top-[70px]">
        <div className="scene-spin-z text-ares-gold drop-shadow-[0_10px_18px_rgb(0_0_0/0.7)]">
          <GearSix size={46} weight="duotone" />
        </div>
      </Sheet>
      <Sheet z={215} order={3} bob={5.5} className="left-[-34px] bottom-[84px]">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-ares-gold text-[#1c1406] pl-2 pr-3 py-1.5 text-[10.5px] font-bold shadow-[0_18px_34px_-12px_rgb(0_0_0/0.8)]">
          <CheckCircle size={13} weight="fill" /> Calibrated
        </div>
      </Sheet>
    </Stage>
  )
}
