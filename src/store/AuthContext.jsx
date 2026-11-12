import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { apiFetch, getToken, setToken, clearToken, clearChosenEntity } from '../lib/api'

/**
 * Auth context. Holds the signed-in user (name, role, entity) and the token.
 * The user's entity — not a client-side portal pick — is the real tenant scope
 * (docs/BACKEND.md §7). super_admin has entity=null and picks one via the portal.
 */
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)

  // On mount: if a token exists, validate it via /me and restore the session.
  useEffect(() => {
    let active = true
    async function restore() {
      if (!getToken()) {
        setReady(true)
        return
      }
      // Only a rejected token (401) ends the session. A network blip or a
      // server hiccup is retried, and never throws the sign-in away.
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const { user } = await apiFetch('/me')
          if (active) setUser(user)
          break
        } catch (err) {
          if (err?.status === 401) {
            clearToken()
            break
          }
          if (attempt < 2) await new Promise((r) => setTimeout(r, 700 * (attempt + 1)))
        }
      }
      if (active) setReady(true)
    }
    restore()
    return () => {
      active = false
    }
  }, [])

  const api = useMemo(
    () => ({
      user,
      ready,
      async login(email, password) {
        const { token, user } = await apiFetch('/auth/login', {
          method: 'POST',
          body: { email, password },
        })
        setToken(token)
        clearChosenEntity() // fresh session, no stale portal pick
        setUser(user)
        return user
      },
      async logout() {
        try {
          await apiFetch('/auth/logout', { method: 'POST' })
        } catch {
          /* stateless token — ignore */
        }
        clearToken()
        clearChosenEntity()
        setUser(null)
      },
    }),
    [user, ready],
  )

  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
