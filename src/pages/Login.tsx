import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, GraduationCap, ArrowRight, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'
import AlertModal from '../components/AlertModal'

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
    <div className="min-h-screen flex" style={{ background: '#0f1117' }}>
      {/* Left panel — branding */}
      <div
        className="hidden lg:flex flex-col justify-between w-[480px] shrink-0 p-10 relative overflow-hidden"
        style={{
          background: 'linear-gradient(145deg, #13152a 0%, #0f1117 60%, #111420 100%)',
          borderRight: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        {/* Background glow */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: '-80px', left: '-80px',
            width: '480px', height: '480px',
            background: 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)',
            filter: 'blur(40px)',
          }}
        />
        <div
          className="absolute pointer-events-none"
          style={{
            bottom: '0px', right: '-60px',
            width: '320px', height: '320px',
            background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)',
            filter: 'blur(40px)',
          }}
        />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 4px 16px rgba(99,102,241,0.4)' }}
          >
            <GraduationCap size={20} className="text-white" />
          </div>
          <span className="font-bold text-lg" style={{ color: '#f1f5f9' }}>
            Top<span style={{ color: '#818cf8' }}>Code</span>
          </span>
        </div>

        {/* Center content */}
        <div className="relative flex flex-col gap-8">
          <div className="flex flex-col gap-4">
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full w-fit"
              style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}
            >
              <Sparkles size={12} style={{ color: '#818cf8' }} />
              <span className="text-xs font-semibold" style={{ color: '#818cf8' }}>Intranet académica DAW</span>
            </div>
            <h2 className="text-4xl font-extrabold leading-tight tracking-tight" style={{ color: '#f1f5f9' }}>
              Tu espacio<br />
              <span
                style={{
                  background: 'linear-gradient(135deg, #818cf8, #c084fc)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
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
            © 2025 TopCode · Ciclo Formativo DAW
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 relative">
        {/* Mobile glow */}
        <div
          className="absolute inset-0 pointer-events-none lg:hidden"
          style={{
            background: 'radial-gradient(ellipse at top, rgba(99,102,241,0.08) 0%, transparent 60%)',
          }}
        />

        <div className="w-full max-w-[400px] relative animate-fade-in">
          {/* Mobile logo */}
          <div className="flex flex-col items-center gap-3 mb-10 lg:hidden">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-primary"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            >
              <GraduationCap size={26} className="text-white" />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-extrabold" style={{ color: '#f1f5f9' }}>TopCode</h1>
              <p className="text-xs mt-1" style={{ color: '#64748b' }}>Intranet académica · DAW</p>
            </div>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-2xl font-extrabold tracking-tight" style={{ color: '#f1f5f9' }}>
              Bienvenido de vuelta
            </h2>
            <p className="text-sm mt-1.5" style={{ color: '#64748b' }}>
              Inicia sesión para acceder a tu cuenta
            </p>
          </div>

          {/* Form card */}
          <div
            className="rounded-2xl p-6"
            style={{
              background: '#1a1d27',
              border: '1px solid rgba(255,255,255,0.07)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
            }}
          >
            <form onSubmit={handleLogin} className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold" style={{ color: '#94a3b8' }}>
                  Correo electrónico
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  className="input-base"
                  autoComplete="email"
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold" style={{ color: '#94a3b8' }}>
                  Contraseña
                </label>
                <div className="relative">
                  <input
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
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors duration-150 hover:text-slate-300"
                    style={{ color: '#64748b' }}
                    aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary py-3 text-sm font-semibold group mt-1"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded-full animate-spin"
                      style={{ border: '2px solid rgba(255,255,255,0.2)', borderTopColor: 'white' }}
                    />
                    Verificando...
                  </div>
                ) : (
                  <>
                    Iniciar sesión
                    <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Register link */}
          <div className="mt-6 text-center">
            <p className="text-sm" style={{ color: '#64748b' }}>
              ¿No tienes cuenta?{' '}
              <Link
                to="/register"
                className="font-semibold transition-colors duration-150 hover:text-indigo-300"
                style={{ color: '#818cf8' }}
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
