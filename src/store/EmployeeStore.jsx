import { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import { SEED_EMPLOYEES } from '../data/seed'

/**
 * Phase-1 store: seeded demo roster + additions, persisted to localStorage.
 * Swap the reducer for API calls when the backend lands.
 */

const STORAGE_KEY = 'stellar-apex:employees:v2' // v2: Stellar entity removed, Qugen branch list

const EmployeeContext = createContext(null)

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* fall through to seed */
  }
  return SEED_EMPLOYEES
}

function reducer(state, action) {
  switch (action.type) {
    case 'add':
      return [...state, action.employee]
    case 'update':
      return state.map((e) => (e.id === action.employee.id ? { ...e, ...action.employee } : e))
    case 'reset':
      return SEED_EMPLOYEES
    default:
      return state
  }
}

export function EmployeeProvider({ children }) {
  const [employees, dispatch] = useReducer(reducer, null, load)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(employees))
  }, [employees])

  const api = useMemo(
    () => ({
      employees,
      byId: (id) => employees.find((e) => e.id === id),
      reportsOf: (id) => employees.filter((e) => e.reportsTo === id),
      nextCode: (companyCode) => {
        const nums = employees
          .filter((e) => e.code.startsWith(companyCode + '-'))
          .map((e) => parseInt(e.code.split('-')[1], 10))
        const next = (nums.length ? Math.max(...nums) : 0) + 1
        return `${companyCode}-${String(next).padStart(4, '0')}`
      },
      addEmployee: (employee) => dispatch({ type: 'add', employee }),
      updateEmployee: (employee) => dispatch({ type: 'update', employee }),
      resetDemo: () => dispatch({ type: 'reset' }),
    }),
    [employees],
  )

  return <EmployeeContext.Provider value={api}>{children}</EmployeeContext.Provider>
}

export const useEmployees = () => {
  const ctx = useContext(EmployeeContext)
  if (!ctx) throw new Error('useEmployees must be used inside <EmployeeProvider>')
  return ctx
}
