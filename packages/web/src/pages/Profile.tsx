import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase, subirAvatar } from '../lib/supabase'
import { useTelegramVinculo, type CodigoTelegram } from '@topcode/shared'
import { useAuth } from '../hooks/useAuth'
import AlertModal from '../components/AlertModal'
import PerfilView, { type DatosPublicos } from '../components/perfil/PerfilView'
import PerfilPublicoView, { PerfilPublicoEsqueleto, PerfilPublicoVacio, type PerfilPublico } from '../components/perfil/PerfilPublicoView'
import TelegramPanel from '../components/perfil/TelegramPanel'

type AlertState = {
  type?: 'error' | 'success' | 'info' | 'warning'
  title: string
  message?: string
  onConfirm?: () => void
  confirmLabel?: string
  confirmDestructive?: boolean
  onClose?: () => void
} | null

function PublicProfile({ userId }: { userId: string }) {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<PerfilPublico | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    Promise.resolve(supabase.rpc('get_perfil_publico', { p_usuario_id: userId }))
      .then(({ data, error: queryError }) => {
        if (!active) return
        if (queryError) setError(true)
        setProfile((data as PerfilPublico | null) ?? null)
      })
      .catch(() => { if (active) setError(true) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [userId])

  const volver = () => navigate(-1)
  if (loading) return <PerfilPublicoEsqueleto onVolver={volver} />
  if (error) return <PerfilPublicoVacio mensaje="No se pudo cargar el perfil." onVolver={volver} />
  if (!profile) return <PerfilPublicoVacio mensaje="No se encontró este perfil." onVolver={volver} />
  return <PerfilPublicoView perfil={profile} onVolver={volver} />
}

function TelegramSection() {
  const { vinculado, vinculadoDesde, telegramUserId, telegramUsername, loading, error, generarCodigo, desvincular, refresh } = useTelegramVinculo()
  const [codigo, setCodigo] = useState<CodigoTelegram | null>(null)
  const [generating, setGenerating] = useState(false)
  const [unlinking, setUnlinking] = useState(false)
  const [confirmUnlink, setConfirmUnlink] = useState(false)
  const [copied, setCopied] = useState(false)
  const [restante, setRestante] = useState(0)
  const botUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME?.replace(/^@/, '').trim()

  const expiraMs = codigo ? new Date(codigo.expiraEn).getTime() : null

  useEffect(() => {
    if (expiraMs === null) return
    const tick = () => {
      const left = Math.max(0, Math.ceil((expiraMs - Date.now()) / 1000))
      setRestante(left)
      if (left === 0) setCodigo(null)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [expiraMs])

  // Mientras hay un código activo se consulta el estado para detectar que el vínculo se ha completado en Telegram.
  const hayCodigo = codigo !== null
  useEffect(() => {
    if (!hayCodigo) return
    const id = setInterval(() => { void refresh() }, 5000)
    return () => clearInterval(id)
  }, [hayCodigo, refresh])

  useEffect(() => { if (vinculado) setCodigo(null) }, [vinculado])

  async function handleGenerar() {
    setGenerating(true)
    setCopied(false)
    const res = await generarCodigo()
    setCodigo(res)
    setGenerating(false)
  }

  async function handleDesvincular() {
    setUnlinking(true)
    const { error: err } = await desvincular()
    setUnlinking(false)
    setConfirmUnlink(false)
    if (!err) setCodigo(null)
  }

  const comando = codigo ? `/vincular ${codigo.codigo}` : ''

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(comando)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const mm = String(Math.floor(restante / 60)).padStart(2, '0')
  const ss = String(restante % 60).padStart(2, '0')

  const cuenta = telegramUsername ? `@${telegramUsername}` : telegramUserId ? `ID de Telegram ${telegramUserId}` : 'cuenta de Telegram'

  return (
    <TelegramPanel
      cargando={loading}
      vinculado={vinculado}
      vinculadoDesde={vinculadoDesde}
      cuenta={cuenta}
      codigo={codigo?.codigo ?? null}
      comando={comando}
      mm={mm}
      ss={ss}
      botUsername={botUsername}
      error={error}
      generando={generating}
      desvinculando={unlinking}
      confirmando={confirmUnlink}
      copiado={copied}
      onGenerar={handleGenerar}
      onCopiar={handleCopy}
      onPedirDesvincular={() => setConfirmUnlink(true)}
      onCancelarDesvincular={() => setConfirmUnlink(false)}
      onDesvincular={handleDesvincular}
    />
  )
}

function OwnProfile() {
  const { usuario, refreshUsuario } = useAuth()
  const navigate = useNavigate()

  const [saving, setSaving] = useState(false)
  const [savingExtended, setSavingExtended] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [alert, setAlert] = useState<AlertState>(null)

  async function handleSave(nombre: string) {
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

  async function handleAvatarChange(file: File) {
    if (!usuario) return

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

  async function handleSaveExtended(d: DatosPublicos) {
    if (!usuario) return
    setSavingExtended(true)
    const { error } = await supabase.from('usuarios').update({
      bio: d.bio.trim() || null,
      github_url: d.github_url.trim() || null,
      linkedin_url: d.linkedin_url.trim() || null,
      portfolio_url: d.portfolio_url.trim() || null,
      stack: d.stack,
    }).eq('id', usuario.id)
    await refreshUsuario()
    setSavingExtended(false)
    if (error) {
      setAlert({ type: 'error', title: 'Error', message: 'No se pudo guardar el perfil.' })
    } else {
      setAlert({ type: 'success', title: 'Guardado', message: 'Tu perfil público ha sido actualizado.' })
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  if (!usuario) return null

  return (
    <>
      <PerfilView
        usuario={usuario}
        avatarPreview={preview}
        uploading={uploading}
        savingNombre={saving}
        savingPublico={savingExtended}
        onVolver={() => navigate(-1)}
        onAvatar={handleAvatarChange}
        onGuardarNombre={handleSave}
        onGuardarPublico={handleSaveExtended}
        onLogout={handleLogout}
        telegram={usuario.rol === 'admin' && usuario.clase && usuario.estado_acceso === 'aprobado' ? <TelegramSection /> : undefined}
      />
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
    </>
  )
}

export default function Profile() {
  const { id } = useParams<{ id: string }>()
  const { usuario } = useAuth()
  if (id && id !== usuario?.id) return <PublicProfile userId={id} />
  return <OwnProfile />
}
