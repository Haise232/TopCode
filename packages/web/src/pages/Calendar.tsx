import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { createPortal } from 'react-dom'
import {
  Plus, Trash2, RefreshCw, CalendarDays, Clock, Search,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Zap, Pencil, X, Check, BookOpen, ClipboardCheck, AlertTriangle,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import {
  useEventos, useEventosEstado, type EventoCalendario, type TipoEvento, MATERIAS, TIPOS_EVENTO,
  TIPOS_ACTIVIDAD, esTipoActividad, fechaLimiteEvento,
} from '@topcode/shared'
import { markCalendarioActividadesVisited } from '../hooks/useUnreadCounts'
import { TIPO_EVENTO_CONFIG, TipoEventoBadge, tipoEventoConfig } from '../lib/tiposEvento'
import AlertModal from '../components/AlertModal'
import { SkeletonBox, SkeletonCard } from '../components/Skeleton'
import { Button, Spinner } from '../components/ui'

// ─── Constants ───────────────────────────────────────────────────────────────

const MESES = [
  'enero','febrero','marzo','abril','mayo','junio',
  'julio','agosto','septiembre','octubre','noviembre','diciembre',
]
const MESES_CORTO = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
const DIAS_SEMANA = ['Lu','Ma','Mi','Ju','Vi','Sa','Do']

function materiaHue(nombre: string): number {
  return nombre.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360
}

// ─── Vista (Exámenes / Actividades) ───────────────────────────────────────────

type Vista = 'examenes' | 'actividades'
type FiltroEstado = 'todas' | 'pendientes' | 'hechas'
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

const VISTAS: { id: Vista; label: string; Icon: typeof BookOpen }[] = [
  { id: 'examenes',    label: 'Exámenes',    Icon: BookOpen },
  { id: 'actividades', label: 'Actividades', Icon: ClipboardCheck },
]

function VistaSwitch({ value, onChange }: { value: Vista; onChange: (v: Vista) => void }) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})
  function onKeyDown(e: React.KeyboardEvent, idx: number) {
    let next = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % VISTAS.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (idx - 1 + VISTAS.length) % VISTAS.length
    if (next < 0) return
    e.preventDefault()
    onChange(VISTAS[next].id)
    refs.current[VISTAS[next].id]?.focus()
  }
  return (
    <div role="tablist" aria-label="Tipo de calendario"
      className="grid grid-cols-2 gap-1 p-1 rounded-2xl w-full sm:w-fit"
      style={{ background: 'var(--overlay-04)', border: '1px solid var(--overlay-08)' }}>
      {VISTAS.map(({ id, label, Icon }, idx) => {
        const active = value === id
        return (
          <button key={id} type="button" role="tab" aria-selected={active} tabIndex={active ? 0 : -1}
            ref={el => { refs.current[id] = el }}
            onClick={() => onChange(id)} onKeyDown={e => onKeyDown(e, idx)}
            className="flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            style={active ? {
              background: 'linear-gradient(135deg, var(--color-primary), var(--color-teal))',
              color: 'white', boxShadow: '0 2px 10px rgba(61,159,137,0.3)',
            } : { color: 'var(--color-text-secondary)', border: '1px solid transparent' }}>
            <Icon size={14} aria-hidden="true" />
            {label}
          </button>
        )
      })}
    </div>
  )
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function formatFecha(fecha: string) {
  const [y, m, d] = fecha.split('-')
  return `${parseInt(d)} de ${MESES[parseInt(m) - 1]} de ${y}`
}

function formatFechaPreview(fecha: string) {
  if (!fecha) return ''
  const [y, m, d] = fecha.split('-')
  const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
  const diasSemana = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado']
  return `${diasSemana[date.getDay()]}, ${parseInt(d)} de ${MESES[parseInt(m) - 1]} de ${y}`
}

function formatFechaDia(fecha: string) {
  if (!fecha) return ''
  const [y, m, d] = fecha.split('-')
  const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
  const diasSemana = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado']
  const hoy = new Date(); hoy.setHours(0,0,0,0)
  const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1)
  const manana = new Date(hoy); manana.setDate(hoy.getDate() + 1)
  if (date.getTime() === hoy.getTime()) return 'Hoy'
  if (date.getTime() === manana.getTime()) return 'Mañana'
  if (date.getTime() === ayer.getTime()) return 'Ayer'
  return `${diasSemana[date.getDay()].charAt(0).toUpperCase() + diasSemana[date.getDay()].slice(1)}, ${parseInt(d)} de ${MESES[parseInt(m) - 1]}`
}

function fechaRelativa(fecha: string) {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const ev = new Date(fecha + 'T00:00:00')
  const diff = Math.round((ev.getTime() - hoy.getTime()) / 86400000)
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Mañana'
  if (diff === -1) return 'Ayer'
  if (diff > 1 && diff <= 7) return `En ${diff} días`
  if (diff > 7) return `En ${diff} días`
  return `Hace ${Math.abs(diff)} días`
}

function isUpcoming(fecha: string) {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  return new Date(fecha + 'T00:00:00') >= hoy
}

function primerDiaMes(year: number, month: number): number {
  const d = new Date(year, month, 1).getDay()
  return d === 0 ? 6 : d - 1
}

