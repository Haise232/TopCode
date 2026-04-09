import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, ArrowRight, GraduationCap, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'
import AlertModal from '../components/AlertModal'

function traducirError(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('already registered') || m.includes('user already exists'))
    return 'Ya existe una cuenta con ese email.'
  if (m.includes('password') && m.includes('characters'))
    return 'La contraseña debe tener al menos 6 caracteres.'
  if (m.includes('invalid email'))
    return 'El formato del email no es válido.'
  if (m.includes('too many requests') || m.includes('rate limit'))
    return 'Demasiados intentos. Espera unos minutos.'
  if (m.includes('network') || m.includes('fetch'))
    return 'Sin conexión. Comprueba tu internet.'
  return msg
}

export default function Register() {
  const [nombre, setNombre]     = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [modal, setModal]       = useState<{
    type: 'error' | 'success'
    title: string
    message: string
  } | null>(null)
  const navigate = useNavigate()

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim() || !email || !password) {
      setModal({ type: 'error', title: 'Campos vacíos', message: 'Completa todos los campos.' })
      return
    }
    if (password.length < 6) {
      setModal({ type: 'error', title: 'Contraseña corta', message: 'La contraseña debe tener al menos 6 caracteres.' })
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nombre: nombre.trim() },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    })
    setLoading(false)
    if (error) {
      setModal({ type: 'error', title: 'Error al registrarse', message: traducirError(error.message) })
    } else {
      setModal({
        type: 'success',
        title: '¡Revisa tu correo!',
        message: `Hemos enviado un enlace de confirmación a ${email}. Verifica tu correo antes de iniciar sesión.`,
      })
    }
  }

  const passStrength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3
  const strengthColors = ['', '#f43f5e', '#f59e0b', '#10b981']
  const strengthLabels = ['', 'Débil', 'Media', 'Fuerte']

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
              <span className="text-xs font-semibold" style={{ color: '#818cf8' }}>Únete al equipo DAW</span>
            </div>
            <h2 className="text-4xl font-extrabold leading-tight tracking-tight" style={{ color: '#f1f5f9' }}>
              Empieza tu<br />
              <span
                style={{
                  background: 'linear-gradient(135deg, #818cf8, #c084fc)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                aventura
              </span>
            </h2>
            <p className="text-base leading-relaxed max-w-sm" style={{ color: '#64748b' }}>
              Crea tu cuenta en segundos y accede a todas las herramientas académicas del curso.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {[
              { emoji: '⚡', text: 'Registro rápido con verificación por correo' },
              { emoji: '🔒', text: 'Tu información siempre segura' },
              { emoji: '🤝', text: 'Conecta con todos tus compañeros' },
              { emoji: '🎯', text: 'Acceso inmediato a todos los recursos' },
            ].map(({ emoji, text }) => (
              <div key={text} className="flex items-center gap-3">
                <span className="text-base">{emoji}</span>
                <span className="text-sm" style={{ color: '#94a3b8' }}>{text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <p className="text-xs" style={{ color: '#4b5563' }}>
            © 2025 TopCode · Ciclo Formativo DAW
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 relative">
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
              Crear una cuenta
            </h2>
            <p className="text-sm mt-1.5" style={{ color: '#64748b' }}>
              Rellena los datos para registrarte
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
            <form onSubmit={handleRegister} className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="register-nombre" className="text-xs font-semibold" style={{ color: '#94a3b8' }}>
                  Nombre completo
                </label>
                <input
                  id="register-nombre"
                  type="text"
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  placeholder="Tu nombre"
                  className="input-base"
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="register-email" className="text-xs font-semibold" style={{ color: '#94a3b8' }}>
                  Correo electrónico
                </label>
                <input
                  id="register-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  className="input-base"
                  autoComplete="email"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="register-password" className="text-xs font-semibold" style={{ color: '#94a3b8' }}>
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    id="register-password"
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="input-base pr-11"
                    autoComplete="new-password"
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

                {/* Password strength */}
                {password.length > 0 && (
                  <div className="flex items-center gap-2 animate-fade-in">
                    <div className="flex gap-1 flex-1">
                      {[1, 2, 3].map(level => (
                        <div
                          key={level}
                          className="h-1 flex-1 rounded-full transition-all duration-300"
                          style={{
                            background: passStrength >= level
                              ? strengthColors[passStrength]
                              : 'rgba(255,255,255,0.08)',
                          }}
                        />
                      ))}
                    </div>
                    <span className="text-xs font-semibold" style={{ color: strengthColors[passStrength] }}>
                      {strengthLabels[passStrength]}
                    </span>
                  </div>
                )}
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
                    Creando cuenta...
                  </div>
                ) : (
                  <>
                    Crear cuenta
                    <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Login link */}
          <div className="mt-6 text-center">
            <p className="text-sm" style={{ color: '#64748b' }}>
              ¿Ya tienes cuenta?{' '}
              <Link
                to="/login"
                className="font-semibold transition-colors duration-150 hover:text-indigo-300"
                style={{ color: '#818cf8' }}
              >
                Iniciar sesión
              </Link>
            </p>
          </div>
        </div>
      </div>

      <AlertModal
        visible={modal !== null}
        type={modal?.type}
        title={modal?.title ?? ''}
        message={modal?.message}
        onClose={() => {
          if (modal?.type === 'success') navigate('/login')
          setModal(null)
        }}
      />
    </div>
  )
}
