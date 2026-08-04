import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import './index.css'
import { AuthProvider } from './store/AuthContext'
import { EmployeeProvider } from './store/EmployeeStore'
import { EntityProvider } from './store/EntityContext'
import AppLayout from './components/AppLayout'
import Directory from './pages/Directory'
import Profile from './pages/Profile'
import AddEmployee from './pages/AddEmployee'
import OrgChart from './pages/OrgChart'

const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <Navigate to="/people" replace /> },
      { path: '/people', element: <Directory /> },
      { path: '/people/new', element: <AddEmployee /> },
      { path: '/people/:id', element: <Profile /> },
      { path: '/org', element: <OrgChart /> },
      { path: '*', element: <Navigate to="/people" replace /> },
    ],
  },
])

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <EntityProvider>
        <EmployeeProvider>
          <RouterProvider router={router} />
        </EmployeeProvider>
      </EntityProvider>
    </AuthProvider>
  </StrictMode>,
)
