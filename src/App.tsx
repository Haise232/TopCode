import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import Loading from './components/Loading'

const Login       = lazy(() => import('./pages/Login'))
const Register    = lazy(() => import('./pages/Register'))
const Home        = lazy(() => import('./pages/Home'))
const Noticias    = lazy(() => import('./pages/Noticias'))
const Chat        = lazy(() => import('./pages/Chat'))
const Apuntes     = lazy(() => import('./pages/Apuntes'))
const CalendarPage = lazy(() => import('./pages/Calendar'))
const Admin       = lazy(() => import('./pages/Admin'))
const Profile     = lazy(() => import('./pages/Profile'))
const Actividades = lazy(() => import('./pages/Actividades'))

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Loading />
  if (!session) return <Navigate to="/login" state={{ from: location }} replace />
  return <Layout>{children}</Layout>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return <Loading />
  if (session) return <Navigate to="/" replace />
  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { usuario, loading } = useAuth()
  if (loading) return <Loading />
  if (!usuario) return <Navigate to="/" replace />
  if (usuario.rol !== 'admin') return <Navigate to="/" replace />
  return <>{children}</>
}

function AppRoutes() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/login"    element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

        <Route path="/"         element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/noticias" element={<ProtectedRoute><Noticias /></ProtectedRoute>} />
        <Route path="/chat"     element={<ProtectedRoute><Chat /></ProtectedRoute>} />
        <Route path="/apuntes"  element={<ProtectedRoute><Apuntes /></ProtectedRoute>} />
        <Route path="/calendar"    element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
        <Route path="/actividades" element={<ProtectedRoute><Actividades /></ProtectedRoute>} />
        <Route path="/profile"  element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/admin"    element={
          <ProtectedRoute><AdminRoute><Admin /></AdminRoute></ProtectedRoute>
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
