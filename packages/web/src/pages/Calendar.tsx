import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  useEventos, useEventosEstado, type EventoCalendario, type TipoEvento,
  esTipoActividad,
} from '@topcode/shared'
import { useAuth } from '../hooks/useAuth'
import { markCalendarioActividadesVisited } from '../hooks/useUnreadCounts'
import AlertModal from '../components/AlertModal'
import CalendarioEsqueleto from '../components/calendario/Esqueleto'
import CalendarioView from '../components/calendario/CalendarioView'
import Formulario from '../components/calendario/Formulario'
import type { EstadoActividad, FiltroEstado, FormState, Vista } from '../components/calendario/tipos'

// ─── Vista (Exámenes / Actividades) ───────────────────────────────────────────

const VISTA_KEY = 'calendarVista'

function esVista(v: string | null): v is Vista {
  return v === 'examenes' || v === 'actividades'
}

function leerVistaGuardada(): Vista {
  try {
    const v = localStorage.getItem(VISTA_KEY)
    if (esVista(v)) return v
  } catch { /* ignore */ }
  return 'examenes'
}

function eventoEnVista(ev: EventoCalendario, vista: Vista): boolean {
  return esTipoActividad(ev.tipo) === (vista === 'actividades')
}

function isUpcoming(fecha: string) {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  return new Date(fecha + 'T00:00:00') >= hoy
}

// ─── Alert state type ─────────────────────────────────────────────────────────

type AlertState = {
  type?: 'error' | 'success' | 'info' | 'warning'
  title: string
  message?: string
  onConfirm?: () => void
  confirmLabel?: string
  confirmDestructive?: boolean
} | null

// ─── Form state ───────────────────────────────────────────────────────────────

const EMPTY_FORM: FormState = {
  titulo: '',
  descripcion: '',
  materia: '',
  fecha: new Date().toISOString().split('T')[0],
  hora: '',
  tipo: 'actividad',
}

// ─── Página: datos y acciones (la presentación vive en components/calendario) ─

