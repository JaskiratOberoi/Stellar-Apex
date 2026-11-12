/* Shared motion vocabulary. Mirrors the CSS tokens in src/index.css:
 *   fast 120ms (hover, press) · base 200ms (state change) · slow 320ms
 *   (overlays, page changes). Enter eases out, exit eases in.
 * Reduced motion is handled globally by <MotionConfig reducedMotion="user">,
 * which drops transforms and keeps opacity. */

export const EASE_OUT = [0.16, 1, 0.3, 1]
export const EASE_IN = [0.7, 0, 0.84, 0]
export const DUR = { fast: 0.12, base: 0.2, slow: 0.32 }

export const enter = { duration: DUR.slow, ease: EASE_OUT }
export const exit = { duration: DUR.base, ease: EASE_IN }
export const spring = { type: 'spring', stiffness: 520, damping: 40, mass: 0.8 }

/* Page or card arriving. */
export const fadeUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: enter },
  exit: { opacity: 0, y: -6, transition: exit },
}

/* Parent that reveals children one after another. Pair with `item`. */
export const stagger = (gap = 0.04) => ({
  initial: {},
  animate: { transition: { staggerChildren: gap, delayChildren: 0.02 } },
})
export const item = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: enter },
}

/* Row or card in a filtered list. */
export const listItem = {
  initial: { opacity: 0, scale: 0.98 },
  animate: { opacity: 1, scale: 1, transition: { duration: DUR.base, ease: EASE_OUT } },
  exit: { opacity: 0, scale: 0.98, transition: { duration: DUR.fast, ease: EASE_IN } },
}

/* Step content that knows which way it is travelling (1 forward, -1 back). */
export const slideX = {
  initial: (dir = 1) => ({ opacity: 0, x: 16 * dir }),
  animate: { opacity: 1, x: 0, transition: { duration: DUR.base, ease: EASE_OUT } },
  exit: (dir = 1) => ({ opacity: 0, x: -16 * dir, transition: { duration: DUR.fast, ease: EASE_IN } }),
}

/* Height-collapsing block (expanders, inline errors). */
export const collapse = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: 'auto', transition: { duration: DUR.base, ease: EASE_OUT } },
  exit: { opacity: 0, height: 0, transition: { duration: DUR.fast, ease: EASE_IN } },
}

/* Small confirmation mark. */
export const pop = {
  initial: { opacity: 0, scale: 0.6 },
  animate: { opacity: 1, scale: 1, transition: spring },
  exit: { opacity: 0, scale: 0.6, transition: exit },
}
