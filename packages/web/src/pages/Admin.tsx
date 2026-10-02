import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Users, RefreshCw, Settings, GraduationCap, TrendingUp, Megaphone, Plus, Trash2, Eye, EyeOff, Check, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Usuario, Anuncio } from '@topcode/shared'
import AlertModal from '../components/AlertModal'
import AdminHorario from '../components/AdminHorario'
import { SkeletonBox, SkeletonCard } from '../components/Skeleton'
import { Badge, Spinner } from '../components/ui'

type AlertState = {
  type?: 'error' | 'success' | 'info' | 'warning'
  title: string
  message: string
  onConfirm?: () => void
  confirmLabel?: string
  confirmDestructive?: boolean
} | null

function AdminSkeleton() {
  return (
    <div className="animate-fade-in">
      <div className="px-4 md:px-6 py-5 flex justify-between items-center" style={{ borderBottom: '1px solid var(--overlay-06)' }}>
        <SkeletonBox className="h-7 w-36 shimmer" />
        <SkeletonBox className="h-9 w-9 shimmer rounded-xl" />
      </div>
      <div className="max-w-[1100px] mx-auto p-4 md:p-6 flex flex-col gap-5">
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map(i => (
            <SkeletonCard key={i} className="flex items-center gap-3 py-5">
              <SkeletonBox className="h-10 w-10 shrink-0 shimmer rounded-xl" />
              <div className="flex flex-col gap-2">
                <SkeletonBox className="h-6 w-10 shimmer" />
                <SkeletonBox className="h-3 w-16 shimmer" />
              </div>
            </SkeletonCard>
          ))}
        </div>
        <SkeletonCard className="p-0 overflow-hidden">
          <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--overlay-06)' }}>
            <SkeletonBox className="h-5 w-24 shimmer" />
          </div>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex items-center gap-3 px-4 py-3.5" style={{ borderBottom: '1px solid var(--overlay-04)' }}>
              <SkeletonBox className="h-10 w-10 shrink-0 shimmer rounded-xl" />
              <div className="flex-1 flex flex-col gap-2">
                <SkeletonBox className="h-4 w-32 shimmer" />
                <SkeletonBox className="h-3 w-48 shimmer" />
              </div>
              <SkeletonBox className="h-8 w-20 shimmer rounded-xl" />
            </div>
          ))}
        </SkeletonCard>
      </div>
    </div>
  )
}

