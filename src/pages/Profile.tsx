import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, Save, ArrowLeft, LogOut, Shield, GraduationCap, TrendingUp, CalendarDays, Sun, Moon } from 'lucide-react'
import { supabase, subirAvatar } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../contexts/ThemeContext'
import AlertModal from '../components/AlertModal'

type AlertState = {
  type?: 'error' | 'success' | 'info' | 'warning'
  title: string
  message?: string
  onConfirm?: () => void
  confirmLabel?: string
  confirmDestructive?: boolean
  onClose?: () => void
} | null

function gradeColor(n: number) {
  if (n >= 8) return '#10b981'
  if (n >= 6) return '#f59e0b'
  return '#f43f5e'
}

function gradeLabel(n: number) {
  if (n >= 9) return 'Excelente'
  if (n >= 8) return 'Notable'
  if (n >= 6) return 'Bien'
  if (n >= 5) return 'Suficiente'
  return 'Insuficiente'
}

export default function Profile() {
  const { usuario, refreshUsuario } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [nombre, setNombre] = useState(usuario?.nombre ?? '')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [alert, setAlert] = useState<AlertState>(null)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) {
      setAlert({ type: 'error', title: 'Error', message: 'El nombre no puede estar vacío.' })
      return
    }
    setSaving(true)
    const { error } = await supabase
      .from('usuarios')
      .update({ nombre: nombre.trim() })
      .eq('id', usuario!.id)
    await refreshUsuario()
    setSaving(false)
    if (error) {
      setAlert({ type: 'error', title: 'Error', message: 'No se pudo guardar el nombre.' })
    } else {
      setAlert({ type: 'success', title: 'Guardado', message: 'Tu nombre ha sido actualizado.' })
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !usuario) return
    e.target.value = ''

    if (!file.type.startsWith('image/')) {
      setAlert({ type: 'error', title: 'Formato no válido', message: 'Solo se aceptan imágenes (JPG, PNG, WebP).' })
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setAlert({ type: 'error', title: 'Imagen muy grande', message: 'La imagen no puede superar los 5 MB.' })
      return
    }

    const objectUrl = URL.createObjectURL(file)
    setPreview(objectUrl)
    setUploading(true)

    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${usuario.id}/avatar.${ext}`
    const url = await subirAvatar(file, path)

    URL.revokeObjectURL(objectUrl)

    if (!url) {
      setUploading(false)
      setPreview(null)
      setAlert({ type: 'error', title: 'Error', message: 'No se pudo subir la imagen.' })
      return
    }

    await supabase.from('usuarios').update({ avatar_url: url }).eq('id', usuario.id)
    await refreshUsuario()
    setPreview(null)
    setUploading(false)
    setAlert({ type: 'success', title: 'Avatar actualizado', message: 'Tu foto de perfil ha sido cambiada.' })
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const avatarSrc = preview ?? usuario?.avatar_url ?? null
  const promedio = usuario?.promedio ?? 0
  const initial = (usuario?.nombre?.[0] ?? 'U').toUpperCase()

  return (
    <div className="animate-fade-in h-full overflow-y-auto">

      {/* ── Page header ── */}
      <div
        className="relative px-4 md:px-6 py-5 overflow-hidden"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="max-w-[700px] mx-auto flex items-center gap-3 relative">
          <button
            onClick={() => navigate(-1)}
            className="w-8 h-8 flex items-center justify-center rounded-xl transition-all duration-150 hover:bg-white/5"
            style={{ color: 'var(--color-text-muted)', border: '1px solid var(--border)' }}
          >
            <ArrowLeft size={15} />
          </button>
          <h1 className="font-extrabold text-xl tracking-tight" style={{ color: 'var(--color-text)' }}>Perfil</h1>
        </div>
      </div>

      <div className="max-w-[700px] mx-auto p-4 md:p-6 flex flex-col gap-4">

        {/* ── Hero avatar card ── */}
        <div
          className="relative overflow-hidden rounded-2xl"
          style={{
            background: 'linear-gradient(145deg, var(--color-surface) 0%, var(--color-bg) 100%)',
            border: '1px solid var(--border)',
          }}
        >
          {/* Background gradient accent */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse 80% 60% at 50% -20%, rgba(85,239,196,0.12) 0%, transparent 70%)',
            }}
          />

          {/* Top gradient strip */}
          <div
            className="h-24 w-full"
            style={{
              background: 'linear-gradient(135deg, rgba(85,239,196,0.15) 0%, rgba(0,206,201,0.1) 50%, rgba(85,239,196,0.05) 100%)',
              borderBottom: '1px solid rgba(85,239,196,0.1)',
            }}
          />

          <div className="relative px-6 pb-6">
            {/* Avatar — overlaps strip */}
            <div className="relative -mt-10 mb-4 w-fit">
              <div
                className="w-20 h-20 overflow-hidden flex items-center justify-center rounded-2xl"
                style={{
                  background: 'rgba(85,239,196,0.15)',
                  border: '3px solid var(--color-surface)',
                  boxShadow: '0 4px 20px rgba(85,239,196,0.25)',
                }}
              >
                {avatarSrc ? (
                  <img src={avatarSrc} alt={usuario?.nombre} className="w-20 h-20 object-cover" />
                ) : (
                  <span className="font-extrabold text-3xl" style={{ color: 'var(--color-primary-light)' }}>
                    {initial}
                  </span>
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute -bottom-1.5 -right-1.5 w-8 h-8 flex items-center justify-center rounded-xl transition-all duration-150 hover:opacity-90 active:scale-95 disabled:opacity-60 shadow-primary"
                style={{ background: 'linear-gradient(135deg, #55efc4, #00cec9)' }}
                aria-label="Cambiar foto"
              >
                {uploading ? (
                  <div
                    className="w-4 h-4 rounded-full animate-spin"
                    style={{ border: '1.5px solid var(--overlay-20)', borderTopColor: 'white' }}
                  />
                ) : (
                  <Camera size={13} className="text-white" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>

            {/* Info */}
            <div className="flex flex-col gap-1 mb-5">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="font-bold text-xl" style={{ color: 'var(--color-text)' }}>{usuario?.nombre}</h2>
                {usuario?.rol === 'admin' ? (
                  <span
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{
                      background: 'rgba(85,239,196,0.15)',
                      border: '1px solid rgba(85,239,196,0.3)',
                      color: 'var(--color-primary-light)',
                    }}
                  >
                    <Shield size={10} />
                    Administrador
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
                    style={{
                      background: 'var(--color-surface-alpha)',
                      border: '1px solid var(--border)',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    <GraduationCap size={10} />
                    Alumno
                  </span>
                )}
              </div>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{usuario?.email}</p>
            </div>

            {/* Stats chips row */}
            <div className="flex flex-wrap gap-2">
              <div
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl"
                style={{
                  background: `${gradeColor(promedio)}12`,
                  border: `1px solid ${gradeColor(promedio)}28`,
                }}
              >
                <TrendingUp size={13} style={{ color: gradeColor(promedio) }} />
                <span className="text-sm font-bold tabular-nums" style={{ color: gradeColor(promedio) }}>
                  {promedio.toFixed(2)}
                </span>
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>promedio</span>
              </div>

              <div
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl"
                style={{
                  background: 'var(--color-surface-alpha)',
                  border: '1px solid var(--border)',
                }}
              >
                <CalendarDays size={13} style={{ color: 'var(--color-primary-light)' }} />
                <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  Desde {new Date(usuario?.created_at ?? '').toLocaleDateString('es', { month: 'long', year: 'numeric' })}
                </span>
              </div>

              {promedio > 0 && (
                <div
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl"
                  style={{
                    background: `${gradeColor(promedio)}08`,
                    border: `1px solid ${gradeColor(promedio)}18`,
                  }}
                >
                  <span className="text-xs font-semibold" style={{ color: `${gradeColor(promedio)}cc` }}>
                    {gradeLabel(promedio)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Edit name ── */}
        <div
          className="p-5 rounded-2xl"
          style={{
            background: 'linear-gradient(145deg, var(--color-surface), var(--color-bg))',
            border: '1px solid var(--border)',
          }}
        >
          <div className="flex items-center gap-2 mb-4">
            <div
              className="w-1.5 h-5 rounded-full"
              style={{ background: 'linear-gradient(180deg, #55efc4, #00cec9)' }}
            />
            <h2 className="font-semibold text-base" style={{ color: 'var(--color-text)' }}>Editar nombre</h2>
          </div>
          <form onSubmit={handleSave} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Nombre visible</label>
              <input
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Tu nombre"
                className="input-base"
              />
            </div>
            <button
              type="submit"
              disabled={saving || nombre.trim() === usuario?.nombre}
              className="btn-primary py-2.5 flex items-center justify-center gap-2 text-sm"
            >
              <Save size={14} />
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </form>
        </div>

        {/* ── Apariencia ── */}
        <div
          className="p-5 rounded-2xl"
          style={{
            background: 'linear-gradient(145deg, var(--color-surface), var(--color-bg))',
            border: '1px solid var(--border)',
          }}
        >
          <div className="flex items-center gap-2 mb-4">
            <div
              className="w-1.5 h-5 rounded-full"
              style={{ background: 'linear-gradient(180deg, #f59e0b, #55efc4)' }}
            />
            <h2 className="font-semibold text-base" style={{ color: 'var(--color-text)' }}>Apariencia</h2>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {theme === 'dark'
                ? <Moon size={16} style={{ color: 'var(--color-primary-light)' }} />
                : <Sun size={16} style={{ color: '#f59e0b' }} />
              }
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                  {theme === 'dark' ? 'Modo oscuro' : 'Modo claro'}
                </p>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                </p>
              </div>
            </div>
            <button
              onClick={toggleTheme}
              role="switch"
              aria-checked={theme === 'light'}
              aria-label="Cambiar tema"
              className="relative w-12 h-6 rounded-full transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary shrink-0"
              style={{ background: theme === 'light' ? '#f59e0b' : 'var(--overlay-12)' }}
            >
              <span
                className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-300"
                style={{ transform: theme === 'light' ? 'translateX(24px)' : 'translateX(0)' }}
              />
            </button>
          </div>
        </div>

        {/* ── Sesión ── */}
        <div
          className="p-5 rounded-2xl"
          style={{
            background: 'linear-gradient(145deg, var(--color-surface), var(--color-bg))',
            border: '1px solid var(--border)',
          }}
        >
          <div className="flex items-center gap-2 mb-4">
            <div
              className="w-1.5 h-5 rounded-full"
              style={{ background: 'linear-gradient(180deg, #f43f5e, #e11d48)' }}
            />
            <h2 className="font-semibold text-base" style={{ color: 'var(--color-text)' }}>Sesión</h2>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 group"
            style={{
              background: 'rgba(244,63,94,0.06)',
              border: '1px solid rgba(244,63,94,0.15)',
              color: 'var(--color-text-secondary)',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement
              el.style.color = '#f43f5e'
              el.style.borderColor = 'rgba(244,63,94,0.35)'
              el.style.background = 'rgba(244,63,94,0.1)'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement
              el.style.color = 'var(--color-text-secondary)'
              el.style.borderColor = 'rgba(244,63,94,0.15)'
              el.style.background = 'rgba(244,63,94,0.06)'
            }}
          >
            <LogOut size={14} />
            Cerrar sesión
          </button>
        </div>

      </div>

      <AlertModal
        visible={alert !== null}
        type={alert?.type}
        title={alert?.title ?? ''}
        message={alert?.message}
        onClose={() => {
          alert?.onClose?.()
          setAlert(null)
        }}
        onConfirm={alert?.onConfirm}
        confirmLabel={alert?.confirmLabel}
        confirmDestructive={alert?.confirmDestructive}
      />
    </div>
  )
}