export default function CalendarPage() {
  const { usuario } = useAuth()
  const isAdmin = usuario?.rol === 'admin'
  const canManage = isAdmin && usuario?.clase != null

  const { eventos: todosEventos, loading, init, refresh, createEvento, updateEvento, deleteEvento } = useEventos()

  const [searchParams, setSearchParams] = useSearchParams()
  const vistaParam = searchParams.get('vista')
  const [vistaGuardada] = useState<Vista>(leerVistaGuardada)
  const vista: Vista = esVista(vistaParam) ? vistaParam : vistaGuardada
  const esActividades = vista === 'actividades'

  const eventos = useMemo(() => todosEventos.filter(ev => eventoEnVista(ev, vista)), [todosEventos, vista])
  const idsActividad = useMemo(
    () => todosEventos.filter(ev => esTipoActividad(ev.tipo)).map(ev => ev.id),
    [todosEventos],
  )
  const { estados, statsAdmin, totalAlumnos, toggling, toggle } = useEventosEstado({
    usuarioId: usuario?.id, clase: usuario?.clase, isAdmin: canManage, eventoIds: idsActividad,
  })
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todas')

  const [refreshing, setRefreshing] = useState(false)
  const [alert, setAlert] = useState<AlertState>(null)
  const [pastExpanded, setPastExpanded] = useState(false)
  const [diaHighlight, setDiaHighlight] = useState<string | null>(null)
  const [viewDate, setViewDate] = useState(() => new Date())

  const [searchQuery, setSearchQuery] = useState('')
  const [categoriaFilter, setCategoriaFilter] = useState<'todas' | TipoEvento>('todas')

  // Modal de crear/editar
  const [modalVisible, setModalVisible] = useState(false)
  const [editandoEvento, setEditandoEvento] = useState<EventoCalendario | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const viewYear = viewDate.getFullYear()
  const viewMonth = viewDate.getMonth()

  const cambiarVista = useCallback((v: Vista) => {
    try { localStorage.setItem(VISTA_KEY, v) } catch { /* ignore */ }
    setSearchParams({ vista: v }, { replace: true })
    setCategoriaFilter('todas')
    setFiltroEstado('todas')
  }, [setSearchParams])

  useEffect(() => {
    if (esActividades && usuario) markCalendarioActividadesVisited(usuario.id)
  }, [esActividades, usuario])

  const handlePrevMonth = useCallback(() => setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1)), [])
  const handleNextMonth = useCallback(() => setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1)), [])

  const eventRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => { init() }, [init])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await refresh()
    setRefreshing(false)
  }, [refresh])

  function abrirNuevo() {
    setEditandoEvento(null)
    setForm({ ...EMPTY_FORM, tipo: esActividades ? 'actividad' : 'examen_teorico' })
    setModalVisible(true)
  }

  function abrirEditar(ev: EventoCalendario) {
    setEditandoEvento(ev)
    setForm({
      titulo: ev.titulo,
      descripcion: ev.descripcion ?? '',
      materia: ev.materia ?? '',
      fecha: ev.fecha,
      hora: ev.hora ?? '',
      tipo: ev.tipo ?? 'actividad',
    })
    setModalVisible(true)
  }

  function cerrarModal() {
    setModalVisible(false)
    setEditandoEvento(null)
  }

  async function handleGuardar(e: React.FormEvent) {
    e.preventDefault()
    if (!form.titulo.trim() || !form.fecha) {
      setAlert({ type: 'error', title: 'Error', message: 'El título y la fecha son obligatorios.' })
      return
    }
    setSaving(true)

    const payload = {
      titulo: form.titulo.trim(),
      descripcion: form.descripcion.trim() || null,
      materia: form.materia.trim() || null,
      tipo: form.tipo,
      fecha: form.fecha,
      hora: form.hora.trim() || null,
    }

    let error: string | null
    try {
      ({ error } = editandoEvento
        ? await updateEvento(editandoEvento.id, payload)
        : await createEvento({ ...payload, created_by: usuario!.id, clase: usuario!.clase }))
    } catch {
      error = 'Error de conexión. Inténtalo de nuevo.'
    } finally {
      setSaving(false)
    }
    if (error) {
      const accion = editandoEvento ? 'actualizar' : 'crear'
      setAlert({ type: 'error', title: 'Error', message: `No se pudo ${accion} el evento: ${error}` })
      return
    }

    cerrarModal()
  }

  function handleEliminar(ev: EventoCalendario) {
    setAlert({
      title: 'Eliminar evento',
      message: `¿Eliminar "${ev.titulo}"?`,
      confirmLabel: 'Eliminar',
      confirmDestructive: true,
      onConfirm: async () => {
        const { error } = await deleteEvento(ev.id)
        if (error) setAlert({ type: 'error', title: 'Error', message: 'No se pudo eliminar el evento.' })
      },
    })
  }

  function handleDiaClick(fechaStr: string) {
    setDiaHighlight(fechaStr)
    const firstEvento = eventos.find(ev => ev.fecha === fechaStr)
    if (firstEvento) {
      const el = eventRefs.current[firstEvento.id]
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
    }
    setTimeout(() => setDiaHighlight(null), 2000)
  }

  // ── Filtering ───────────────────────────────────────────────────────────────

  const eventosFiltrados = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return eventos.filter(ev => {
      const matchesSearch = q === '' ||
        ev.titulo.toLowerCase().includes(q) ||
        (ev.materia?.toLowerCase() ?? '').includes(q) ||
        (ev.descripcion?.toLowerCase() ?? '').includes(q)
      const matchesCategoria = categoriaFilter === 'todas' || (ev.tipo ?? 'actividad') === categoriaFilter
      const hecha = estados[ev.id] ?? false
      const matchesEstado = !esActividades || filtroEstado === 'todas'
        || (filtroEstado === 'hechas' ? hecha : !hecha)
      return matchesSearch && matchesCategoria && matchesEstado
    })
  }, [eventos, searchQuery, categoriaFilter, filtroEstado, estados, esActividades])

  const totalHechas = esActividades ? eventos.filter(e => estados[e.id]).length : 0
  const totalPendientes = eventos.length - totalHechas
  const pct = eventos.length ? Math.round((totalHechas / eventos.length) * 100) : 0

  async function handleToggle(ev: EventoCalendario) {
    const { error } = await toggle(ev.id)
    if (error) setAlert({ type: 'error', title: 'Error', message: 'No se pudo actualizar el estado de la actividad.' })
  }

  const upcoming = eventosFiltrados.filter(e => isUpcoming(e.fecha))
  const past = eventosFiltrados.filter(e => !isUpcoming(e.fecha)).reverse()

  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const todayStr = hoy.toISOString().split('T')[0]
  const weekEnd = new Date(hoy); weekEnd.setDate(hoy.getDate() + 7)

  const todayCount = upcoming.filter(e => e.fecha === todayStr).length
  const weekCount = upcoming.filter(e => {
    const d = new Date(e.fecha + 'T00:00:00')
    return d >= hoy && d < weekEnd
  }).length


  if (loading) return <CalendarioEsqueleto />

  const estadoDe = (ev: EventoCalendario): EstadoActividad | undefined => esActividades ? {
    completada: estados[ev.id] ?? false,
    toggling: toggling === ev.id,
    onToggle: () => handleToggle(ev),
    adminCount: canManage ? (statsAdmin[ev.id] ?? 0) : null,
    totalAlumnos,
  } : undefined

  return (
    <>
      <CalendarioView
        vista={vista}
        onCambiarVista={cambiarVista}
        eventos={eventos}
        upcoming={upcoming}
        past={past}
        todayCount={todayCount}
        weekCount={weekCount}
        canManage={canManage}
        claseUsuario={usuario?.clase}
        onNuevo={abrirNuevo}
        onEditar={abrirEditar}
        onEliminar={handleEliminar}
        estadoDe={estadoDe}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        searchQuery={searchQuery}
        onSearch={setSearchQuery}
        categoriaFilter={categoriaFilter}
        onCategoria={setCategoriaFilter}
        filtroEstado={filtroEstado}
        onFiltroEstado={setFiltroEstado}
        totalHechas={totalHechas}
        totalPendientes={totalPendientes}
        pct={pct}
        pastExpanded={pastExpanded}
        onTogglePast={() => setPastExpanded(p => !p)}
        diaHighlight={diaHighlight}
        onDiaClick={handleDiaClick}
        viewYear={viewYear}
        viewMonth={viewMonth}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
        onHoy={() => setViewDate(new Date())}
        eventRefs={eventRefs}
      />

      {modalVisible && (
        <Formulario
          editando={editandoEvento !== null}
          form={form}
          setForm={setForm}
          saving={saving}
          onSubmit={handleGuardar}
          onClose={cerrarModal}
        />
      )}

      <AlertModal
        visible={alert !== null}
        type={alert?.type}
        title={alert?.title ?? ''}
        message={alert?.message}
        onClose={() => setAlert(null)}
        onConfirm={alert?.onConfirm}
        confirmLabel={alert?.confirmLabel}
        confirmDestructive={alert?.confirmDestructive}
      />
    </>
  )
}
