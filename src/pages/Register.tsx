import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, ArrowRight, GraduationCap, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'
import AlertModal from '../components/AlertModal'
import { Button, Card, Input } from '../components/ui'
import { CLASE_GROUPS } from '../constants/clases'

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
  const [clase, setClase]       = useState('')
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
    if (!nombre.trim() || !email || !clase || !password) {
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
        data: { nombre: nombre.trim(), clase },
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
    <div className="min-h-screen flex bg-bg">
      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col justify-between w-[480px] shrink-0 p-10 relative overflow-hidden bg-gradient-to-br from-surface-2 via-bg to-surface border-r border-white/5">
        <div className="absolute pointer-events-none -top-20 -left-20 w-[480px] h-[480px] bg-[radial-gradient(circle,rgba(85,239,196,0.18),transparent_70%)] blur-[40px]" />
        <div className="absolute pointer-events-none bottom-0 -right-[60px] w-[320px] h-[320px] bg-[radial-gradient(circle,rgba(0,206,201,0.12),transparent_70%)] blur-[40px]" />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-primary to-cyan-400 shadow-primary">
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
              <span className="text-xs font-semibold text-primary-light">Únete a Informática</span>
            </div>
            <h2 className="text-4xl font-extrabold leading-tight tracking-tight text-text-primary">
              Empieza tu<br />
              <span className="bg-clip-text text-transparent bg-gradient-to-br from-primary-light to-cyan-400">
                aventura
              </span>
            </h2>
            <p className="text-base leading-relaxed max-w-sm text-gray-500">
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
                <span className="text-sm text-slate-400">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <p className="text-xs text-gray-600">
            © 2025 TopCode · Informática (DAM·DAW·ASIR)
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 relative">
        <div className="absolute inset-0 pointer-events-none lg:hidden bg-[radial-gradient(ellipse_at_top,rgba(85,239,196,0.08),transparent_60%)]" />

        <div className="w-full max-w-[400px] relative animate-fade-in">
          {/* Mobile logo */}
          <div className="flex flex-col items-center gap-3 mb-10 lg:hidden">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-primary bg-gradient-to-br from-primary to-cyan-400">
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
              Crear una cuenta
            </h2>
            <p className="text-sm mt-1.5 text-text-muted">
              Rellena los datos para registrarte
            </p>
          </div>

          {/* Form card */}
          <Card padding="md">
            <form onSubmit={handleRegister} className="flex flex-col gap-5">
              <Input
                id="register-nombre"
                type="text"
                label="Nombre completo"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Tu nombre"
                autoFocus
              />

              <Input
                id="register-email"
                type="email"
                label="Correo electrónico"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@email.com"
                autoComplete="email"
              />

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Clase</span>
                <select
                  id="register-clase"
                  value={clase}
                  onChange={e => setClase(e.target.value)}
                  className="bg-input border border-white/[0.08] rounded-xl px-4 py-3 text-slate-100 text-sm transition-all duration-200 w-full outline-none focus:border-primary/50 focus:shadow-[0_0_0_3px_rgba(85,239,196,0.12)]"
                >
                  <option value="" disabled>Selecciona tu clase</option>
                  {CLASE_GROUPS.map(({ label, opciones }) => (
                    <optgroup key={label} label={label}>
                      {opciones.map(c => (
                        <option key={c.id} value={c.id}>{c.id}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Contraseña</span>
                <div className="relative">
                  <input
                    id="register-password"
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="bg-input border border-white/[0.08] rounded-xl px-4 py-3 text-slate-100 text-sm placeholder:text-text-muted transition-all duration-200 w-full outline-none pr-11 focus:border-primary/50 focus:shadow-[0_0_0_3px_rgba(85,239,196,0.12)]"
                    autoComplete="new-password"
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

                {/* Password strength */}
                {password.length > 0 && (
                  <div className="flex items-center gap-2 animate-fade-in">
                    <div className="flex gap-1 flex-1">
                      {[1, 2, 3].map(level => (
                        <div
                          key={level}
                          className="h-1 flex-1 rounded-full transition-all duration-300"
                          style={{
                            '--strength-color': passStrength >= level ? strengthColors[passStrength] : 'rgba(255,255,255,0.08)',
                            background: 'var(--strength-color)',
                          } as React.CSSProperties}
                        />
                      ))}
                    </div>
                    <span className="text-xs font-semibold" style={{ color: strengthColors[passStrength] }}>
                      {strengthLabels[passStrength]}
                    </span>
                  </div>
                )}
              </div>

              <Button type="submit" loading={loading} className="py-3 text-sm font-semibold group mt-1">
                {loading ? 'Creando cuenta...' : (
                  <>
                    Crear cuenta
                    <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </Button>
            </form>
          </Card>

          {/* Login link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-text-muted">
              ¿Ya tienes cuenta?{' '}
              <Link
                to="/login"
                className="font-semibold transition-colors duration-150 hover:text-indigo-300 text-primary-light"
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
