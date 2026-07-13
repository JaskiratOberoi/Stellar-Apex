import { createContext, useContext, useMemo, useState } from 'react'
import { COMPANIES } from '../data/seed'

/**
 * Active entity (portal) context.
 *
 * Noble and Ares run as isolated portals — every page scopes data to the
 * active entity, and nothing from the other entity is ever rendered.
 * Phase-1 note: the portal picker stands in for per-entity auth; once a
 * backend lands, entity scope comes from the signed-in user's role instead.
 */

const STORAGE_KEY = 'stellar-apex:entity:v1'

const EntityContext = createContext(null)

export function EntityProvider({ children }) {
  const [entityId, setEntityId] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored && COMPANIES[stored] ? stored : null
  })

  const api = useMemo(
    () => ({
      entity: entityId ? COMPANIES[entityId] : null,
      enterPortal: (id) => {
        if (!COMPANIES[id]) return
        localStorage.setItem(STORAGE_KEY, id)
        setEntityId(id)
      },
      exitPortal: () => {
        localStorage.removeItem(STORAGE_KEY)
        setEntityId(null)
      },
    }),
    [entityId],
  )

  return <EntityContext.Provider value={api}>{children}</EntityContext.Provider>
}

export const useEntity = () => {
  const ctx = useContext(EntityContext)
  if (!ctx) throw new Error('useEntity must be used inside <EntityProvider>')
  return ctx
}
