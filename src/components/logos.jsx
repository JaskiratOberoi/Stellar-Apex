/* ------------------------------------------------------------------ */
/*  Entity brand assets — the official logos.                          */
/*  Files live in /public/brand and are served at /brand/*.png.        */
/*    *-mark.png  → emblem only (square) for compact badges            */
/*    *-full.png  → full lockup for brand moments (portal picker)      */
/* ------------------------------------------------------------------ */

/* ---- Emblem marks (square) ---- */
export function NobleMark({ size = 40, className }) {
  return (
    <img
      src="/brand/noble-mark.png"
      alt="Noble Diagnostics"
      width={size}
      height={size}
      className={className}
      draggable={false}
    />
  )
}

export function AresMark({ size = 40, className }) {
  return (
    <img
      src="/brand/ares-mark.png"
      alt="Ares Labs"
      width={size}
      height={size}
      className={className}
      draggable={false}
    />
  )
}

export const ENTITY_MARK = {
  noble: NobleMark,
  ares: AresMark,
}

/* ---- Full lockups ---- */
export function NobleLogo({ className }) {
  return <img src="/brand/noble-full.png" alt="Noble Diagnostics" className={className} draggable={false} />
}

export function AresLogo({ className }) {
  return <img src="/brand/ares-full.png" alt="Ares Labs" className={className} draggable={false} />
}

export const ENTITY_LOGO = {
  noble: NobleLogo,
  ares: AresLogo,
}
