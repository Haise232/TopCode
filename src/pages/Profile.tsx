import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, Save, ArrowLeft, LogOut, Shield, GraduationCap } from 'lucide-react'
import { supabase, subirAvatar } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
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

export default function Profile() {
  const { usuario, refreshUsuario } = useAuth()
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

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="relative px-4 md:px-6 py-5 overflow-hidden" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-[1100px] mx-auto flex items-center gap-3 relative">
          <button
            onClick={() => navigate(-1)}
            className="w-8 h-8 flex items-center justify-center rounded-xl transition-all duration-150 hover:bg-white/5"
            style={{ color: '#64748b', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <ArrowLeft size={15} />
          </button>
          <h1 className="font-extrabold text-xl tracking-tight" style={{ color: '#f1f5f9' }}>Perfil</h1>
        </div>
      </div>

      <div className="max-w-[600px] mx-auto p-4 md:p-6 flex flex-col gap-4">
        {/* Avatar card */}
        <div className="p-6 flex flex-col items-center gap-4 rounded-2xl" style={{ background: '#1a1d27', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="relative">
            <div
              className="w-24 h-24 overflow-hidden flex items-center justify-center rounded-2xl"
              style={{ background: 'rgba(99,102,241,0.12)', border: '2px solid rgba(99,102,241,0.3)' }}
            >
              {avatarSrc ? (
                <img src={avatarSrc} alt={usuario?.nombre} className="w-24 h-24 object-cover" />
              ) : (
                <span className="font-extrabold text-4xl" style={{ color: '#818cf8' }}>
                  {(usuario?.nombre?.[0] ?? 'U').toUpperCase()}
                </span>
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-2 -right-2 w-8 h-8 flex items-center justify-center rounded-xl transition-all duration-150 hover:opacity-90 disabled:opacity-60 shadow-primary"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            >
              {uploading ? (
                <div className="w-4 h-4 rounded-full animate-spin" style={{ border: '1.5px solid rgba(255,255,255,0.2)', borderTopColor: 'white' }} />
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

          <div className="text-center">
            <p className="font-bold text-lg" style={{ color: '#f1f5f9' }}>{usuario?.nombre}</p>
            <p className="text-sm" style={{ color: '#64748b' }}>{usuario?.email}</p>
            <div className="flex justify-center mt-2">
              {usuario?.rol === 'admin' ? (
                <span
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full"
                  style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)', color: '#818cf8' }}
                >
                  <Shield size={11} />
                  Administrador
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#64748b' }}
                >
                  <GraduationCap size={11} />
                  Alumno
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 text-center rounded-2xl" style={{ background: '#1a1d27', border: `1px solid ${gradeColor(promedio)}20` }}>
            <p className="text-2xl font-extrabold" style={{ color: gradeColor(promedio) }}>
              {promedio.toFixed(2)}
            </p>
            <p className="text-xs font-medium uppercase tracking-wider mt-1" style={{ color: '#64748b' }}>
              Promedio general
            </p>
          </div>
          <div className="p-4 text-center rounded-2xl" style={{ background: '#1a1d27', border: '1px solid rgba(255,255,255,0.07)' }}>
            <p className="text-xl font-extrabold" style={{ color: '#f1f5f9' }}>
              {new Date(usuario?.created_at ?? '').toLocaleDateString('es', { month: 'short', year: 'numeric' })}
            </p>
            <p className="text-xs font-medium uppercase tracking-wider mt-1" style={{ color: '#64748b' }}>
              Miembro desde
            </p>
          </div>
        </div>

        {/* Edit name */}
        <div className="p-5 rounded-2xl" style={{ background: '#1a1d27', border: '1px solid rgba(255,255,255,0.07)' }}>
          <h2 className="font-semibold text-base mb-4" style={{ color: '#f1f5f9' }}>Editar nombre</h2>
          <form onSubmit={handleSave} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold" style={{ color: '#94a3b8' }}>Nombre</label>
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
              className="btn-primary py-3 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Save size={15} />
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </form>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex items-center justify-center gap-2 py-3 font-semibold rounded-2xl transition-all duration-150"
          style={{ border: '1px solid rgba(244,63,94,0.15)', color: '#64748b', background: 'transparent' }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement
            el.style.color = '#f43f5e'
            el.style.borderColor = 'rgba(244,63,94,0.35)'
            el.style.background = 'rgba(244,63,94,0.06)'
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement
            el.style.color = '#64748b'
            el.style.borderColor = 'rgba(244,63,94,0.15)'
            el.style.background = 'transparent'
          }}
        >
          <LogOut size={15} />
          Cerrar sesión
        </button>
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
