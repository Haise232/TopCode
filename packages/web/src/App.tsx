import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import Layout from './components/Layout'
import Loading from './components/Loading'
import { supabase } from './lib/supabase'

const Login       = lazy(() => import('./pages/Login'))
const Register    = lazy(() => import('./pages/Register'))
const Home        = lazy(() => import('./pages/Home'))
const Explorar    = lazy(() => import('./pages/Explorar'))
const Docs        = lazy(() => import('./pages/Docs'))
const DocsColeccion = lazy(() => import('./pages/DocsColeccion'))
const Chat        = lazy(() => import('./pages/Chat'))
const Apuntes     = lazy(() => import('./pages/Apuntes'))
const CalendarPage = lazy(() => import('./pages/Calendar'))
const Admin       = lazy(() => import('./pages/Admin'))
const Profile     = lazy(() => import('./pages/Profile'))
const Actividades = lazy(() => import('./pages/Actividades'))
const Recursos    = lazy(() => import('./pages/Recursos'))
const Foro        = lazy(() => import('./pages/Foro'))
const ForoPost    = lazy(() => import('./pages/ForoPost'))

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, usuario, loading, perfilError } = useAuth()
  const location = useLocation()
  if (loading) return <Loading />
  if (!session) return <Navigate to="/login" state={{ from: location }} replace />
  // Sin perfil no se sabe si la cuenta está aprobada: mostrar un error real en
  // lugar de asumir que la solicitud está pendiente.
  if (!usuario) return perfilError ? <ProfileError /> : <Loading />
  if (usuario.estado_acceso !== 'aprobado') return <AccessPending />
  return <Layout>{children}</Layout>
}

function ProfileError() {
  const { refreshUsuario } = useAuth()

  return (
    <main className="min-h-screen flex items-center justify-center bg-bg p-6">
      <div className="w-full max-w-md rounded-2xl p-8 text-center bg-surface border border-white/[0.08]">
        <h1 className="text-xl font-bold text-text-primary">No se pudo cargar tu perfil</h1>
        <p className="mt-3 text-sm leading-relaxed text-text-muted">
          Estás conectado, pero no hemos podido comprobar el estado de tu cuenta.
          Revisa tu conexión e inténtalo de nuevo.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={() => { void refreshUsuario() }}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-primary hover:bg-primary-dark transition-colors"
          >
            Reintentar
          </button>
          <button
            onClick={() => supabase.auth.signOut()}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-text-muted hover:text-text-primary transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </main>
  )
}

function AccessPending() {
  const { usuario } = useAuth()
  const rechazado = usuario?.estado_acceso === 'rechazado'

  return (
    <main className="min-h-screen flex items-center justify-center bg-bg p-6">
      <div className="w-full max-w-md rounded-2xl p-8 text-center bg-surface border border-white/[0.08]">
        <h1 className="text-xl font-bold text-text-primary">
          {rechazado ? 'Solicitud no aceptada' : 'Solicitud pendiente'}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-text-muted">
          {rechazado
            ? 'El administrador de tu clase no ha aceptado esta cuenta. Contacta con él si crees que es un error.'
            : 'Tu cuenta se ha creado correctamente. Un administrador de tu clase debe aceptarla antes de que puedas entrar.'}
        </p>
        <button
          onClick={() => supabase.auth.signOut()}
          className="mt-6 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-primary hover:bg-primary-dark transition-colors"
        >
          Cerrar sesión
        </button>
      </div>
    </main>
  )
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
        <Route path="/explorar" element={<ProtectedRoute><Explorar /></ProtectedRoute>} />
        <Route path="/docs"     element={<ProtectedRoute><Docs /></ProtectedRoute>} />
        <Route path="/docs/:coleccionId" element={<ProtectedRoute><DocsColeccion /></ProtectedRoute>} />
        <Route path="/docs/:coleccionId/:paginaId" element={<ProtectedRoute><DocsColeccion /></ProtectedRoute>} />
        <Route path="/chat"     element={<ProtectedRoute><Chat /></ProtectedRoute>} />
        <Route path="/apuntes"  element={<ProtectedRoute><Apuntes /></ProtectedRoute>} />
        <Route path="/calendar"    element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
        <Route path="/actividades" element={<ProtectedRoute><Actividades /></ProtectedRoute>} />
        <Route path="/recursos"    element={<ProtectedRoute><Recursos /></ProtectedRoute>} />
        <Route path="/foro"        element={<ProtectedRoute><Foro /></ProtectedRoute>} />
        <Route path="/foro/:id"    element={<ProtectedRoute><ForoPost /></ProtectedRoute>} />
        <Route path="/profile"  element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/profile/:id" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
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
    <ThemeProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ThemeProvider>
  )
}