function diasEnMes(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CalendarSkeleton() {
  return (
    <div className="animate-fade-in">
      <div className="px-4 md:px-6 py-5 flex justify-between items-center" style={{ borderBottom: '1px solid var(--overlay-06)' }}>
        <div className="flex items-center gap-3">
          <SkeletonBox className="h-9 w-9 shimmer rounded-xl" />
          <SkeletonBox className="h-7 w-28 shimmer" />
        </div>
        <SkeletonBox className="h-10 w-32 shimmer rounded-xl" />
      </div>
      <div className="max-w-[1100px] mx-auto p-4 md:p-6 flex flex-col gap-4">
        <SkeletonCard className="h-64 shimmer rounded-2xl" />
        <div className="flex gap-2">
          <SkeletonBox className="h-8 w-16 shimmer rounded-full" />
          <SkeletonBox className="h-8 w-20 shimmer rounded-full" />
          <SkeletonBox className="h-8 w-24 shimmer rounded-full" />
          <SkeletonBox className="h-8 w-16 shimmer rounded-full" />
        </div>
        {[1, 2, 3].map(i => (
          <SkeletonCard key={i} className="flex gap-4 items-center py-5">
            <SkeletonBox className="h-14 w-14 shrink-0 shimmer rounded-xl" />
            <div className="flex-1 flex flex-col gap-2.5">
              <SkeletonBox className="h-4 w-2/5 shimmer" />
              <SkeletonBox className="h-3 w-3/5 shimmer" />
              <SkeletonBox className="h-3 w-1/4 shimmer" />
            </div>
            <SkeletonBox className="h-6 w-20 shimmer rounded-lg" />
          </SkeletonCard>
        ))}
      </div>
    </div>
  )
}

// ─── Mini Calendar ────────────────────────────────────────────────────────────

function MiniCalendario({
  eventos, onDiaClick, diaHighlight, viewYear, viewMonth, onPrevMonth, onNextMonth,
}: {
  eventos: EventoCalendario[]
  onDiaClick: (fecha: string) => void
  diaHighlight: string | null
  viewYear: number
  viewMonth: number
  onPrevMonth: () => void
  onNextMonth: () => void
}) {
  const hoy = new Date()
  const todayDay = hoy.getDate()
  const isCurrentMonth = hoy.getFullYear() === viewYear && hoy.getMonth() === viewMonth

  const offset = primerDiaMes(viewYear, viewMonth)
  const totalDias = diasEnMes(viewYear, viewMonth)

  const diasConEvento = new Map<number, string[]>()
  eventos.forEach(ev => {
    const [y, m, d] = ev.fecha.split('-').map(Number)
    if (y === viewYear && m - 1 === viewMonth) {
      const colores = diasConEvento.get(d) ?? []
      const color = tipoEventoConfig(ev.tipo).color
      if (!colores.includes(color) && colores.length < 3) colores.push(color)
      diasConEvento.set(d, colores)
    }
  })

  const cells: (number | null)[] = []
  for (let i = 0; i < offset; i++) cells.push(null)
  for (let d = 1; d <= totalDias; d++) cells.push(d)

  function fechaStr(d: number) {
    return `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }

  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--gradient-card)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button onClick={onPrevMonth}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-150 text-text-muted"
            style={{ background: 'var(--color-surface-alpha)', border: '1px solid var(--border)' }}
            aria-label="Mes anterior">
            <ChevronLeft size={13} />
          </button>
          <span className="font-bold text-sm capitalize text-text-primary" style={{ minWidth: '120px', textAlign: 'center' }}>
            {MESES[viewMonth]} {viewYear}
          </span>
          <button onClick={onNextMonth}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-150 text-text-muted"
            style={{ background: 'var(--color-surface-alpha)', border: '1px solid var(--border)' }}
            aria-label="Mes siguiente">
            <ChevronRight size={13} />
          </button>
        </div>
        <div className="flex items-center gap-3 text-xs text-text-muted">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full inline-block bg-primary" /> Hoy
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full inline-block bg-amber" /> Evento
          </span>
        </div>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {DIAS_SEMANA.map(d => (
          <div key={d} className="text-center text-xs font-semibold py-1 text-text-muted">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((dia, idx) => {
          if (dia === null) return <div key={`empty-${idx}`} />
          const isToday = isCurrentMonth && dia === todayDay
          const coloresDia = diasConEvento.get(dia)
          const hasEvento = coloresDia !== undefined
          const fs = fechaStr(dia)
          const isHighlighted = diaHighlight === fs

          return (
            <button key={dia} onClick={() => hasEvento && onDiaClick(fs)}
              className="relative flex flex-col items-center justify-center h-9 w-full rounded-lg transition-all duration-150"
              style={{
                background: isToday
                  ? 'linear-gradient(135deg, var(--color-primary), var(--color-primary-light))'
                  : isHighlighted ? 'rgba(61,159,137,0.15)'
                  : hasEvento ? 'var(--overlay-04)' : 'transparent',
                border: isHighlighted && !isToday ? '1px solid rgba(61,159,137,0.3)' : '1px solid transparent',
                cursor: hasEvento ? 'pointer' : 'default',
                boxShadow: isToday ? '0 2px 8px rgba(61,159,137,0.35)' : 'none',
              }}
            >
              <span className="text-xs font-semibold tabular-nums"
                style={{
                  color: isToday ? 'white' : hasEvento ? 'var(--color-text)' : 'var(--color-text-muted)',
                  fontWeight: isToday || hasEvento ? 700 : 400,
                }}>
                {dia}
              </span>
              {hasEvento && !isToday && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                  {coloresDia!.map(c => (
                    <span key={c} className="w-1 h-1 rounded-full" style={{ background: c }} />
                  ))}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ isAdmin, onNew, actividades }: { isAdmin: boolean; onNew: () => void; actividades: boolean }) {
  return (
    <div className="py-16 flex flex-col items-center gap-5 text-center rounded-2xl"
      style={{ background: 'var(--gradient-card)', border: '1px solid var(--overlay-06)' }}>
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="8" y="16" width="64" height="56" rx="8" fill="rgba(245,158,11,0.08)" stroke="rgba(245,158,11,0.2)" strokeWidth="1.5" />
        <rect x="8" y="16" width="64" height="16" rx="8" fill="rgba(245,158,11,0.12)" />
        <rect x="22" y="8" width="4" height="16" rx="2" fill="#f59e0b" opacity="0.6" />
        <rect x="54" y="8" width="4" height="16" rx="2" fill="#f59e0b" opacity="0.6" />
        <rect x="20" y="44" width="12" height="12" rx="3" fill="rgba(61,159,137,0.25)" stroke="rgba(61,159,137,0.3)" strokeWidth="1" />
        <rect x="36" y="44" width="12" height="12" rx="3" fill="rgba(245,158,11,0.15)" stroke="rgba(245,158,11,0.2)" strokeWidth="1" />
        <rect x="52" y="44" width="12" height="12" rx="3" fill="rgba(20,184,166,0.12)" stroke="rgba(20,184,166,0.2)" strokeWidth="1" />
        <circle cx="60" cy="60" r="12" fill="rgba(61,159,137,0.15)" stroke="rgba(61,159,137,0.3)" strokeWidth="1.5" />
        <line x1="60" y1="55" x2="60" y2="60" stroke="#75b9aa" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="60" y1="60" x2="63" y2="63" stroke="#75b9aa" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <div className="flex flex-col gap-2">
        <p className="font-bold text-lg text-text-primary">{actividades ? 'Sin actividades todavía' : 'Sin exámenes programados'}</p>
        <p className="text-sm leading-relaxed max-w-xs text-text-muted">
          {isAdmin
            ? 'Añade el primer evento para que tu clase esté al tanto de lo que se viene.'
            : 'Todavía no hay eventos en el calendario. Vuelve pronto para estar al día.'}
        </p>
      </div>
      {isAdmin && (
        <button onClick={onNew}
          className="bg-gradient-to-br from-primary to-primary-dark text-white font-semibold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all duration-200 shadow-primary px-5 py-2.5 text-sm mt-1">
          <Plus size={15} /> {actividades ? 'Crear primera actividad' : 'Crear primer evento'}
        </button>
      )}
    </div>
  )
}

// ─── Section components ───────────────────────────────────────────────────────

function SectionHeader({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex items-center gap-3 mb-1">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color }}>{label}</h2>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full"
          style={{ background: 'var(--color-surface-alpha)', color, border: 'var(--border) 1px solid' }}>
          {count}
        </span>
      </div>
      <div className="flex-1 h-px" style={{ background: 'var(--overlay-06)' }} />
    </div>
  )
}

function SectionEmpty({ message }: { message: string }) {
  return (
    <div className="py-10 flex flex-col items-center gap-3 text-center rounded-2xl"
      style={{ background: 'var(--gradient-card)', border: '1px solid var(--overlay-06)' }}>
      <CalendarDays size={28} className="text-text-muted opacity-40" />
      <p className="text-sm text-text-muted">{message}</p>
    </div>
  )
}

// ─── Day group header ─────────────────────────────────────────────────────────

function DayHeader({ fecha }: { fecha: string }) {
  const label = formatFechaDia(fecha)
  const isHoy = label === 'Hoy'
  const isManana = label === 'Mañana'
  return (
    <div className="flex items-center gap-3 py-1">
      <span
        className="text-xs font-bold px-3 py-1 rounded-full shrink-0"
        style={{
          background: isHoy
            ? 'rgba(244,63,94,0.12)'
            : isManana
            ? 'rgba(245,158,11,0.10)'
            : 'var(--color-surface-alpha)',
          color: isHoy
            ? 'var(--color-rose)'
            : isManana
            ? 'var(--color-warning)'
            : 'var(--color-text-secondary)',
          border: `1px solid ${isHoy ? 'rgba(244,63,94,0.22)' : isManana ? 'rgba(245,158,11,0.22)' : 'var(--border)'}`,
        }}
      >
        {label}
      </span>
      <div className="flex-1 h-px" style={{ background: 'var(--overlay-05)' }} />
    </div>
  )
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

type FormState = {
  titulo: string
  descripcion: string
  materia: string
  fecha: string
  hora: string
  tipo: TipoEvento
}

const EMPTY_FORM: FormState = {
  titulo: '',
  descripcion: '',
  materia: '',
  fecha: new Date().toISOString().split('T')[0],
  hora: '',
  tipo: 'actividad',
}

// ─── Main component ───────────────────────────────────────────────────────────

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

  // Agrupar próximos por fecha
  const upcomingByDay = useMemo(() => {
    const groups: { fecha: string; events: EventoCalendario[] }[] = []
    const map: Record<string, EventoCalendario[]> = {}
    upcoming.forEach(ev => {
      if (!map[ev.fecha]) {
        const arr: EventoCalendario[] = []
        map[ev.fecha] = arr
        groups.push({ fecha: ev.fecha, events: arr })
      }
      map[ev.fecha].push(ev)
    })
    return groups
  }, [upcoming])

  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const todayStr = hoy.toISOString().split('T')[0]
  const weekEnd = new Date(hoy); weekEnd.setDate(hoy.getDate() + 7)

  const todayCount = upcoming.filter(e => e.fecha === todayStr).length
  const weekCount = upcoming.filter(e => {
    const d = new Date(e.fecha + 'T00:00:00')
    return d >= hoy && d < weekEnd
  }).length

  if (loading) return <CalendarSkeleton />

  return (
    <div className="animate-fade-in h-full overflow-y-auto">

      {/* ── Header ── */}
      <div className="relative px-4 md:px-6 py-5 overflow-hidden" style={{ borderBottom: '1px solid var(--overlay-06)' }}>
        <div className="max-w-[1100px] mx-auto mb-4 relative">
          <VistaSwitch value={vista} onChange={cambiarVista} />
        </div>
        <div className="max-w-[1100px] mx-auto flex flex-col md:flex-row md:justify-between md:items-start gap-4 relative">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 flex items-center justify-center rounded-xl mt-0.5 shrink-0"
              style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <CalendarDays size={15} className="text-amber" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-extrabold text-xl tracking-tight capitalize text-text-primary">Calendario</h1>
                {todayCount > 0 && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full animate-pulse-soft text-rose"
                    style={{ background: 'rgba(244,63,94,0.15)', border: '1px solid rgba(244,63,94,0.25)' }}>
                    <Zap size={9} style={{ display: 'inline', marginRight: 3, verticalAlign: 'middle' }} />
                    {todayCount} hoy
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <StatChip value={upcoming.length} label="próximos" color="var(--color-text-muted)" />
                <span style={{ color: 'var(--color-text-secondary)', fontSize: 10 }}>·</span>
                <StatChip value={weekCount} label="esta semana" color="var(--color-primary)" />
                {todayCount > 0 && (
                  <>
                    <span style={{ color: 'var(--color-text-secondary)', fontSize: 10 }}>·</span>
                    <StatChip value={todayCount} label="hoy" color="var(--color-rose)" pulse />
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto md:shrink-0">
            <div className="relative flex-1 min-w-[160px] md:flex-none md:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar eventos..."
                className="bg-input border border-white/[0.08] rounded-xl px-4 py-3 text-slate-100 text-sm placeholder:text-text-muted transition-all duration-200 w-full outline-none pl-9 focus:border-primary/50 focus:shadow-[0_0_0_3px_rgba(61,159,137,0.12)]"
              />
            </div>
            <button onClick={handleRefresh} disabled={refreshing}
              className="w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-150 hover:bg-white/5 text-text-muted shrink-0"
              style={{ border: '1px solid var(--overlay-08)' }}
              aria-label="Actualizar">
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            </button>
            {canManage && (
              <button onClick={abrirNuevo}
                className="bg-gradient-to-br from-primary to-primary-dark text-white font-semibold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all duration-200 shadow-primary px-4 py-2.5 text-sm shrink-0">
                <Plus size={15} /> {esActividades ? 'Nueva actividad' : 'Nuevo evento'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-[1100px] mx-auto p-4 md:p-6 flex flex-col gap-5">
        {eventos.length === 0 ? (
          <EmptyState isAdmin={canManage} onNew={abrirNuevo} actividades={esActividades} />
        ) : (
          <>
            <MiniCalendario
              eventos={eventos}
              onDiaClick={handleDiaClick}
              diaHighlight={diaHighlight}
              viewYear={viewYear}
              viewMonth={viewMonth}
              onPrevMonth={handlePrevMonth}
              onNextMonth={handleNextMonth}
            />

            {esActividades && (
              <>
                <div className="rounded-2xl p-4" style={{ background: 'var(--gradient-card)', border: '1px solid var(--overlay-07)' }}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-semibold text-text-secondary">Tu progreso</span>
                    <span className={`text-xs font-bold tabular-nums ${pct === 100 ? 'text-success' : 'text-primary-light'}`}>{pct}%</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--overlay-06)' }}>
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: pct === 100 ? 'linear-gradient(90deg, #2f8f75, #267560)' : 'linear-gradient(90deg, #3d9f89, #2c8178)' }} />
                  </div>
                  <p className="text-xs mt-1.5 text-text-muted">{totalHechas} de {eventos.length} completadas</p>
                </div>
                <div className="flex gap-2 flex-wrap" role="group" aria-label="Filtrar por estado">
                  {([
                    { key: 'todas', label: 'Todas', count: eventos.length },
                    { key: 'pendientes', label: 'Pendientes', count: totalPendientes },
                    { key: 'hechas', label: 'Hechas', count: totalHechas },
                  ] as { key: FiltroEstado; label: string; count: number }[]).map(f => {
                    const active = filtroEstado === f.key
                    return (
                      <button key={f.key} onClick={() => setFiltroEstado(f.key)} aria-pressed={active}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150"
                        style={{
                          background: active ? 'rgba(61,159,137,0.15)' : 'var(--overlay-04)',
                          border: `1px solid ${active ? 'rgba(61,159,137,0.3)' : 'var(--overlay-07)'}`,
                          color: active ? 'var(--color-primary-light)' : 'var(--color-text-muted)',
                        }}>
                        {f.label}
                        <span className="px-1.5 py-0.5 rounded-md text-2xs font-bold tabular-nums"
                          style={{ background: active ? 'rgba(61,159,137,0.2)' : 'var(--overlay-06)' }}>{f.count}</span>
                      </button>
                    )
                  })}
                </div>
              </>
            )}

            {/* Filtros por tipo */}
            <div className="flex flex-wrap gap-2 items-center">
              <button onClick={() => setCategoriaFilter('todas')}
                className="text-xs font-semibold px-3 py-1.5 rounded-full border transition-all duration-200"
                style={{
                  background: categoriaFilter === 'todas' ? 'var(--color-primary)' : 'var(--color-surface)',
                  color: categoriaFilter === 'todas' ? 'var(--color-bg)' : 'var(--color-text)',
                  borderColor: categoriaFilter === 'todas' ? 'var(--color-primary)' : 'var(--border)',
                }}>
                Todas
              </button>
              {TIPOS_EVENTO.filter(t => (TIPOS_ACTIVIDAD.includes(t.id)) === esActividades).map(({ id: cat }) => {
                const cfg = TIPO_EVENTO_CONFIG[cat]
                const active = categoriaFilter === cat
                return (
                  <button key={cat} onClick={() => setCategoriaFilter(active ? 'todas' : cat)}
                    aria-pressed={active}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all duration-200"
                    style={{
                      background: active ? cfg.bg : 'var(--color-surface)',
                      color: active ? cfg.color : 'var(--color-text)',
                      borderColor: active ? cfg.border : 'var(--border)',
                      transform: active ? 'scale(1.03)' : 'scale(1)',
                    }}>
                    <cfg.Icon size={11} aria-hidden="true" />
                    {cfg.label}
                  </button>
                )
              })}
              {(searchQuery || categoriaFilter !== 'todas' || filtroEstado !== 'todas') && (
                <button onClick={() => { setSearchQuery(''); setCategoriaFilter('todas'); setFiltroEstado('todas') }}
                  className="text-xs text-text-muted hover:text-text-primary underline underline-offset-2 transition-colors ml-auto">
                  Limpiar filtros
                </button>
              )}
            </div>

            {/* Upcoming events — grouped by day */}
            <div className="flex flex-col gap-3">
              <SectionHeader label="Próximos" count={upcoming.length} color="var(--color-warning)" />
              {upcoming.length === 0 ? (
                <SectionEmpty message="No hay eventos próximos que coincidan con los filtros aplicados." />
              ) : (
                upcomingByDay.map(({ fecha, events }) => (
                  <div key={fecha} className="flex flex-col gap-2">
                    <DayHeader fecha={fecha} />
                    {events.map((ev, idx) => (
                      <div key={ev.id} ref={el => { eventRefs.current[ev.id] = el }}
                        className="animate-slide-up" style={{ animationDelay: `${idx * 40}ms` }}>
                        <EventCard
                          evento={ev}
                          isAdmin={canManage && ev.clase === usuario?.clase}
                          onEdit={() => abrirEditar(ev)}
                          onDelete={() => handleEliminar(ev)}
                          highlight={diaHighlight === ev.fecha}
                          estado={esActividades ? {
                            completada: estados[ev.id] ?? false,
                            toggling: toggling === ev.id,
                            onToggle: () => handleToggle(ev),
                            adminCount: canManage ? (statsAdmin[ev.id] ?? 0) : null,
                            totalAlumnos,
                          } : undefined}
                        />
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>

            {/* Past events — collapsible */}
            <div className="flex flex-col gap-2.5">
              <button onClick={() => setPastExpanded(p => !p)}
                className="flex items-center gap-2 group w-full" aria-expanded={pastExpanded}>
                <SectionHeader label="Pasados" count={past.length} color="var(--color-text-muted)" />
                <span className="ml-auto text-xs px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all duration-150 text-text-muted shrink-0"
                  style={{ background: pastExpanded ? 'var(--overlay-06)' : 'transparent', border: '1px solid var(--overlay-06)' }}>
                  {pastExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                  {pastExpanded ? 'Ocultar' : `Ver ${past.length}`}
                </span>
              </button>

              {pastExpanded && (
                <div className="flex flex-col gap-2.5">
                  {past.length === 0 ? (
                    <SectionEmpty message="No hay eventos pasados que coincidan con los filtros aplicados." />
                  ) : (
                    past.map((ev, idx) => (
                      <div key={ev.id} ref={el => { eventRefs.current[ev.id] = el }}
                        className="animate-slide-up" style={{ animationDelay: `${idx * 30}ms` }}>
                        <EventCard
                          evento={ev}
                          isAdmin={canManage && ev.clase === usuario?.clase}
                          onEdit={() => abrirEditar(ev)}
                          onDelete={() => handleEliminar(ev)}
                          past
                          highlight={diaHighlight === ev.fecha}
                          estado={esActividades ? {
                            completada: estados[ev.id] ?? false,
                            toggling: toggling === ev.id,
                            onToggle: () => handleToggle(ev),
                            adminCount: canManage ? (statsAdmin[ev.id] ?? 0) : null,
                            totalAlumnos,
                          } : undefined}
                        />
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Modal crear/editar evento — via portal ── */}
      {modalVisible && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className="absolute inset-0"
            style={{ background: 'var(--color-modal-backdrop)', backdropFilter: 'blur(10px)' }}
            onClick={cerrarModal}
          />
          <div
            className="relative w-full sm:max-w-md animate-slide-in-bottom sm:animate-scale-in-modal rounded-t-2xl sm:rounded-2xl shadow-modal"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--overlay-08)' }}
          >
            <div className="w-8 h-1 mx-auto mt-4 mb-1 sm:hidden rounded-full" style={{ background: 'var(--overlay-15)' }} />

            <div className="p-6 pt-4 sm:pt-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 flex items-center justify-center rounded-xl"
                    style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)' }}>
                    {editandoEvento ? <Pencil size={15} className="text-amber" /> : <CalendarDays size={15} className="text-amber" />}
                  </div>
                  <div>
                    <h2 className="font-extrabold text-lg leading-tight text-text-primary">
                      {editandoEvento ? 'Editar Evento' : 'Nuevo Evento'}
                    </h2>
                    <p className="text-xs mt-0.5 text-text-muted">
                      {editandoEvento ? 'Modifica los datos del evento' : 'Pon el título y elige de qué tipo es'}
                    </p>
                  </div>
                </div>
                <button onClick={cerrarModal} className="text-text-muted hover:text-text-primary transition-colors">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleGuardar} className="flex flex-col gap-4">
                {/* Título */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-secondary">Título</label>
                  <input
                    type="text"
                    value={form.titulo}
                    onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                    placeholder="Ej: Actividad 2 de Informática"
                    className="bg-input border border-white/[0.08] rounded-xl px-4 py-3 text-slate-100 text-sm placeholder:text-text-muted transition-all duration-200 w-full outline-none focus:border-primary/50 focus:shadow-[0_0_0_3px_rgba(61,159,137,0.12)]"
                    autoFocus
                  />
                </div>

                {/* Tipo */}
                <TipoSelector value={form.tipo} onChange={tipo => setForm(f => ({ ...f, tipo }))} />

                {/* Asignatura */}
                {(
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-text-secondary">Asignatura (opcional)</label>
                    <input
                      value={form.materia}
                      onChange={e => setForm(f => ({ ...f, materia: e.target.value }))}
                      placeholder="Selecciona o escribe..."
                      className="bg-input border border-white/[0.08] rounded-xl px-4 py-3 text-slate-100 text-sm placeholder:text-text-muted transition-all duration-200 w-full outline-none focus:border-primary/50 focus:shadow-[0_0_0_3px_rgba(61,159,137,0.12)]"
                      list="cal-materias-list"
                    />
                    <datalist id="cal-materias-list">
                      {MATERIAS.map(m => <option key={m.codigo} value={m.nombreCorto} />)}
                    </datalist>
                  </div>
                )}

                {/* Descripción */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-secondary">Descripción (opcional)</label>
                  <textarea
                    value={form.descripcion}
                    onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                    placeholder="Más detalles..."
                    rows={3}
                    className="bg-input border border-white/[0.08] rounded-xl px-4 py-3 text-slate-100 text-sm placeholder:text-text-muted transition-all duration-200 w-full outline-none resize-none focus:border-primary/50 focus:shadow-[0_0_0_3px_rgba(61,159,137,0.12)]"
                  />
                </div>

                {/* Fecha + Hora */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-text-secondary">Fecha de fin</label>
                    <input
                      type="date"
                      value={form.fecha}
                      onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                      className="bg-input border border-white/[0.08] rounded-xl px-4 py-3 text-slate-100 text-sm transition-all duration-200 w-full outline-none [color-scheme:dark] focus:border-primary/50 focus:shadow-[0_0_0_3px_rgba(61,159,137,0.12)]"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-text-secondary">Hora (opcional)</label>
                    <input
                      type="time"
                      value={form.hora}
                      onChange={e => setForm(f => ({ ...f, hora: e.target.value }))}
                      className="bg-input border border-white/[0.08] rounded-xl px-4 py-3 text-slate-100 text-sm transition-all duration-200 w-full outline-none [color-scheme:dark] focus:border-primary/50 focus:shadow-[0_0_0_3px_rgba(61,159,137,0.12)]"
                    />
                  </div>
                </div>

                {/* Preview fecha */}
                {form.fecha && (
                  <p className="text-xs capitalize -mt-2 text-primary">
                    {formatFechaPreview(form.fecha)}
                    {form.hora && <span className="text-text-muted"> a las {form.hora}</span>}
                  </p>
                )}

                <div className="flex gap-3 mt-1">
                  <Button type="button" variant="ghost" onClick={cerrarModal} className="flex-1 py-3 text-sm">
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saving} loading={saving} className="flex-[2] py-3 text-sm">
                    {saving ? (editandoEvento ? 'Guardando...' : 'Creando...') : (editandoEvento ? 'Guardar cambios' : 'Crear Evento')}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>,
        document.body
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
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TipoSelector({ value, onChange }: { value: TipoEvento; onChange: (t: TipoEvento) => void }) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})

  function onKeyDown(e: React.KeyboardEvent, idx: number) {
    const n = TIPOS_EVENTO.length
    let next = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % n
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (idx - 1 + n) % n
    if (next < 0) return
    e.preventDefault()
    const id = TIPOS_EVENTO[next].id
    onChange(id)
    refs.current[id]?.focus()
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span id="tipo-evento-label" className="text-xs font-semibold text-text-secondary">Tipo</span>
      <div role="radiogroup" aria-labelledby="tipo-evento-label" className="grid grid-cols-2 min-[420px]:grid-cols-3 gap-2">
        {TIPOS_EVENTO.map(({ id, descripcion }, idx) => {
          const cfg = TIPO_EVENTO_CONFIG[id]
          const active = value === id
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              ref={el => { refs.current[id] = el }}
              onClick={() => onChange(id)}
              onKeyDown={e => onKeyDown(e, idx)}
              title={descripcion}
              className="flex items-center justify-center gap-1.5 text-xs font-semibold px-2 py-2 rounded-xl border transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              style={{
                background: active ? cfg.bg : 'var(--overlay-03)',
                color: active ? cfg.color : 'var(--color-text-secondary)',
                borderColor: active ? cfg.color : 'var(--overlay-08)',
                boxShadow: active ? `0 0 0 1px ${cfg.border}` : 'none',
              }}
            >
              <cfg.Icon size={13} aria-hidden="true" />
              {cfg.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function StatChip({ value, label, color, pulse }: { value: number; label: string; color: string; pulse?: boolean }) {
  return (
    <span className={`text-xs ${pulse ? 'animate-pulse-soft' : ''}`} style={{ color: value > 0 ? color : 'var(--color-text-secondary)' }}>
      <span className="font-bold">{value}</span>{' '}
      <span className="text-text-muted">{label}</span>
    </span>
  )
}

function EventCard({
  evento, isAdmin, onEdit, onDelete, past, highlight, estado,
}: {
  evento: EventoCalendario
  isAdmin: boolean
  onEdit: () => void
  onDelete: () => void
  past?: boolean
  highlight?: boolean
  estado?: {
    completada: boolean
    toggling: boolean
    onToggle: () => void
    adminCount: number | null
    totalAlumnos: number
  }
}) {
  const relativo = fechaRelativa(evento.fecha)
  const isToday = relativo === 'Hoy'

  const dayNum = parseInt(evento.fecha.split('-')[2])
  const monthIdx = parseInt(evento.fecha.split('-')[1]) - 1

  const cat = tipoEventoConfig(evento.tipo)
  const mainColor = cat.color
  const mainBg = cat.bg
  const mainBorder = cat.border

  const hue = evento.materia ? materiaHue(evento.materia) : null

  const hoyMidnight = new Date(); hoyMidnight.setHours(0, 0, 0, 0)
  const evDate = new Date(evento.fecha + 'T00:00:00')
  const daysUntil = Math.round((evDate.getTime() - hoyMidnight.getTime()) / 86400000)

  const completada = estado?.completada ?? false
  const vencida = !!estado && !completada && fechaLimiteEvento(evento).getTime() < Date.now()
  const relativoLabel = completada ? 'Completada' : vencida ? 'Vencida' : relativo

  const badgeStyle = completada ? {
    background: 'rgba(16,185,129,0.1)', color: '#2f8f75', border: '1px solid rgba(16,185,129,0.25)',
  } : vencida ? {
    background: 'rgba(244,63,94,0.12)', color: 'var(--color-rose)', border: '1px solid rgba(244,63,94,0.28)',
  } : past ? {
    background: 'var(--overlay-03)', color: 'var(--color-text-muted)', border: '1px solid var(--overlay-05)',
  } : daysUntil === 0 ? {
    background: 'rgba(244,63,94,0.15)', color: 'var(--color-rose)', border: '1px solid rgba(244,63,94,0.3)',
  } : daysUntil === 1 ? {
    background: 'rgba(249,115,22,0.12)', color: '#fb923c', border: '1px solid rgba(249,115,22,0.25)',
  } : daysUntil <= 3 ? {
    background: 'rgba(245,158,11,0.12)', color: 'var(--color-warning)', border: '1px solid rgba(245,158,11,0.25)',
  } : daysUntil <= 7 ? {
    background: 'rgba(16,185,129,0.1)', color: '#61ae98', border: '1px solid rgba(16,185,129,0.2)',
  } : {
    background: 'var(--overlay-05)', color: 'var(--color-text-muted)', border: '1px solid var(--overlay-08)',
  }

  return (
    <div
      className="flex rounded-2xl overflow-hidden transition-all duration-200"
      style={{
        background: past ? 'var(--color-surface)' : 'var(--gradient-card)',
        border: highlight ? '1px solid rgba(61,159,137,0.45)'
          : isToday ? '1px solid rgba(244,63,94,0.2)'
          : past ? '1px solid var(--overlay-04)'
          : '1px solid var(--overlay-07)',
        opacity: past ? 0.55 : completada ? 0.75 : 1,
        boxShadow: highlight ? '0 0 0 3px rgba(61,159,137,0.12)'
          : isToday ? '0 0 0 1px rgba(244,63,94,0.08), inset 0 1px 0 var(--overlay-04)'
          : 'inset 0 1px 0 var(--overlay-03)',
      }}
    >
      <div className="w-1 shrink-0" style={{ background: past ? 'var(--overlay-06)' : mainColor, opacity: past ? 1 : 0.8 }} />

      <div className="flex gap-2.5 sm:gap-3.5 flex-1 min-w-0 px-3 py-3 sm:px-4 sm:py-3.5">
        {/* Date block */}
        <div className="w-11 h-11 sm:w-12 sm:h-12 flex flex-col items-center justify-center shrink-0 rounded-xl"
          style={{
            background: isToday ? `linear-gradient(135deg, ${mainColor}, ${mainColor}cc)` : past ? 'var(--overlay-04)' : mainBg,
            border: isToday ? 'none' : past ? '1px solid var(--overlay-05)' : `1px solid ${mainBorder}`,
            boxShadow: isToday ? `0 4px 16px ${mainColor}50` : 'none',
          }}>
          <span className="text-base font-extrabold leading-none tabular-nums"
            style={{ color: isToday ? 'white' : past ? 'var(--color-text-muted)' : mainColor }}>
            {dayNum}
          </span>
          <span className="text-xs mt-0.5 uppercase font-medium"
            style={{ color: isToday ? 'rgba(255,255,255,0.7)' : past ? 'var(--color-text-secondary)' : mainColor, opacity: isToday ? 1 : 0.65 }}>
            {MESES_CORTO[monthIdx]}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <div className="flex flex-col gap-1.5 min-w-0">
              {!past ? <TipoEventoBadge tipo={evento.tipo} className="w-fit" /> : (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium w-fit text-text-muted">
                  <cat.Icon size={11} aria-hidden="true" />{cat.label}
                </span>
              )}
              <p className="font-semibold text-sm leading-snug break-words"
                style={{ color: past || completada ? 'var(--color-text-muted)' : 'var(--color-text)', textDecoration: completada ? 'line-through' : 'none' }}>
                {evento.titulo}
              </p>
            </div>
            <div className="flex items-center justify-end flex-wrap sm:flex-nowrap gap-1.5 sm:shrink-0">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg whitespace-nowrap flex items-center gap-1 ${isToday ? 'animate-pulse-soft' : ''}`}
                style={badgeStyle}>
                {completada ? <Check size={10} /> : vencida ? <AlertTriangle size={10} /> : isToday && <Zap size={9} />}
                {relativoLabel}
              </span>
              {estado && (
                <button onClick={estado.onToggle} disabled={estado.toggling}
                  role="checkbox" aria-checked={estado.completada}
                  className="w-8 h-8 sm:w-6 sm:h-6 flex items-center justify-center rounded-md transition-all duration-200 active:scale-90 shrink-0"
                  style={{
                    background: estado.completada ? '#2f8f75' : 'transparent',
                    border: `2px solid ${estado.completada ? '#2f8f75' : 'var(--overlay-20)'}`,
                  }}
                  aria-label={estado.completada ? 'Marcar como pendiente' : 'Marcar como completada'}>
                  {estado.toggling ? <Spinner size="sm" className="!w-2.5 !h-2.5 text-white" />
                    : estado.completada ? <Check size={12} strokeWidth={3} className="text-white" /> : null}
                </button>
              )}
              {isAdmin && !past && (
                <>
                  <button onClick={onEdit}
                    className="w-8 h-8 sm:w-7 sm:h-7 flex items-center justify-center rounded-lg transition-all duration-150"
                    style={{ color: 'var(--color-text-muted)', border: '1px solid transparent' }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLElement
                      el.style.color = 'var(--color-primary-light)'
                      el.style.background = 'rgba(61,159,137,0.08)'
                      el.style.borderColor = 'rgba(61,159,137,0.2)'
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLElement
                      el.style.color = 'var(--color-text-muted)'
                      el.style.background = 'transparent'
                      el.style.borderColor = 'transparent'
                    }}
                    aria-label="Editar evento">
                    <Pencil size={12} />
                  </button>
                  <button onClick={onDelete}
                    className="w-8 h-8 sm:w-7 sm:h-7 flex items-center justify-center rounded-lg transition-all duration-150"
                    style={{ color: 'var(--color-text-muted)', border: '1px solid transparent' }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLElement
                      el.style.color = 'var(--color-rose)'
                      el.style.background = 'rgba(244,63,94,0.1)'
                      el.style.borderColor = 'rgba(244,63,94,0.2)'
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLElement
                      el.style.color = 'var(--color-text-muted)'
                      el.style.background = 'transparent'
                      el.style.borderColor = 'transparent'
                    }}
                    aria-label="Eliminar evento">
                    <Trash2 size={13} />
                  </button>
                </>
              )}
            </div>
          </div>

          {evento.materia && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full w-fit max-w-full truncate"
              style={hue !== null
                ? { background: `hsla(${hue},60%,65%,0.1)`, color: `hsl(${hue},60%,65%)`, border: `1px solid hsla(${hue},60%,65%,0.28)` }
                : { background: 'var(--overlay-05)', color: 'var(--color-text-secondary)', border: '1px solid var(--overlay-08)' }}>
              {evento.materia}
            </span>
          )}
          {evento.descripcion && (
            <p className="text-xs leading-relaxed line-clamp-2"
              style={{ color: past ? 'var(--color-text-muted)' : 'var(--color-text-secondary)' }}>
              {evento.descripcion}
            </p>
          )}

          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <div className="flex items-center gap-1">
              <CalendarDays size={10} style={{ color: past ? 'var(--color-text-secondary)' : 'var(--color-text-muted)' }} />
              <p className="text-xs" style={{ color: past ? 'var(--color-text-secondary)' : 'var(--color-text-muted)' }}>
                {formatFecha(evento.fecha)}
              </p>
            </div>
            {estado && estado.adminCount !== null && estado.totalAlumnos > 0 && (
              <span className="flex items-center gap-2 text-[10px] font-medium text-text-muted">
                <span className="h-1 w-16 shrink-0 rounded-full overflow-hidden" style={{ background: 'var(--overlay-06)' }}>
                  <span className="block h-full rounded-full bg-success" style={{ width: `${(estado.adminCount / estado.totalAlumnos) * 100}%` }} />
                </span>
                {estado.adminCount} de {estado.totalAlumnos} alumnos la han completado
              </span>
            )}
            {evento.hora && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md tabular-nums"
                style={{ background: past ? 'var(--overlay-04)' : mainBg, color: past ? 'var(--color-text-muted)' : mainColor, border: `1px solid ${past ? 'var(--overlay-05)' : mainBorder}` }}>
                <Clock size={10} aria-hidden="true" />
                {evento.hora.slice(0, 5)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
