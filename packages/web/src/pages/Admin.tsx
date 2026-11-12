import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Usuario, Anuncio } from '@topcode/shared'
import AlertModal from '../components/AlertModal'
import AdminHorario from '../components/AdminHorario'
import AdminView from '../components/admin/AdminView'
import DialogoTemporal from '../components/admin/DialogoTemporal'
import Esqueleto from '../components/admin/Esqueleto'

type AlertState = {
  type?: 'error' | 'success' | 'info' | 'warning'
  title: string
  message: string
  onConfirm?: () => void
  confirmLabel?: string
  confirmDestructive?: boolean
} | null

export default function Admin() {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const [users, setUsers] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [updating, setUpdating] = useState<string | null>(null)
  const [alert, setAlert] = useState<AlertState>(null)
  // Contraseña temporal recién generada: se enseña una sola vez para pasársela a quien la pidió.
  const [temporal, setTemporal] = useState<{ nombre: string; email: string; password: string } | null>(null)
  const [copiada, setCopiada] = useState(false)

  // ── Anuncios ──
  const [anuncios, setAnuncios] = useState<Anuncio[]>([])
  const [nuevoTitulo, setNuevoTitulo] = useState('')
  const [nuevoContenido, setNuevoContenido] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [nuevoEnlace, setNuevoEnlace] = useState('')
  const [toggling, setToggling] = useState<number | null>(null)

  const cargarAnuncios = useCallback(async () => {
    const { data } = await supabase
      .from('anuncios')
      .select('id, titulo, contenido, enlace, activo, created_at, created_by')
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
        enlace: nuevoEnlace.trim() || null,
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
    setNuevoEnlace('')
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

  function pedirPasswordTemporal(u: Usuario) {
    if (!puedeDarTemporal(u)) return
    setAlert({
      title: 'Contraseña temporal',
      message: `¿Generar una contraseña temporal para ${u.nombre}? Se le cerrará la sesión si la tiene abierta y, al entrar con ella, tendrá que elegir una nueva.`,
      confirmLabel: 'Generar',
      onConfirm: async () => {
        setUpdating(u.id)
        const { data, error } = await supabase.rpc('tc_password_temporal', { p_usuario: u.id })
        setUpdating(null)
        if (error || typeof data !== 'string') {
          setAlert({ type: 'error', title: 'Error', message: 'No se pudo generar la contraseña: ' + (error?.message ?? 'respuesta vacía') })
          return
        }
        setCopiada(false)
        setTemporal({ nombre: u.nombre, email: u.email, password: data })
      },
    })
  }

  function pedirEliminar(u: Usuario) {
    if (!puedeEliminar(u)) return
    setAlert({
      title: 'Eliminar usuario',
      message: `¿Eliminar a ${u.nombre} (${u.email}) de TopCode? Se borrarán su cuenta y todo lo suyo: mensajes, apuntes, publicaciones del foro, partidas… No se puede deshacer.`,
      confirmLabel: 'Eliminar',
      confirmDestructive: true,
      onConfirm: async () => {
        setUpdating(u.id)
        const { error } = await supabase.rpc('tc_eliminar_usuario', { p_usuario: u.id })
        setUpdating(null)
        if (error) {
          setAlert({ type: 'error', title: 'Error', message: 'No se pudo eliminar el usuario: ' + error.message })
          return
        }
        setUsers(prev => prev.filter(x => x.id !== u.id))
      },
    })
  }

  async function copiarTemporal() {
    if (!temporal) return
    try {
      await navigator.clipboard.writeText(temporal.password)
      setCopiada(true)
    } catch {
      setCopiada(false)
    }
  }

  const isSuperAdmin = usuario?.es_superadmin === true
  const puedeGestionarUsuario = (u: Usuario) => isSuperAdmin || (
    usuario?.rol === 'admin' && usuario.clase !== null && u.clase === usuario.clase
  )
  // Igual que en el servidor (tc_password_temporal): el superadmin a cualquiera; un admin de clase, solo a alumnos.
  const puedeDarTemporal = (u: Usuario) =>
    u.id !== usuario?.id && (isSuperAdmin || (puedeGestionarUsuario(u) && u.rol === 'alumno' && !u.es_superadmin))
  // Igual que en el servidor (tc_eliminar_usuario).
  const puedeEliminar = (u: Usuario) =>
    u.id !== usuario?.id && !u.es_superadmin && (isSuperAdmin || (puedeGestionarUsuario(u) && u.rol === 'alumno'))
  const usuariosVisibles = isSuperAdmin
    ? users
    : users.filter(u => u.clase === usuario?.clase)

  if (loading) return <Esqueleto />

  return (
    <>
      <AdminView
        usuarios={usuariosVisibles}
        claseAdmin={usuario?.clase}
        yoId={usuario?.id}
        esSuperadmin={isSuperAdmin}
        updating={updating}
        puedeGestionar={puedeGestionarUsuario}
        puedeTemporal={puedeDarTemporal}
        puedeEliminar={puedeEliminar}
        onToggleRol={toggleRol}
        onAcceso={cambiarAcceso}
        onTemporal={pedirPasswordTemporal}
        onEliminar={pedirEliminar}
        refreshing={refreshing}
        onRefresh={async () => { setRefreshing(true); await cargar(); setRefreshing(false) }}
        anuncios={{
          anuncios,
          titulo: nuevoTitulo,
          contenido: nuevoContenido,
          onTitulo: setNuevoTitulo,
          onContenido: setNuevoContenido,
          enlace: nuevoEnlace,
          onEnlace: setNuevoEnlace,
          guardando,
          toggling,
          onPublicar: handlePublicar,
          onToggle: handleToggleActivo,
          onEliminar: handleEliminarAnuncio,
        }}
        horario={<AdminHorario />}
      />

      {temporal && (
        <DialogoTemporal
          nombre={temporal.nombre}
          email={temporal.email}
          password={temporal.password}
          copiada={copiada}
          onCopiar={copiarTemporal}
          onClose={() => setTemporal(null)}
        />
      )}

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
    </>
  )
}
