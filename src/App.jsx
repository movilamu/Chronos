import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { materializeTodaysRecurringTasks } from './hooks/useRecurringTemplates'
import Layout from './components/Layout'
import Login from './pages/Login'
import Today from './pages/Today'
import Board from './pages/Board'
import Tasks from './pages/Tasks'
import Projects from './pages/Projects'
import Sprints from './pages/Sprints'
import Reports from './pages/Reports'
import NeedsInput from './pages/NeedsInput'
import Settings from './pages/Settings'
import Onboarding from './pages/Onboarding'

function ProtectedRoutes() {
  const { session, loading, profile } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-[var(--text-secondary)]">
        Loading...
      </div>
    )
  }

  if (!session) return <Login />

  if (profile && profile.onboarding_completed === false) {
    return <Onboarding />
  }

  return <AuthedApp userId={session.user.id} />
}

function AuthedApp({ userId }) {
  useEffect(() => {
    materializeTodaysRecurringTasks(userId)
  }, [userId])

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Today />} />
        <Route path="/board" element={<Board />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/sprints" element={<Sprints />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/needs-input" element={<NeedsInput />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <ProtectedRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
