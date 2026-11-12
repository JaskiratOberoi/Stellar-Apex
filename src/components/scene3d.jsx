import { useEffect } from 'react'
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion'
import { cx } from '../lib/utils'
import { EASE_OUT } from '../lib/motion'

/* ------------------------------------------------------------------
 * Building blocks for the decorative 3D scenes (sign-in page, portal
 * doors). A scene is a Stage that leans toward the pointer, holding
 * Sheets and Boxes at different depths. Looping motion is CSS (see
 * "3D scenes" in index.css) and stops under prefers-reduced-motion; the
 * pointer lean is skipped there too.
 * ------------------------------------------------------------------ */

/* Rotation that rests at `rest` degrees and leans toward the pointer. */
export function useTilt(rest = { x: 16, y: -22 }, reach = { x: 7, y: 9 }) {
  const reduced = useReducedMotion()
  const px = useMotionValue(0)
  const py = useMotionValue(0)
  const rotateY = useSpring(useTransform(px, [-1, 1], [rest.y - reach.y, rest.y + reach.y]), { stiffness: 60, damping: 16 })
  const rotateX = useSpring(useTransform(py, [-1, 1], [rest.x + reach.x, rest.x - reach.x]), { stiffness: 60, damping: 16 })

  useEffect(() => {
    if (reduced) return
    const move = (e) => {
      px.set((e.clientX / window.innerWidth) * 2 - 1)
      py.set((e.clientY / window.innerHeight) * 2 - 1)
    }
    window.addEventListener('pointermove', move, { passive: true })
    return () => window.removeEventListener('pointermove', move)
  }, [reduced, px, py])

  return { rotateX, rotateY }
}

/* The tilting stage. Drawn at one size (width × height) and scaled by
 * `scaleClass` so a scene fits panels of different sizes. */
export function Stage({ width = 400, height = 330, rest, reach, scaleClass, className, children }) {
  const tilt = useTilt(rest, reach)
  return (
    <div aria-hidden className={cx('select-none pointer-events-none', className)} style={{ perspective: 1100 }}>
      <div className={cx('absolute inset-0 [transform-style:preserve-3d]', scaleClass)}>
        <motion.div
          className="absolute left-1/2 top-1/2 [transform-style:preserve-3d]"
          style={{ width, height, marginLeft: -width / 2, marginTop: -height / 2, ...tilt }}
        >
          {children}
        </motion.div>
      </div>
    </div>
  )
}

/* One floating layer: depth comes from the outer element, the entrance from
 * the middle one, and the endless bob from the inner one, so the three never
 * fight over the same transform. */
export function Sheet({ z, order = 0, bob = 7, className, children }) {
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

/* A solid box of w × h × d pixels. `front`, `top` and `side` are class names
 * (and optional children for front/top) for the faces a viewer can see. */
export function Box({ w, h, d, front, top, side, frontContent, topContent, className }) {
  const face = 'absolute [backface-visibility:hidden]'
  return (
    <div className={cx('relative [transform-style:preserve-3d]', className)} style={{ width: w, height: h }}>
      <div className={cx(face, 'inset-0', front)} style={{ transform: `translateZ(${d / 2}px)` }}>
        {frontContent}
      </div>
      <div className={cx(face, 'inset-0', side)} style={{ transform: `rotateY(180deg) translateZ(${d / 2}px)` }} />
      <div className={cx(face, side)} style={{ width: d, height: h, left: (w - d) / 2, top: 0, transform: `rotateY(90deg) translateZ(${w / 2}px)` }} />
      <div className={cx(face, side)} style={{ width: d, height: h, left: (w - d) / 2, top: 0, transform: `rotateY(-90deg) translateZ(${w / 2}px)` }} />
      <div className={cx(face, top)} style={{ width: w, height: d, left: 0, top: (h - d) / 2, transform: `rotateX(90deg) translateZ(${h / 2}px)` }}>
        {topContent}
      </div>
    </div>
  )
}
