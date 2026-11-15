import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import './index.css'
import { AuthProvider } from './store/AuthContext'
import { EmployeeProvider } from './store/EmployeeStore'
import { EntityProvider } from './store/EntityContext'
import { ReferenceProvider } from './store/ReferenceStore'
import { ToastProvider } from './components/kit'
import AppLayout from './components/AppLayout'
import Directory from './pages/Directory'
import Profile from './pages/Profile'
import AddEmployee from './pages/AddEmployee'
import Organisation from './pages/OrgChart'
import Dashboard from './pages/Dashboard'
import Attendance from './pages/Attendance'
import Payroll from './pages/Payroll'
import Payslips from './pages/Payslips'
import Documents from './pages/Documents'
import Onboard from './pages/Onboard'
import OnboardingQueue from './pages/OnboardingQueue'

const router = createBrowserRouter([
  // PUBLIC: field onboarding form — deliberately outside the auth-gated shell.
  // /onboard is Noble's form (the original link); /onboard/ares is Ares's.
  { path: '/onboard', element: <Onboard /> },
  { path: '/onboard/:entity', element: <Onboard /> },
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <Navigate to="/people" replace /> },
      { path: '/people', element: <Directory /> },
      { path: '/people/new', element: <AddEmployee /> },
      { path: '/people/:id', element: <Profile /> },
      { path: '/people/:id/edit', element: <AddEmployee /> },
      { path: '/org', element: <Organisation /> },
      { path: '/onboarding', element: <OnboardingQueue /> },
      { path: '/dashboard', element: <Dashboard /> },
      { path: '/attendance', element: <Attendance /> },
      { path: '/payroll', element: <Payroll /> },
      { path: '/payroll/:period/payslips', element: <Payslips /> },
      { path: '/payroll/:period/payslips/:lineId', element: <Payslips /> },
      { path: '/documents', element: <Documents /> },
      { path: '*', element: <Navigate to="/people" replace /> },
    ],
  },
])

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* reducedMotion="user": people who ask their OS for less motion get
        opacity changes only — no sliding, scaling or layout animation. */}
    <MotionConfig reducedMotion="user">
      <AuthProvider>
        <EntityProvider>
          <ReferenceProvider>
            <EmployeeProvider>
              <ToastProvider>
                <RouterProvider router={router} />
              </ToastProvider>
            </EmployeeProvider>
          </ReferenceProvider>
        </EntityProvider>
      </AuthProvider>
    </MotionConfig>
  </StrictMode>,
)
