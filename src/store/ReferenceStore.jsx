import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../lib/api'
import { useAuth } from './AuthContext'
import { useEntity } from './EntityContext'

/**
 * Reference data for the active entity, served by GET /reference: branches,
 * departments, designations and settings. The server is the single source —
 * nothing here is hard-coded in the client.
 *
 * Org-structure writes return the fresh reference payload, so `apply` swaps
 * it in without a second request.
 */
const ReferenceContext = createContext(null)

const EMPTY = { branches: [], departments: [], designations: [], settings: null, migrated: true }

export const BRANCH_TYPES = {
  head_office: 'Head office',
  lab: 'Lab',
  collection_centre: 'Collection centre',
  branch: 'Branch',
}

export function ReferenceProvider({ children }) {
  const { user } = useAuth()
  const { entity } = useEntity()
  const entityId = entity?.id
  const [data, setData] = useState(EMPTY)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!user || !entityId) {
      setData(EMPTY)
      return
    }
    setLoading(true)
    try {
      setData({ ...EMPTY, ...(await apiFetch('/reference', { entity: entityId })) })
    } catch {
      setData(EMPTY)
    } finally {
      setLoading(false)
    }
  }, [user, entityId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const api = useMemo(() => {
    const active = (list) => list.filter((x) => x.isActive)
    return {
      ...data,
      loading,
      refresh,
      apply: (payload) => setData({ ...EMPTY, ...payload }),
      // Names for form selects (active only).
      branchNames: active(data.branches).map((b) => b.name),
      departmentNames: active(data.departments).map((d) => d.name),
      designationNames: active(data.designations).map((d) => d.name),
      headOffice: data.branches.find((b) => b.type === 'head_office')?.name ?? null,
      saveSettings: async (patch) => {
        const settings = await apiFetch('/settings', { method: 'PUT', body: patch, entity: entityId })
        setData((d) => ({ ...d, settings }))
        return settings
      },
      // kind: 'departments' | 'designations' | 'branches'
      createMaster: async (kind, body) => {
        const payload = await apiFetch(`/org/${kind}`, { method: 'POST', body, entity: entityId })
        setData({ ...EMPTY, ...payload })
      },
      updateMaster: async (kind, id, body) => {
        const payload = await apiFetch(`/org/${kind}/${id}`, { method: 'PUT', body, entity: entityId })
        setData({ ...EMPTY, ...payload })
      },
      deleteMaster: async (kind, id) => {
        const payload = await apiFetch(`/org/${kind}/${id}`, { method: 'DELETE', entity: entityId })
        setData({ ...EMPTY, ...payload })
      },
    }
  }, [data, loading, refresh, entityId])

  return <ReferenceContext.Provider value={api}>{children}</ReferenceContext.Provider>
}

export const useReference = () => {
  const ctx = useContext(ReferenceContext)
  if (!ctx) throw new Error('useReference must be used inside <ReferenceProvider>')
  return ctx
}