export default function Admin() {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const [users, setUsers] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [updating, setUpdating] = useState<string | null>(null)
  const [alert, setAlert] = useState<AlertState>(null)

  // ── Anuncios ──
  const [anuncios, setAnuncios] = useState<Anuncio[]>([])
  const [nuevoTitulo, setNuevoTitulo] = useState('')
  const [nuevoContenido, setNuevoContenido] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)

  const cargarAnuncios = useCallback(async () => {
    const { data } = await supabase
      .from('anuncios')
      .select('id, titulo, contenido, activo, created_at, created_by')
      .order('created_at', { ascending: false })
      .limit(10)
    if (data) setAnuncios(data as Anuncio[])
  }, [])

  async function handlePublicar(e: React.FormEvent) {
    e.preventDefault()
    if (!nuevoTitulo.trim() || !nuevoContenido.trim()) return
    setGuardando(true)
    const { error } = await Promise.race([
      supabase.from('anuncios').insert({
        titulo: nuevoTitulo.trim(),
        contenido: nuevoContenido.trim(),
        activo: true,
        created_by: usuario!.id,
      }),
      new Promise<{ error: { message: string } }>(resolve =>
        setTimeout(() => resolve({ error: { message: 'Tiempo de espera agotado. Inténtalo de nuevo.' } }), 30000)
      ),
    ])
    setGuardando(false)
    if (error) {
      setAlert({ type: 'error', title: 'Error', message: error.message })
      return
    }
    setNuevoTitulo('')
    setNuevoContenido('')
    cargarAnuncios()
  }

  async function handleToggleActivo(a: Anuncio) {
    setToggling(a.id)
    const { error } = await supabase.from('anuncios').update({ activo: !a.activo }).eq('id', a.id)
    setToggling(null)
    if (error) setAlert({ type: 'error', title: 'Error', message: 'No se pudo cambiar el estado del anuncio.' })
    cargarAnuncios()
  }

  function handleEliminarAnuncio(a: Anuncio) {
    setAlert({
      title: 'Eliminar anuncio',
      message: `¿Eliminar "${a.titulo}"? Los usuarios que no lo hayan leído dejarán de verlo.`,
      confirmLabel: 'Eliminar',
      confirmDestructive: true,
      onConfirm: async () => {
        const { error } = await supabase.from('anuncios').delete().eq('id', a.id)
        if (error) setAlert({ type: 'error', title: 'Error', message: 'No se pudo eliminar el anuncio.' })
        await cargarAnuncios()
      },
    })
  }

  const cargar = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_todos_usuarios')
      if (error) setAlert({ type: 'error', title: 'Error', message: error.message })
      if (data) setUsers(data as Usuario[])
    } catch {
      setAlert({ type: 'error', title: 'Error', message: 'No se pudieron cargar los usuarios.' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (usuario && usuario.rol !== 'admin') {
      navigate('/', { replace: true })
      return
    }
    cargar()
    if (usuario?.es_superadmin === true) cargarAnuncios()
  }, [cargar, cargarAnuncios, usuario, navigate])

  function toggleRol(u: Usuario) {
    if (u.id === usuario?.id) return
    if (!puedeGestionarUsuario(u)) return
    const newRol: 'alumno' | 'admin' = u.rol === 'admin' ? 'alumno' : 'admin'
    const mensaje = newRol === 'admin'
      ? `¿Seguro que quieres hacer administrador a ${u.nombre}?`
      : `¿Seguro que quieres quitarle el rol de administrador a ${u.nombre}?`
    setAlert({
      title: newRol === 'admin' ? 'Dar permisos de administrador' : 'Quitar administrador',
      message: mensaje,
      confirmLabel: 'Confirmar',
      onConfirm: async () => {
        setUpdating(u.id)
        const { error } = await supabase
          .from('usuarios')
          .update({ rol: newRol })
          .eq('id', u.id)
        setUpdating(null)
        if (error) {
          setAlert({ type: 'error', title: 'Error', message: 'No se pudo cambiar el rol: ' + error.message })
        } else {
          await cargar()
        }
      },
    })
  }

  async function cambiarAcceso(u: Usuario, estado: 'aprobado' | 'rechazado') {
    if (!puedeGestionarUsuario(u)) return
    setUpdating(u.id)
    const { error } = await supabase
      .from('usuarios')
      .update({ estado_acceso: estado })
      .eq('id', u.id)
    setUpdating(null)
    if (error) {
      setAlert({ type: 'error', title: 'Error', message: 'No se pudo actualizar la solicitud: ' + error.message })
    } else {
      await cargar()
    }
  }

  const isSuperAdmin = usuario?.es_superadmin === true
  const puedeGestionarUsuario = (u: Usuario) => isSuperAdmin || (
    usuario?.rol === 'admin' && usuario.clase !== null && u.clase === usuario.clase
  )
  const usuariosVisibles = isSuperAdmin
    ? users
    : users.filter(u => u.clase === usuario?.clase)
  const admins  = usuariosVisibles.filter(u => u.rol === 'admin')
  const alumnos = usuariosVisibles.filter(u => u.rol === 'alumno')
  const usersFiltrados = usuariosVisibles

  if (loading) return <AdminSkeleton />

  return (
    <div className="animate-fade-in h-full overflow-y-auto">

      {/* ── Header ── */}
      <div
        className="relative px-4 md:px-6 py-5 overflow-hidden"
        style={{ borderBottom: '1px solid var(--overlay-06)' }}
      >
        <div className="max-w-[1100px] mx-auto flex justify-between items-center relative">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 flex items-center justify-center rounded-xl"
              style={{ background: 'rgba(61,159,137,0.12)', border: '1px solid rgba(61,159,137,0.2)' }}
            >
              <Settings size={15} className="text-primary-light" />
            </div>
            <div>
              <h1 className="font-extrabold text-xl tracking-tight text-text-primary">Panel Admin</h1>
              <p className="text-xs text-text-muted">Control de accesos y roles</p>
            </div>
          </div>
          <button
            onClick={async () => { setRefreshing(true); await cargar(); setRefreshing(false) }}
            disabled={refreshing}
            className="w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-150 hover:bg-white/5 text-text-muted"
            style={{ border: '1px solid var(--overlay-08)' }}
            aria-label="Actualizar"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="max-w-[1100px] mx-auto p-4 md:p-6 flex flex-col gap-5">

        {/* ── KPI cards ── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Admins',   value: admins.length,  Icon: Shield,    color: '#75b9aa', border: 'rgba(61,159,137,0.18)',  bg: 'rgba(61,159,137,0.12)'  },
            { label: 'Alumnos',  value: alumnos.length, Icon: Users,     color: '#2f8f75', border: 'rgba(16,185,129,0.15)',  bg: 'rgba(16,185,129,0.1)'   },
            { label: 'Total',    value: users.length,   Icon: TrendingUp, color: '#2c8178', border: 'var(--overlay-07)', bg: 'rgba(44,129,120,0.12)'  },
          ].map(({ label, value, Icon, color, border, bg }) => (
            <div
              key={label}
              className="p-3 md:p-5 flex items-center gap-2 md:gap-3.5 rounded-2xl min-w-0"
              style={{
                background: 'var(--gradient-card)',
                border: `1px solid ${border}`,
                boxShadow: 'inset 0 1px 0 var(--overlay-04)',
              }}
            >
              <div
                className="w-8 h-8 md:w-11 md:h-11 flex items-center justify-center rounded-xl shrink-0"
                style={{ background: bg }}
              >
                <Icon size={15} style={{ color }} />
              </div>
              <div className="min-w-0">
                <p className="font-extrabold text-xl md:text-2xl tabular-nums leading-none" style={{ color }}>
                  {value}
                </p>
                <p className="text-[10px] md:text-xs font-medium uppercase tracking-wide mt-1 truncate text-text-muted">
                  {label}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* ── User table ── */}
        <div
          className="overflow-hidden rounded-2xl"
          style={{
            background: 'var(--gradient-card)',
            border: '1px solid var(--overlay-07)',
          }}
        >
          {/* Table head */}
          <div
            className="px-5 py-3.5 flex items-center justify-between gap-2 flex-wrap"
            style={{ borderBottom: '1px solid var(--overlay-06)' }}
          >
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-sm text-text-primary">Usuarios</h2>
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full text-primary-light"
                style={{
                  background: 'rgba(61,159,137,0.12)',
                  border: '1px solid rgba(61,159,137,0.2)',
                }}
              >
                {usersFiltrados.length}
              </span>
            </div>
          </div>

          {/* User rows */}
          {usersFiltrados.map((u, idx) => (
            <div
              key={u.id}
              className="flex items-center gap-3.5 px-5 py-3.5 transition-colors duration-100"
              style={{
                borderBottom: idx < usersFiltrados.length - 1 ? '1px solid var(--overlay-04)' : 'none',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--overlay-02)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              {/* Avatar */}
              <div
                className="w-9 h-9 shrink-0 overflow-hidden rounded-xl"
                style={{ border: '1px solid var(--overlay-08)' }}
              >
                {u.avatar_url ? (
                  <img src={u.avatar_url} alt={u.nombre} loading="lazy" decoding="async" className="w-9 h-9 object-cover" />
                ) : (
                  <div
                    className="w-9 h-9 flex items-center justify-center"
                    style={{ background: 'rgba(61,159,137,0.12)' }}
                  >
                    <span className="font-bold text-xs text-primary-light">
                      {u.nombre[0]?.toUpperCase() ?? '?'}
                    </span>
                  </div>
                )}
              </div>

              {/* Name + email */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-sm text-text-primary">{u.nombre}</p>
                  {u.id === usuario?.id && (
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full text-primary-light"
                      style={{
                        background: 'rgba(61,159,137,0.1)',
                        border: '1px solid rgba(61,159,137,0.2)',
                      }}
                    >
                      Tú
                    </span>
                  )}
                </div>
                <p className="text-xs truncate mt-0.5 text-text-muted">{u.email}</p>
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  {u.estado_acceso !== 'aprobado' && (
                    <Badge variant={u.estado_acceso === 'rechazado' ? 'danger' : 'warning'}>
                      {u.estado_acceso === 'rechazado' ? 'Rechazado' : 'Pendiente'}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Role toggle */}
              <div className="flex items-center shrink-0">
                {u.estado_acceso === 'pendiente' ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => cambiarAcceso(u, 'aprobado')}
                      disabled={updating === u.id || !puedeGestionarUsuario(u)}
                      title="Aceptar acceso"
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-emerald-300 bg-emerald-400/10 border border-emerald-400/20 disabled:opacity-40"
                    >
                      {updating === u.id ? <Spinner size="sm" /> : <Check size={14} />}
                    </button>
                    <button
                      onClick={() => cambiarAcceso(u, 'rechazado')}
                      disabled={updating === u.id || !puedeGestionarUsuario(u)}
                      title="Rechazar acceso"
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-rose-300 bg-rose-400/10 border border-rose-400/20 disabled:opacity-40"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : updating === u.id ? (
                  <div
                    className="w-6 h-6 rounded-full animate-spin"
                    style={{ border: '1.5px solid rgba(61,159,137,0.2)', borderTopColor: '#3d9f89' }}
                  />
                ) : (
                  <button
                    onClick={() => toggleRol(u)}
                    disabled={u.id === usuario?.id || !puedeGestionarUsuario(u)}
                    title={
                      u.id === usuario?.id ? 'No puedes cambiar tu propio rol' :
                      !puedeGestionarUsuario(u) ? 'Solo puedes gestionar usuarios de tu clase' :
                      u.rol === 'admin' ? 'Quitar administrador' : 'Dar permisos de administrador'
                    }
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all duration-150"
                    style={u.rol === 'admin' ? {
                      background: 'rgba(61,159,137,0.12)',
                      color: '#75b9aa',
                      border: '1px solid rgba(61,159,137,0.25)',
                      cursor: (u.id === usuario?.id || !puedeGestionarUsuario(u)) ? 'not-allowed' : 'pointer',
                      opacity: (u.id === usuario?.id || !puedeGestionarUsuario(u)) ? 0.5 : 1,
                    } : {
                      background: 'var(--overlay-05)',
                      color: '#64748b',
                      border: '1px solid var(--overlay-08)',
                      cursor: (u.id === usuario?.id || !puedeGestionarUsuario(u)) ? 'not-allowed' : 'pointer',
                      opacity: (u.id === usuario?.id || !puedeGestionarUsuario(u)) ? 0.4 : 1,
                    }}
                    onMouseEnter={e => {
                      if (u.id === usuario?.id || !puedeGestionarUsuario(u)) return
                      const el = e.currentTarget as HTMLElement
                      el.style.opacity = '0.8'
                      el.style.transform = 'scale(0.97)'
                    }}
                    onMouseLeave={e => {
                      if (u.id === usuario?.id || !puedeGestionarUsuario(u)) return
                      const el = e.currentTarget as HTMLElement
                      el.style.opacity = '1'
                      el.style.transform = 'scale(1)'
                    }}
                  >
                    {u.rol === 'admin' ? (
                      <>
                        <Shield size={10} />
                        Admin
                      </>
                    ) : (
                      <>
                        <GraduationCap size={10} />
                        Alumno
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* ── Anuncios: solo el master ── */}
        {isSuperAdmin && <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 flex items-center justify-center rounded-xl"
              style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)' }}
            >
              <Megaphone size={14} className="text-amber" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-text-primary">Anuncios</h2>
              <p className="text-xs text-text-muted">
                El último anuncio activo aparece como modal a todos los usuarios hasta que lo lean
              </p>
            </div>
          </div>

          {/* Formulario nuevo anuncio */}
          <form
            onSubmit={handlePublicar}
            className="rounded-2xl p-5 flex flex-col gap-3"
            style={{
              background: 'var(--gradient-card)',
              border: '1px solid rgba(245,158,11,0.15)',
            }}
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Nuevo anuncio
            </p>
            <input
              type="text"
              value={nuevoTitulo}
              onChange={e => setNuevoTitulo(e.target.value)}
              placeholder="Título del anuncio..."
              className="bg-input border border-white/[0.08] rounded-xl px-4 py-3 text-slate-100 text-sm placeholder:text-text-muted transition-all duration-200 w-full outline-none focus:border-primary/50 focus:shadow-[0_0_0_3px_rgba(61,159,137,0.12)]"
              maxLength={100}
            />
            <textarea
              value={nuevoContenido}
              onChange={e => setNuevoContenido(e.target.value)}
              placeholder="Escribe aquí el mensaje completo para los alumnos..."
              rows={4}
              className="bg-input border border-white/[0.08] rounded-xl px-4 py-3 text-slate-100 text-sm placeholder:text-text-muted transition-all duration-200 w-full outline-none resize-none focus:border-primary/50 focus:shadow-[0_0_0_3px_rgba(61,159,137,0.12)]"
              maxLength={1000}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted">
                {nuevoContenido.length}/1000
              </span>
              <button
                type="submit"
                disabled={guardando || !nuevoTitulo.trim() || !nuevoContenido.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-150 active:scale-[0.97] disabled:opacity-40 bg-gradient-warning text-white"
                style={{ boxShadow: '0 2px 8px rgba(245,158,11,0.3)' }}
              >
                {guardando ? <Spinner size="sm" className="text-white" /> : <Plus size={14} />}
                Publicar anuncio
              </button>
            </div>
          </form>

          {/* Lista de anuncios existentes */}
          {anuncios.length > 0 && (
            <div
              className="overflow-hidden rounded-2xl"
              style={{
                background: 'var(--gradient-card)',
                border: '1px solid var(--overlay-07)',
              }}
            >
              <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--overlay-06)' }}>
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Historial
                </p>
              </div>
              {anuncios.map((a, idx) => (
                <div
                  key={a.id}
                  className="flex items-start gap-3 px-5 py-4"
                  style={{ borderBottom: idx < anuncios.length - 1 ? '1px solid var(--overlay-04)' : 'none' }}
                >
                  {/* Indicador activo */}
                  <div className="mt-1 shrink-0">
                    {a.activo ? (
                      <div className="w-2 h-2 rounded-full animate-pulse bg-success" />
                    ) : (
                      <div className="w-2 h-2 rounded-full" style={{ background: '#374151' }} />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-sm truncate ${a.activo ? 'text-text-primary' : 'text-text-muted'}`}>
                      {a.titulo}
                    </p>
                    <p className="text-xs mt-0.5 line-clamp-2 text-text-muted">
                      {a.contenido}
                    </p>
                    <p className="text-xs mt-1 text-text-muted">
                      {new Date(a.created_at).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Toggle activo */}
                    <button
                      onClick={() => handleToggleActivo(a)}
                      disabled={toggling === a.id}
                      title={a.activo ? 'Desactivar' : 'Activar'}
                      className="w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-150"
                      style={{
                        background: a.activo ? 'rgba(16,185,129,0.1)' : 'var(--overlay-04)',
                        border: a.activo ? '1px solid rgba(16,185,129,0.25)' : '1px solid var(--overlay-08)',
                        color: a.activo ? '#2f8f75' : '#4b5563',
                      }}
                    >
                      {toggling === a.id ? (
                        <Spinner size="sm" />
                      ) : a.activo ? (
                        <Eye size={13} />
                      ) : (
                        <EyeOff size={13} />
                      )}
                    </button>
                    {/* Eliminar */}
                    <button
                      onClick={() => handleEliminarAnuncio(a)}
                      title="Eliminar"
                      className="w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-150"
                      style={{ color: '#4b5563', border: '1px solid transparent' }}
                      onMouseEnter={e => {
                        const el = e.currentTarget as HTMLElement
                        el.style.color = '#f43f5e'
                        el.style.background = 'rgba(244,63,94,0.1)'
                        el.style.borderColor = 'rgba(244,63,94,0.2)'
                      }}
                      onMouseLeave={e => {
                        const el = e.currentTarget as HTMLElement
                        el.style.color = '#4b5563'
                        el.style.background = 'transparent'
                        el.style.borderColor = 'transparent'
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>}

        {/* ── Horario ── */}
        <AdminHorario />

      </div>

      <AlertModal
        visible={alert !== null}
        type={alert?.type}
        title={alert?.title ?? ''}
        message={alert?.message ?? ''}
        onClose={() => setAlert(null)}
        onConfirm={alert?.onConfirm}
        confirmLabel={alert?.confirmLabel}
        confirmDestructive={alert?.confirmDestructive}
      />
    </div>
  )
}
