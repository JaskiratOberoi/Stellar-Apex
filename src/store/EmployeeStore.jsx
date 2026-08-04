import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../lib/api'
import { useAuth } from './AuthContext'
import { useEntity } from './EntityContext'

/**
 * Employee store — backed by the API (docs/BACKEND.md §7).
 * Loads the roster for the active entity on mount / entity change, and exposes
 * the same surface the pages already use, so no screen had to change its calls:
 *   { employees, byId, reportsOf, nextCode, addEmployee, updateEmployee, reveal }
 * Data is server-scoped by the authenticated user's entity — the client never
 * sees another entity's rows.
 */
const EmployeeContext = createContext(null)

export function EmployeeProvider({ children }) {
  const { user } = useAuth()
  const { entity } = useEntity()
  const entityId = entity?.id

  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    if (!user || !entityId) {
      setEmployees([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const list = await apiFetch('/employees', { entity: entityId })
      setEmployees(Array.isArray(list) ? list : [])
    } catch (err) {
      setError(err.message)
      setEmployees([])
    } finally {
      setLoading(false)
    }
  }, [user, entityId])

  // Load whenever the signed-in user or active entity changes.
  useEffect(() => {
    refresh()
  }, [refresh])

  const api = useMemo(
    () => ({
      employees,
      loading,
      error,
      byId: (id) => employees.find((e) => e.id === id),
      reportsOf: (id) => employees.filter((e) => e.reportsTo === id),
      // Cosmetic preview only — the server assigns the real code on save.
      nextCode: (companyCode) => {
        const nums = employees
          .filter((e) => e.code?.startsWith(companyCode + '-'))
          .map((e) => parseInt(e.code.split('-')[1], 10))
          .filter((n) => !Number.isNaN(n))
        const next = (nums.length ? Math.max(...nums) : 0) + 1
        return `${companyCode}-${String(next).padStart(4, '0')}`
      },
      // Returns the created record (with its server-assigned id + code).
      addEmployee: async (employee) => {
        const created = await apiFetch('/employees', {
          method: 'POST',
          body: employee,
          entity: entityId,
        })
        setEmployees((prev) => [...prev, created])
        return created
      },
      updateEmployee: async (employee) => {
        const updated = await apiFetch(`/employees/${employee.id}`, {
          method: 'PUT',
          body: employee,
          entity: entityId,
        })
        setEmployees((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
        return updated
      },
      // Audited, role-gated full-value fetch for a sensitive field.
      reveal: async (id, field) => {
        const { value } = await apiFetch(`/employees/${id}/reveal`, {
          method: 'POST',
          body: { field },
          entity: entityId,
        })
        return value
      },
      refresh,
    }),
    [employees, loading, error, entityId, refresh],
  )

  return <EmployeeContext.Provider value={api}>{children}</EmployeeContext.Provider>
}

export const useEmployees = () => {
  const ctx = useContext(EmployeeContext)
  if (!ctx) throw new Error('useEmployees must be used inside <EmployeeProvider>')
  return ctx
}
