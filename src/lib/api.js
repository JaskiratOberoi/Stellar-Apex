/* ------------------------------------------------------------------ */
/*  API client — talks to the containerized backend (docs/BACKEND.md).  */
/*  Base URL from VITE_API_URL, defaulting to the local Docker API.     */
/* ------------------------------------------------------------------ */

// Relative by default: same-origin as the SPA. In dev, Vite proxies /api to the
// PHP container; in prod, Apache serves /api next to the static site. Override
// with VITE_API_URL only for a cross-origin backend.
const BASE = import.meta.env.VITE_API_URL || '/api'
export const API_BASE = BASE

const TOKEN_KEY = 'stellar-apex:token'
const ENTITY_KEY = 'stellar-apex:entity:v1' // chosen entity (super_admin only)

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t)
export const clearToken = () => localStorage.removeItem(TOKEN_KEY)

export const getChosenEntity = () => localStorage.getItem(ENTITY_KEY)
export const setChosenEntity = (id) => localStorage.setItem(ENTITY_KEY, id)
export const clearChosenEntity = () => localStorage.removeItem(ENTITY_KEY)

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

/**
 * Core fetch wrapper. Attaches the bearer token and the active-entity header
 * (the server only honors X-Entity for super_admin; it's ignored otherwise).
 * On 401 it clears the token so the app falls back to the login screen.
 */
export async function apiFetch(path, { method = 'GET', body, entity } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  const activeEntity = entity ?? getChosenEntity()
  if (activeEntity) headers['X-Entity'] = activeEntity

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401) {
    clearToken()
  }

  let data = null
  const text = await res.text()
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }

  if (!res.ok) {
    const msg = (data && data.error) || `Request failed (${res.status})`
    throw new ApiError(res.status, msg)
  }
  return data
}
