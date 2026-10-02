import { useEffect, useState, useRef, KeyboardEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Camera, Save, ArrowLeft, LogOut, Shield, GraduationCap, TrendingUp, CalendarDays, Users, Github, Globe, Link2, Code, X as XIcon } from 'lucide-react'
import { supabase, subirAvatar } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import AlertModal from '../components/AlertModal'
import { Badge, Button, Spinner } from '../components/ui'

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
  if (n >= 8) return '#2f8f75'
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

type PublicProfileData = {
  id: string
  nombre: string
  avatar_url: string | null
  rol: 'alumno' | 'admin'
  clase: string | null
  es_superadmin: boolean
  bio: string | null
  stack: string[]
  github_url: string | null
  linkedin_url: string | null
  portfolio_url: string | null
}

function PublicProfile({ userId }: { userId: string }) {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<PublicProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    Promise.resolve(supabase.rpc('get_perfil_publico', { p_usuario_id: userId }))
      .then(({ data, error: queryError }) => {
        if (!active) return
        if (queryError) setError(true)
        setProfile((data as PublicProfileData | null) ?? null)
      })
      .catch(() => { if (active) setError(true) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [userId])

  if (loading) return <div className="p-8 text-center text-text-muted">Cargando perfil...</div>
  if (error) return <div className="p-8 text-center text-text-muted">No se pudo cargar el perfil.</div>
  if (!profile) return <div className="p-8 text-center text-text-muted">No se encontró este perfil.</div>

  const initial = profile.nombre[0]?.toUpperCase() ?? 'U'
  return (
    <div className="animate-fade-in h-full overflow-y-auto">
      <div className="relative px-4 md:px-6 py-5 border-b border-white/[0.08]">
        <div className="max-w-[700px] mx-auto flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-8 h-8 flex items-center justify-center rounded-xl text-text-muted border border-white/[0.08] hover:bg-white/5" aria-label="Volver">
            <ArrowLeft size={15} />
          </button>
          <h1 className="font-extrabold text-xl tracking-tight text-text-primary">Perfil</h1>
        </div>
      </div>
      <div className="max-w-[700px] mx-auto p-4 md:p-6">
        <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-surface to-bg border border-white/[0.08]">
          <div className="h-24 bg-gradient-to-br from-primary/15 via-primary-dark/10 to-primary/5 border-b border-primary/10" />
          <div className="relative px-6 pb-6">
            <div className="relative -mt-10 mb-4 w-fit">
              <div className="w-20 h-20 overflow-hidden flex items-center justify-center rounded-2xl bg-primary/15 border-[3px] border-surface shadow-primary">
                {profile.avatar_url ? <img src={profile.avatar_url} alt={profile.nombre} className="w-20 h-20 object-cover" /> : <span className="font-extrabold text-3xl text-primary-light">{initial}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="font-bold text-xl text-text-primary">{profile.nombre}</h2>
              {profile.rol === 'admin' ? (
                <Badge variant="admin"><Shield size={10} />{profile.es_superadmin ? 'Master' : 'Administrador'}</Badge>
              ) : (
                <Badge variant="alumno"><GraduationCap size={10} />Alumno</Badge>
              )}
              <Badge variant="alumno"><Users size={10} />{profile.clase ?? 'Sin clase'}</Badge>
            </div>
            {profile.bio && <p className="mt-4 text-sm leading-relaxed text-text-secondary whitespace-pre-wrap">{profile.bio}</p>}
            {profile.stack.length > 0 && <div className="flex flex-wrap gap-2 mt-4">{profile.stack.map(tag => <span key={tag} className="text-xs px-2.5 py-1 rounded-lg bg-white/[0.05] text-text-secondary border border-white/[0.08]">{tag}</span>)}</div>}
          </div>
        </div>
      </div>
    </div>
  )
}

function OwnProfile() {
  const { usuario, refreshUsuario } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [nombre, setNombre] = useState(usuario?.nombre ?? '')
  const [saving, setSaving] = useState(false)

  // Extended profile
  const [bio, setBio] = useState(usuario?.bio ?? '')
  const [githubUrl, setGithubUrl] = useState(usuario?.github_url ?? '')
  const [linkedinUrl, setLinkedinUrl] = useState(usuario?.linkedin_url ?? '')
  const [portfolioUrl, setPortfolioUrl] = useState(usuario?.portfolio_url ?? '')
  const [stack, setStack] = useState<string[]>(usuario?.stack ?? [])
  const [stackInput, setStackInput] = useState('')
  const [savingExtended, setSavingExtended] = useState(false)
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

    // La ruta es siempre la misma (avatar.ext): sin versión el navegador
    // seguiría mostrando la imagen antigua desde caché.
    const { error } = await supabase
      .from('usuarios')
      .update({ avatar_url: `${url}?v=${Date.now()}` })
      .eq('id', usuario.id)
    if (error) {
      setPreview(null)
      setUploading(false)
      setAlert({ type: 'error', title: 'Error', message: 'La imagen se subió pero no se pudo guardar en tu perfil.' })
      return
    }
    await refreshUsuario()
    setPreview(null)
    setUploading(false)
    setAlert({ type: 'success', title: 'Avatar actualizado', message: 'Tu foto de perfil ha sido cambiada.' })
  }

  async function handleSaveExtended(e: React.FormEvent) {
    e.preventDefault()
    if (!usuario) return
    setSavingExtended(true)
    const { error } = await supabase.from('usuarios').update({
      bio: bio.trim() || null,
      github_url: githubUrl.trim() || null,
      linkedin_url: linkedinUrl.trim() || null,
      portfolio_url: portfolioUrl.trim() || null,
      stack,
    }).eq('id', usuario.id)
    await refreshUsuario()
    setSavingExtended(false)
    if (error) {
      setAlert({ type: 'error', title: 'Error', message: 'No se pudo guardar el perfil.' })
    } else {
      setAlert({ type: 'success', title: 'Guardado', message: 'Tu perfil público ha sido actualizado.' })
    }
  }

  function addStackTag() {
    const tag = stackInput.trim().replace(/,/g, '')
    if (tag && !stack.includes(tag) && stack.length < 12) {
      setStack(prev => [...prev, tag])
    }
    setStackInput('')
  }

  function handleStackKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addStackTag() }
    if (e.key === 'Backspace' && stackInput === '' && stack.length > 0) {
      setStack(prev => prev.slice(0, -1))
    }
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
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(61,159,137,0.12),transparent_70%)]" />

          {/* Top gradient strip */}
          <div className="h-24 w-full bg-gradient-to-br from-primary/15 via-primary-dark/10 to-primary/5 border-b border-primary/10" />

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
                className="absolute -bottom-1.5 -right-1.5 w-8 h-8 flex items-center justify-center rounded-xl transition-all duration-150 hover:opacity-90 active:scale-95 disabled:opacity-60 shadow-primary bg-gradient-to-br from-primary to-primary-dark"
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
                    {usuario.es_superadmin ? 'Master' : 'Administrador'}
                  </Badge>
                ) : (
                  <Badge variant="alumno">
                    <GraduationCap size={10} />
                    Alumno
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
            <div className="w-1.5 h-5 rounded-full bg-gradient-to-b from-primary to-primary-dark" />
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
                className="bg-input border border-white/[0.08] rounded-xl px-4 py-3 text-slate-100 text-sm placeholder:text-text-muted transition-all duration-200 w-full outline-none focus:border-primary/50 focus:shadow-[0_0_0_3px_rgba(61,159,137,0.12)]"
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

        {/* ── Perfil público ── */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-surface to-bg border border-white/[0.08]">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1.5 h-5 rounded-full bg-gradient-to-b from-primary to-primary-dark" />
            <h2 className="font-semibold text-base text-text-primary">Perfil público</h2>
          </div>
          <form onSubmit={handleSaveExtended} className="flex flex-col gap-3">
            {/* Bio */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-text-secondary">Bio</label>
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value)}
                maxLength={200}
                rows={2}
                placeholder="Cuéntanos algo de ti..."
                className="bg-input border border-white/[0.08] rounded-xl px-4 py-3 text-slate-100 text-sm placeholder:text-text-muted transition-all duration-200 w-full outline-none focus:border-primary/50 focus:shadow-[0_0_0_3px_rgba(61,159,137,0.12)] resize-none"
              />
              <p className="text-[10px] text-right text-text-muted">{bio.length}/200</p>
            </div>

            {/* GitHub */}
            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                <Github size={11} /> GitHub
              </label>
              <input
                value={githubUrl}
                onChange={e => setGithubUrl(e.target.value)}
                type="url"
                placeholder="https://github.com/usuario"
                className="bg-input border border-white/[0.08] rounded-xl px-4 py-3 text-slate-100 text-sm placeholder:text-text-muted transition-all duration-200 w-full outline-none focus:border-primary/50 focus:shadow-[0_0_0_3px_rgba(61,159,137,0.12)]"
              />
            </div>

            {/* LinkedIn */}
            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                <Link2 size={11} /> LinkedIn
              </label>
              <input
                value={linkedinUrl}
                onChange={e => setLinkedinUrl(e.target.value)}
                type="url"
                placeholder="https://linkedin.com/in/usuario"
                className="bg-input border border-white/[0.08] rounded-xl px-4 py-3 text-slate-100 text-sm placeholder:text-text-muted transition-all duration-200 w-full outline-none focus:border-primary/50 focus:shadow-[0_0_0_3px_rgba(61,159,137,0.12)]"
              />
            </div>

            {/* Portfolio */}
            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                <Globe size={11} /> Portfolio / Web
              </label>
              <input
                value={portfolioUrl}
                onChange={e => setPortfolioUrl(e.target.value)}
                type="url"
                placeholder="https://miportfolio.dev"
                className="bg-input border border-white/[0.08] rounded-xl px-4 py-3 text-slate-100 text-sm placeholder:text-text-muted transition-all duration-200 w-full outline-none focus:border-primary/50 focus:shadow-[0_0_0_3px_rgba(61,159,137,0.12)]"
              />
            </div>

            {/* Stack */}
            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                <Code size={11} /> Tecnologías ({stack.length}/12)
              </label>
              <div
                className="bg-input border border-white/[0.08] rounded-xl px-3 py-2.5 flex flex-wrap gap-1.5 items-center min-h-[46px] focus-within:border-primary/50 focus-within:shadow-[0_0_0_3px_rgba(61,159,137,0.12)] transition-all duration-200"
              >
                {stack.map(tag => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold"
                    style={{ background: 'rgba(61,159,137,0.1)', color: '#3d9f89', border: '1px solid rgba(61,159,137,0.2)' }}
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => setStack(prev => prev.filter(t => t !== tag))}
                      className="hover:opacity-70 transition-opacity"
                    >
                      <XIcon size={10} />
                    </button>
                  </span>
                ))}
                {stack.length < 12 && (
                  <input
                    value={stackInput}
                    onChange={e => setStackInput(e.target.value)}
                    onKeyDown={handleStackKeyDown}
                    onBlur={addStackTag}
                    placeholder={stack.length === 0 ? 'React, Python, SQL... (Enter para añadir)' : ''}
                    className="flex-1 min-w-[120px] bg-transparent text-sm text-slate-100 placeholder:text-text-muted outline-none"
                  />
                )}
              </div>
            </div>

            <Button
              type="submit"
              disabled={savingExtended}
              icon={<Save size={14} />}
              className="py-2.5 text-sm"
            >
              {savingExtended ? 'Guardando...' : 'Guardar perfil público'}
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

export default function Profile() {
  const { id } = useParams<{ id: string }>()
  const { usuario } = useAuth()
  if (id && id !== usuario?.id) return <PublicProfile userId={id} />
  return <OwnProfile />
}
