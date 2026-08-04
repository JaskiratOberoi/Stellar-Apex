import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { COMPANIES } from '../data/seed'
import { useAuth } from './AuthContext'
import { getChosenEntity, setChosenEntity, clearChosenEntity } from '../lib/api'

/**
 * Active entity (portal) context.
 *
 * The entity now comes from the signed-in user (docs/BACKEND.md §7):
 *  - entity_admin / entity_hr / viewer: entity is FIXED to their account's
 *    entity — the portal picker never shows and cannot be switched.
 *  - super_admin: entity is a client-side pick among portals (sent to the API
 *    as the X-Entity header, which the server only honors for super_admin).
 *
 * Isolation is enforced server-side; this context is just UI scope.
 */
const EntityContext = createContext(null)

export function EntityProvider({ children }) {
  const { user, logout } = useAuth()
  const [chosen, setChosen] = useState(() => getChosenEntity())

  // Re-sync the chosen portal whenever the signed-in user changes (login/logout).
  useEffect(() => {
    setChosen(getChosenEntity())
  }, [user])

  const isSuper = user?.role === 'super_admin'
  const entityId = user
    ? isSuper
      ? chosen && COMPANIES[chosen]
        ? chosen
        : null
      : user.entity
    : null

  const api = useMemo(
    () => ({
      entity: entityId && COMPANIES[entityId] ? COMPANIES[entityId] : null,
      canSwitch: isSuper,
      enterPortal: (id) => {
        if (!COMPANIES[id]) return
        setChosenEntity(id)
        setChosen(id)
      },
      exitPortal: () => {
        if (isSuper) {
          // super_admin returns to the portal picker
          clearChosenEntity()
          setChosen(null)
        } else {
          // entity-scoped users can't switch portals — "exit" signs out
          logout()
        }
      },
    }),
    [entityId, isSuper, logout],
  )

  return <EntityContext.Provider value={api}>{children}</EntityContext.Provider>
}

export const useEntity = () => {
  const ctx = useContext(EntityContext)
  if (!ctx) throw new Error('useEntity must be used inside <EntityProvider>')
  return ctx
}
