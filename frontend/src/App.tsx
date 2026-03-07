import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { useLanguage } from './context/LanguageContext'
import Home from './pages/Home'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import Enrollment from './pages/Enrollment'
import AgentEnrollment from './pages/AgentEnrollment'
import Result from './pages/Result'
import AnimalDetail from './pages/AnimalDetail'
import Profile from './pages/Profile'
import GovDashboard from './pages/GovDashboard'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const { t } = useLanguage()

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p>{t.loading}</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function App() {
  const { user, loading } = useAuth()

  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/login"
          element={
            !loading && user ? <Navigate to="/dashboard" replace /> : <Login />
          }
        />
        <Route
          path="/signup"
          element={
            !loading && user ? <Navigate to="/dashboard" replace /> : <Signup />
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/enroll"
          element={
            <ProtectedRoute>
              <Enrollment />
            </ProtectedRoute>
          }
        />
        <Route
          path="/agent-enrollment/:sessionId"
          element={
            <ProtectedRoute>
              <AgentEnrollment />
            </ProtectedRoute>
          }
        />
        <Route path="/result" element={<Result />} />
        <Route
          path="/animals/:id"
          element={
            <ProtectedRoute>
              <AnimalDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/gov-dashboard"
          element={
            <ProtectedRoute>
              <GovDashboard />
            </ProtectedRoute>
          }
        />
      </Routes>
    </div>
  )
}

export default App
