import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, GraduationCap, ArrowRight, Sparkles, BarChart3, MessageCircle, FolderOpen, Calendar } from 'lucide-react'
import { supabase } from '../lib/supabase'
import AlertModal from '../components/AlertModal'
import { Button, Card, Input } from '../components/ui'

function traducirError(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('invalid login credentials') || m.includes('invalid email or password'))
    return 'El email o la contraseña son incorrectos.'
  if (m.includes('email not confirmed'))
    return 'Debes confirmar tu email antes de entrar. Revisa tu bandeja de entrada.'
  if (m.includes('too many requests') || m.includes('rate limit') || m.includes('email rate'))
    return 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.'
  if (m.includes('user not found'))
    return 'No existe ninguna cuenta con ese email.'
  if (m.includes('network') || m.includes('fetch'))
    return 'Sin conexión. Comprueba tu internet e inténtalo de nuevo.'
  return msg
}

export default function Login() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [modal, setModal]       = useState<{ title: string; message: string } | null>(null)
  const navigate = useNavigate()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) {
      setModal({ title: 'Campos vacíos', message: 'Completa el email y la contraseña.' })
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      setModal({ title: 'Error al entrar', message: traducirError(error.message) })
    } else {
      navigate('/')
    }
  }

  return (
    <div className="min-h-screen flex bg-bg">
      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col justify-between w-[480px] shrink-0 p-10 relative overflow-hidden bg-gradient-to-br from-surface-2 via-bg to-surface border-r border-white/5">
        {/* Background glow */}
        <div className="absolute pointer-events-none -top-20 -left-20 w-[480px] h-[480px] bg-[radial-gradient(circle,rgba(61,159,137,0.18),transparent_70%)] blur-[40px]" />
        <div className="absolute pointer-events-none bottom-0 -right-[60px] w-[320px] h-[320px] bg-[radial-gradient(circle,rgba(44,129,120,0.12),transparent_70%)] blur-[40px]" />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-primary to-primary-dark shadow-primary">
            <GraduationCap size={20} className="text-white" />
          </div>
          <span className="font-bold text-lg text-text-primary">
            Top<span className="text-primary-light">Code</span>
          </span>
        </div>

        {/* Center content */}
        <div className="relative flex flex-col gap-8">
          <div className="flex flex-col gap-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full w-fit bg-primary/10 border border-primary/20">
              <Sparkles size={12} className="text-primary-light" />
              <span className="text-xs font-semibold text-primary-light">Intranet académica · Informática</span>
            </div>
            <h2 className="text-4xl font-extrabold leading-tight tracking-tight text-text-primary">
              Tu espacio<br />
              <span className="bg-clip-text text-transparent bg-gradient-to-br from-primary-light to-primary-dark">
                académico
              </span>
            </h2>
            <p className="text-base leading-relaxed max-w-sm text-text-secondary">
              Gestiona tus notas, comparte apuntes y mantente al día con los eventos del curso.
            </p>
          </div>

          {/* Feature list */}
          <div className="flex flex-col gap-3">
            {[
              { Icon: BarChart3,    text: 'Seguimiento de calificaciones en tiempo real' },
              { Icon: MessageCircle, text: 'Chat con tus compañeros de clase' },
              { Icon: FolderOpen,   text: 'Biblioteca compartida de apuntes' },
              { Icon: Calendar,     text: 'Calendario de eventos y exámenes' },
            ].map(({ Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-primary/10 border border-primary/20">
                  <Icon size={14} className="text-primary-light" />
                </div>
                <span className="text-sm text-text-secondary">{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative">
            <p className="text-xs text-text-muted">
            © 2025 TopCode · Informática (DAM·DAW·ASIR)
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 relative">
        {/* Mobile glow */}
        <div className="absolute inset-0 pointer-events-none lg:hidden bg-[radial-gradient(ellipse_at_top,rgba(61,159,137,0.08),transparent_60%)]" />

        <div className="w-full max-w-[400px] relative animate-fade-in">
          {/* Mobile logo */}
          <div className="flex flex-col items-center gap-3 mb-10 lg:hidden">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-primary bg-gradient-to-br from-primary to-primary-dark">
              <GraduationCap size={26} className="text-white" />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-extrabold text-text-primary">TopCode</h1>
              <p className="text-xs mt-1 text-text-muted">Intranet académica · Informática (DAM·DAW·ASIR)</p>
            </div>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-2xl font-extrabold tracking-tight text-text-primary">
              Bienvenido de vuelta
            </h2>
            <p className="text-sm mt-1.5 text-text-muted">
              Inicia sesión para acceder a tu cuenta
            </p>
          </div>

          {/* Form card */}
          <Card padding="md">
            <form onSubmit={handleLogin} className="flex flex-col gap-5">
              <Input
                id="login-email"
                type="email"
                label="Correo electrónico"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@email.com"
                autoComplete="email"
                autoFocus
              />

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Contraseña</span>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="bg-input border border-border rounded-xl px-4 py-3 text-text-primary text-sm placeholder:text-text-muted transition-all duration-200 w-full outline-none pr-11 focus:border-primary/50 focus:shadow-[0_0_0_3px_rgba(61,159,137,0.12)]"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors duration-150 hover:text-text-secondary text-text-muted"
                    aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                loading={loading}
                className="group mt-1 border border-white/[0.1] from-surface-2 to-surface py-3 text-sm font-semibold text-text-primary shadow-none hover:from-surface hover:to-surface-2"
              >
                {loading ? 'Verificando...' : (
                  <>
                    Iniciar sesión
                    <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </Button>
            </form>
          </Card>

          {/* Register link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-text-muted">
              ¿No tienes cuenta?{' '}
              <Link
                to="/register"
                className="font-semibold transition-colors duration-150 hover:text-primary-light text-primary-light"
              >
                Crear una cuenta
              </Link>
            </p>
          </div>
        </div>
      </div>

      <AlertModal
        visible={modal !== null}
        type="error"
        title={modal?.title ?? ''}
        message={modal?.message}
        onClose={() => setModal(null)}
      />
    </div>
  )
}
