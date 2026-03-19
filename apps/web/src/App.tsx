import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { authApi } from '@/api/auth'
import { LoginPage } from '@/pages/auth/LoginPage'
import { RegisterPage } from '@/pages/auth/RegisterPage'
import { MessengerPage } from '@/pages/MessengerPage'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return isAuthenticated ? <Navigate to="/" replace /> : <>{children}</>
}

export default function App() {
  const { isAuthenticated, accessToken, setAuth, logout } = useAuthStore()
  const [ready, setReady] = useState(false)

  // При старте: если залогинен, но нет accessToken — обновляем через refresh cookie
  useEffect(() => {
    if (isAuthenticated && !accessToken) {
      authApi.refresh()
        .then(({ data }) => setAuth(data.user, data.access_token))
        .catch(() => logout())
        .finally(() => setReady(true))
    } else {
      setReady(true)
    }
  }, [])

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
      <Route path="/*" element={<PrivateRoute><MessengerPage /></PrivateRoute>} />
    </Routes>
  )
}
