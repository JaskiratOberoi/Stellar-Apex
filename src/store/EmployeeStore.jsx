import { createContext, useContext, useEffect, useMemo, useReducer } from 'react'

/**
 * Phase-1 store: roster persisted to localStorage.
 * Production starts empty — HR adds real employees via the wizard.
 * A demo roster is seeded only in local development (dynamic import below),
 * so no fake data ever ships in the production bundle.
 * Swap the reducer for API calls when the backend lands.
 */

const STORAGE_KEY = 'stellar-apex:employees:v2' // v2: Stellar entity removed, Qugen branch list

const EmployeeContext = createContext(null)

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* fall through to empty */
  }
  return []
}

function reducer(state, action) {
  switch (action.type) {
    case 'seed':
      return action.employees
    case 'add':
      return [...state, action.employee]
    case 'update':
      return state.map((e) => (e.id === action.employee.id ? { ...e, ...action.employee } : e))
    case 'reset':
      return []
    default:
      return state
  }
}

export function EmployeeProvider({ children }) {
  const [employees, dispatch] = useReducer(reducer, null, load)

  // Dev-only: seed the demo roster on a fresh store. This effect runs before
  // the persist effect below, so it reads "is this a fresh store?" from
  // localStorage before anything is written. The dynamic import keeps
  // demoRoster.js (fake names, Aadhaar/PAN/bank) out of the production bundle.
  useEffect(() => {
    if (import.meta.env.DEV && localStorage.getItem(STORAGE_KEY) === null) {
      import('../data/demoRoster.js').then(({ DEMO_EMPLOYEES }) =>
        dispatch({ type: 'seed', employees: DEMO_EMPLOYEES }),
      )
    }
  }, [])

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
      resetRoster: () => dispatch({ type: 'reset' }),
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
