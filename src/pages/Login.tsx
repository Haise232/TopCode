import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, GraduationCap, ArrowRight, Sparkles } from 'lucide-react'
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
      <div
        className="hidden lg:flex flex-col justify-between w-[480px] shrink-0 p-10 relative overflow-hidden"
        style={{
          background: 'linear-gradient(145deg, var(--color-surface-2) 0%, var(--color-bg) 60%, var(--color-surface) 100%)',
          borderRight: '1px solid var(--overlay-05)',
        }}
      >
        {/* Background glow */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: '-80px', left: '-80px',
            width: '480px', height: '480px',
            background: 'radial-gradient(circle, rgba(85,239,196,0.18) 0%, transparent 70%)',
            filter: 'blur(40px)',
          }}
        />
        <div
          className="absolute pointer-events-none"
          style={{
            bottom: '0px', right: '-60px',
            width: '320px', height: '320px',
            background: 'radial-gradient(circle, rgba(0,206,201,0.12) 0%, transparent 70%)',
            filter: 'blur(40px)',
          }}
        />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-primary shadow-primary">
            <GraduationCap size={20} className="text-white" />
          </div>
          <span className="font-bold text-lg text-text-primary">
            Top<span style={{ color: 'var(--color-primary-light)' }}>Code</span>
          </span>
        </div>

        {/* Center content — panel de marca: fondo oscuro fijo, colores de texto literales (no siguen el tema) */}
        <div className="relative flex flex-col gap-8">
          <div className="flex flex-col gap-4">
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full w-fit"
              style={{ background: 'rgba(85,239,196,0.1)', border: '1px solid rgba(85,239,196,0.2)' }}
            >
              <Sparkles size={12} style={{ color: 'var(--color-primary-light)' }} />
              <span className="text-xs font-semibold" style={{ color: 'var(--color-primary-light)' }}>Intranet académica DAM</span>
            </div>
            <h2 className="text-4xl font-extrabold leading-tight tracking-tight text-text-primary">
              Tu espacio<br />
              <span className="bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(135deg, #8ff5d6, #00cec9)' }}>
                académico
              </span>
            </h2>
            <p className="text-base leading-relaxed max-w-sm" style={{ color: '#64748b' }}>
              Gestiona tus notas, comparte apuntes y mantente al día con los eventos del curso.
            </p>
          </div>

          {/* Feature list */}
          <div className="flex flex-col gap-3">
            {[
              { emoji: '📊', text: 'Seguimiento de calificaciones en tiempo real' },
              { emoji: '💬', text: 'Chat con tus compañeros de clase' },
              { emoji: '📁', text: 'Biblioteca compartida de apuntes' },
              { emoji: '📅', text: 'Calendario de eventos y exámenes' },
            ].map(({ emoji, text }) => (
              <div key={text} className="flex items-center gap-3">
                <span className="text-base">{emoji}</span>
                <span className="text-sm" style={{ color: '#94a3b8' }}>{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative">
          <p className="text-xs" style={{ color: '#4b5563' }}>
            © 2025 TopCode · Ciclo Formativo DAM
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 relative">
        {/* Mobile glow */}
        <div
          className="absolute inset-0 pointer-events-none lg:hidden"
          style={{
            background: 'radial-gradient(ellipse at top, rgba(85,239,196,0.08) 0%, transparent 60%)',
          }}
        />

        <div className="w-full max-w-[400px] relative animate-fade-in">
          {/* Mobile logo */}
          <div className="flex flex-col items-center gap-3 mb-10 lg:hidden">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-primary bg-gradient-primary">
              <GraduationCap size={26} className="text-white" />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-extrabold text-text-primary">TopCode</h1>
              <p className="text-xs mt-1 text-text-muted">Intranet académica · DAM</p>
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
                <span className="section-title">Contraseña</span>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input-base pr-11"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors duration-150 hover:text-slate-300 text-text-muted"
                    aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <Button type="submit" loading={loading} className="py-3 text-sm font-semibold group mt-1">
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
                className="font-semibold transition-colors duration-150 hover:text-indigo-300 text-primary-light"
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
