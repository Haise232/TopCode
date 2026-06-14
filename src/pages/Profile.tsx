import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, Save, ArrowLeft, LogOut, Shield, GraduationCap, TrendingUp, CalendarDays, Users } from 'lucide-react'
import { supabase, subirAvatar } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import AlertModal from '../components/AlertModal'
import { Badge, Button, Spinner } from '../components/ui'
import { CLASE_GROUPS, claseInfo } from '../constants/clases'

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
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [nombre, setNombre] = useState(usuario?.nombre ?? '')
  const [saving, setSaving] = useState(false)
  const [clase, setClase] = useState(usuario?.clase ?? '')
  const [savingClase, setSavingClase] = useState(false)
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

  async function handleSaveClase(e: React.FormEvent) {
    e.preventDefault()
    if (!clase) {
      setAlert({ type: 'error', title: 'Error', message: 'Selecciona una clase.' })
      return
    }
    setSavingClase(true)
    const { error } = await supabase
      .from('usuarios')
      .update({ clase })
      .eq('id', usuario!.id)
    await refreshUsuario()
    setSavingClase(false)
    if (error) {
      setAlert({ type: 'error', title: 'Error', message: 'No se pudo guardar la clase.' })
    } else {
      setAlert({ type: 'success', title: 'Guardado', message: 'Tu clase ha sido actualizada.' })
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
  const grade = gradeColor(promedio)

  return (
    <div className="animate-fade-in h-full overflow-y-auto">

      {/* ── Page header ── */}
      <div className="relative px-4 md:px-6 py-5 overflow-hidden border-b border-white/[0.08]">
        <div className="max-w-[700px] mx-auto flex items-center gap-3 relative">
          <button
            onClick={() => navigate(-1)}
            className="w-8 h-8 flex items-center justify-center rounded-xl transition-all duration-150 hover:bg-white/5 text-text-muted border border-white/[0.08]"
          >
            <ArrowLeft size={15} />
          </button>
          <h1 className="font-extrabold text-xl tracking-tight text-text-primary">Perfil</h1>
        </div>
      </div>

      <div className="max-w-[700px] mx-auto p-4 md:p-6 flex flex-col gap-4">

        {/* ── Hero avatar card ── */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-surface to-bg border border-white/[0.08]">
          {/* Background gradient accent */}
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(85,239,196,0.12),transparent_70%)]" />

          {/* Top gradient strip */}
          <div className="h-24 w-full bg-gradient-to-br from-primary/15 via-cyan-400/10 to-primary/5 border-b border-primary/10" />

          <div className="relative px-6 pb-6">
            {/* Avatar — overlaps strip */}
            <div className="relative -mt-10 mb-4 w-fit">
              <div className="w-20 h-20 overflow-hidden flex items-center justify-center rounded-2xl bg-primary/15 border-[3px] border-surface shadow-primary">
                {avatarSrc ? (
                  <img src={avatarSrc} alt={usuario?.nombre} className="w-20 h-20 object-cover" />
                ) : (
                  <span className="font-extrabold text-3xl text-primary-light">
                    {initial}
                  </span>
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute -bottom-1.5 -right-1.5 w-8 h-8 flex items-center justify-center rounded-xl transition-all duration-150 hover:opacity-90 active:scale-95 disabled:opacity-60 shadow-primary bg-gradient-to-br from-primary to-cyan-400"
                aria-label="Cambiar foto"
              >
                {uploading ? <Spinner size="sm" className="text-white" /> : <Camera size={13} className="text-white" />}
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
                <h2 className="font-bold text-xl text-text-primary">{usuario?.nombre}</h2>
                {usuario?.rol === 'admin' ? (
                  <Badge variant="admin">
                    <Shield size={10} />
                    Administrador
                  </Badge>
                ) : (
                  <Badge variant="alumno">
                    <GraduationCap size={10} />
                    Alumno
                  </Badge>
                )}
                {usuario?.clase ? (
                  <Badge
                    style={{
                      backgroundColor: claseInfo(usuario.clase)?.bg,
                      borderColor: claseInfo(usuario.clase)?.border,
                      color: claseInfo(usuario.clase)?.color,
                    }}
                  >
                    <Users size={10} />
                    {usuario.clase}
                  </Badge>
                ) : (
                  <Badge variant="alumno">
                    <Users size={10} />
                    Sin clase
                  </Badge>
                )}
              </div>
              <p className="text-sm text-text-muted">{usuario?.email}</p>
            </div>

            {/* Stats chips row */}
            <div className="flex flex-wrap gap-2">
              <div
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl"
                style={{ '--grade-color': grade } as React.CSSProperties}
              >
                <TrendingUp size={13} className="text-[var(--grade-color)]" />
                <span className="text-sm font-bold tabular-nums text-[var(--grade-color)]">
                  {promedio.toFixed(2)}
                </span>
                <span className="text-xs text-text-muted">promedio</span>
              </div>

              <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04]">
                <CalendarDays size={13} className="text-primary-light" />
                <span className="text-xs text-text-secondary">
                  Desde {new Date(usuario?.created_at ?? '').toLocaleDateString('es', { month: 'long', year: 'numeric' })}
                </span>
              </div>

              {promedio > 0 && (
                <div
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl"
                  style={{ '--grade-color': grade } as React.CSSProperties}
                >
                  <span className="text-xs font-semibold text-[var(--grade-color)]/80">
                    {gradeLabel(promedio)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Edit name ── */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-surface to-bg border border-white/[0.08]">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1.5 h-5 rounded-full bg-gradient-to-b from-primary to-cyan-400" />
            <h2 className="font-semibold text-base text-text-primary">Editar nombre</h2>
          </div>
          <form onSubmit={handleSave} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-text-secondary">Nombre visible</label>
              <input
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Tu nombre"
                className="bg-input border border-white/[0.08] rounded-xl px-4 py-3 text-slate-100 text-sm placeholder:text-text-muted transition-all duration-200 w-full outline-none focus:border-primary/50 focus:shadow-[0_0_0_3px_rgba(85,239,196,0.12)]"
              />
            </div>
            <Button
              type="submit"
              disabled={saving || nombre.trim() === usuario?.nombre}
              icon={<Save size={14} />}
              className="py-2.5 text-sm"
            >
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </form>
        </div>

        {/* ── Editar clase ── */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-surface to-bg border border-white/[0.08]">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1.5 h-5 rounded-full bg-gradient-to-b from-primary to-cyan-400" />
            <h2 className="font-semibold text-base text-text-primary">Tu clase</h2>
          </div>
          <form onSubmit={handleSaveClase} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-text-secondary">Grupo-clase</label>
              <select
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
            <Button
              type="submit"
              disabled={savingClase || !clase || clase === usuario?.clase}
              icon={<Save size={14} />}
              className="py-2.5 text-sm"
            >
              {savingClase ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </form>
        </div>

        {/* ── Sesión ── */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-surface to-bg border border-white/[0.08]">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1.5 h-5 rounded-full bg-gradient-to-b from-rose-500 to-rose-700" />
            <h2 className="font-semibold text-base text-text-primary">Sesión</h2>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 group bg-rose-500/5 border border-rose-500/15 text-text-secondary hover:bg-rose-500/10 hover:border-rose-500/35 hover:text-rose-500"
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
