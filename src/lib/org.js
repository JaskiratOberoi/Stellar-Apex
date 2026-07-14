/* ------------------------------------------------------------------ */
/*  Org hierarchy helpers — derive the reporting tree from employees'  */
/*  reportsTo links. Pure functions so the org chart and the profile   */
/*  relationship editor share exactly the same logic.                  */
/* ------------------------------------------------------------------ */

const byName = (a, b) => a.name.localeCompare(b.name)

/**
 * Build the reporting forest for a roster.
 * Roots = employees with no manager (or whose manager isn't in this roster,
 * which shouldn't happen within an isolated entity but is handled defensively).
 * Returns { roots, childrenOf, byId } — childrenOf maps managerId → [reports].
 */
export function buildForest(roster) {
  const byId = new Map(roster.map((e) => [e.id, e]))
  const childrenOf = new Map()
  const roots = []

  for (const e of roster) {
    const managerId = e.reportsTo && byId.has(e.reportsTo) ? e.reportsTo : null
    if (managerId) {
      if (!childrenOf.has(managerId)) childrenOf.set(managerId, [])
      childrenOf.get(managerId).push(e)
    } else {
      roots.push(e)
    }
  }

  roots.sort(byName)
  for (const arr of childrenOf.values()) arr.sort(byName)
  return { roots, childrenOf, byId }
}

/** All ids beneath `id` (its reports, their reports, …). Cycle-safe. */
export function descendantIds(id, childrenOf) {
  const out = new Set()
  const stack = [...(childrenOf.get(id) || [])]
  while (stack.length) {
    const node = stack.pop()
    if (out.has(node.id)) continue
    out.add(node.id)
    stack.push(...(childrenOf.get(node.id) || []))
  }
  return out
}

/** All ids above `id` (its manager, their manager, …). Cycle-safe. */
export function ancestorIds(id, byId) {
  const out = new Set()
  let cur = byId.get(id)
  while (cur && cur.reportsTo && byId.has(cur.reportsTo) && !out.has(cur.reportsTo)) {
    out.add(cur.reportsTo)
    cur = byId.get(cur.reportsTo)
  }
  return out
}

/** Depth of the deepest chain in the forest (number of levels). */
export function forestDepth(roots, childrenOf) {
  let max = 0
  const walk = (node, d) => {
    max = Math.max(max, d)
    for (const child of childrenOf.get(node.id) || []) walk(child, d + 1)
  }
  for (const r of roots) walk(r, 1)
  return max
}
