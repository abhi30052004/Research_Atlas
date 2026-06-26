import { Suspense, useEffect, type ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { ThemeProvider } from './components/ThemeProvider'
import { getGoogleRedirectUser } from './lib/firebase'

import SplashVideo from './pages/auth/SplashVideo'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import DashboardPage from './pages/dashboard/DashboardPage'
import WorkspacePage from './pages/workspace/WorkspacePage'

const RouteFallback = () => (
  <div className="min-h-screen bg-surface flex items-center justify-center">
    <div className="h-8 w-8 rounded-full border-2 border-outline-variant border-t-secondary animate-spin" />
  </div>
)

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return isAuthenticated ? <>{children}</> : <Navigate to="/" replace />
}

let hasHandledGoogleRedirect = false

const GoogleRedirectHandler = () => {
  const navigate = useNavigate()
  const googleLoginApi = useAuthStore((s) => s.googleLoginApi)

  useEffect(() => {
    if (hasHandledGoogleRedirect) return
    hasHandledGoogleRedirect = true

    getGoogleRedirectUser()
      .then(async (user) => {
        if (!user) return
        const token = await user.getIdToken()
        await googleLoginApi(token)
        navigate('/dashboard', { replace: true })
      })
      .catch((error) => {
        console.error('Google redirect sign-in failed:', error)
      })
  }, [googleLoginApi, navigate])

  return null
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <GoogleRedirectHandler />
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<SplashVideo />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/workspace/:id" element={<ProtectedRoute><WorkspacePage /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ThemeProvider>
  )
}
