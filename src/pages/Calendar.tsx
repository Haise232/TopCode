import { useEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  Plus, Trash2, RefreshCw, CalendarDays, Clock,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Zap, BookOpen, FileText, Star,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useEventos } from '../hooks/useEventos'
import { EventoCalendario } from '../lib/types'
import { MATERIAS } from '../constants/materias'
import AlertModal from '../components/AlertModal'
import { SkeletonBox, SkeletonCard } from '../components/Skeleton'

// ─── Constants ───────────────────────────────────────────────────────────────

const MESES = [
  'enero','febrero','marzo','abril','mayo','junio',
  'julio','agosto','septiembre','octubre','noviembre','diciembre',
]
const MESES_CORTO = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
const DIAS_SEMANA = ['Lu','Ma','Mi','Ju','Vi','Sa','Do']

// ─── Category system ─────────────────────────────────────────────────────────

type Categoria = 'examen' | 'entrega' | 'clase' | 'general'

const CATEGORIA_CONFIG: Record<Categoria, { label: string; color: string; bg: string; border: string; Icon: React.FC<{ size?: number }> }> = {
  examen: {
    label: 'Examen',
    color: '#f43f5e',
    bg: 'rgba(244,63,94,0.12)',
    border: 'rgba(244,63,94,0.25)',
    Icon: ({ size = 12 }) => <BookOpen size={size} />,
  },
  entrega: {
    label: 'Entrega',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.12)',
    border: 'rgba(245,158,11,0.25)',
    Icon: ({ size = 12 }) => <FileText size={size} />,
  },
  clase: {
    label: 'Clase especial',
    color: '#55efc4',
    bg: 'rgba(85,239,196,0.12)',
    border: 'rgba(85,239,196,0.25)',
    Icon: ({ size = 12 }) => <Star size={size} />,
  },
  general: {
    label: 'Evento',
    color: '#14b8a6',
    bg: 'rgba(20,184,166,0.12)',
    border: 'rgba(20,184,166,0.25)',
    Icon: ({ size = 12 }) => <CalendarDays size={size} />,
  },
}

// Color determinista por asignatura — evita que todos los exámenes sean rojos
function materiaHue(nombre: string): number {
  return nombre.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360
}

function inferirCategoria(titulo: string): Categoria {
  const t = titulo.toLowerCase()
  if (t.includes('examen') || t.includes('parcial') || t.includes('final') || t.includes('quiz') || t.includes('evaluacion') || t.includes('evaluación')) return 'examen'
  if (t.includes('entrega') || t.includes('practica') || t.includes('práctica') || t.includes('tarea') || t.includes('proyecto') || t.includes('tp') || t.includes('trabajo')) return 'entrega'
  if (t.includes('clase') || t.includes('taller') || t.includes('seminario') || t.includes('charla')) return 'clase'
  return 'general'
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

// Devuelve el primer día de la semana del mes (0=lunes, 6=domingo)
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
        <SkeletonBox className="h-7 w-28 shimmer" />
        <SkeletonBox className="h-10 w-32 shimmer rounded-xl" />
      </div>
      <div className="max-w-[1100px] mx-auto p-4 md:p-6 flex flex-col gap-4">
        <SkeletonCard className="h-64 shimmer rounded-2xl" />
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
  eventos,
  onDiaClick,
  diaHighlight,
  viewYear,
  viewMonth,
  onPrevMonth,
  onNextMonth,
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

  // Set de días del mes visualizado que tienen eventos
  const diasConEvento = new Set<number>()
  eventos.forEach(ev => {
    const [y, m, d] = ev.fecha.split('-').map(Number)
    if (y === viewYear && m - 1 === viewMonth) diasConEvento.add(d)
  })

  const cells: (number | null)[] = []
  for (let i = 0; i < offset; i++) cells.push(null)
  for (let d = 1; d <= totalDias; d++) cells.push(d)

  function fechaStr(d: number) {
    return `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }

  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: 'var(--gradient-card)',
        border: '1px solid var(--overlay-07)',
      }}
    >
      {/* Month title */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={onPrevMonth}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-150 hover:bg-white/[0.06]"
            style={{ color: '#64748b', border: '1px solid var(--overlay-07)' }}
            aria-label="Mes anterior"
          >
            <ChevronLeft size={13} />
          </button>
          <span className="font-bold text-sm capitalize" style={{ color: 'var(--color-text)', minWidth: '120px', textAlign: 'center' }}>
            {MESES[viewMonth]} {viewYear}
          </span>
          <button
            onClick={onNextMonth}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-150 hover:bg-white/[0.06]"
            style={{ color: '#64748b', border: '1px solid var(--overlay-07)' }}
            aria-label="Mes siguiente"
          >
            <ChevronRight size={13} />
          </button>
        </div>
        <div className="flex items-center gap-3 text-xs" style={{ color: '#4b5563' }}>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: '#55efc4' }} />
            Hoy
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#f59e0b' }} />
            Evento
          </span>
        </div>
      </div>

      {/* Days of week header */}
      <div className="grid grid-cols-7 mb-1">
        {DIAS_SEMANA.map(d => (
          <div key={d} className="text-center text-xs font-semibold py-1" style={{ color: '#4b5563' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((dia, idx) => {
          if (dia === null) return <div key={`empty-${idx}`} />
          const isToday = isCurrentMonth && dia === todayDay
          const hasEvento = diasConEvento.has(dia)
          const fs = fechaStr(dia)
          const isHighlighted = diaHighlight === fs

          return (
            <button
              key={dia}
              onClick={() => hasEvento && onDiaClick(fs)}
              className="relative flex flex-col items-center justify-center h-9 w-full rounded-lg transition-all duration-150"
              style={{
                background: isToday
                  ? 'linear-gradient(135deg, #55efc4, #00cec9)'
                  : isHighlighted
                  ? 'rgba(85,239,196,0.15)'
                  : hasEvento
                  ? 'rgba(245,158,11,0.06)'
                  : 'transparent',
                border: isHighlighted && !isToday
                  ? '1px solid rgba(85,239,196,0.3)'
                  : '1px solid transparent',
                cursor: hasEvento ? 'pointer' : 'default',
                boxShadow: isToday ? '0 2px 8px rgba(85,239,196,0.35)' : 'none',
              }}
            >
              <span
                className="text-xs font-semibold tabular-nums"
                style={{
                  color: isToday ? 'white' : hasEvento ? '#f1f5f9' : '#4b5563',
                  fontWeight: isToday || hasEvento ? 700 : 400,
                }}
              >
                {dia}
              </span>
              {hasEvento && !isToday && (
                <span
                  className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                  style={{ background: '#f59e0b' }}
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ isAdmin, onNew }: { isAdmin: boolean; onNew: () => void }) {
  return (
    <div
      className="py-16 flex flex-col items-center gap-5 text-center rounded-2xl"
      style={{
        background: 'var(--gradient-card)',
        border: '1px solid var(--overlay-06)',
      }}
    >
      {/* Inline SVG illustration */}
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="8" y="16" width="64" height="56" rx="8" fill="rgba(245,158,11,0.08)" stroke="rgba(245,158,11,0.2)" strokeWidth="1.5" />
        <rect x="8" y="16" width="64" height="16" rx="8" fill="rgba(245,158,11,0.12)" />
        <rect x="22" y="8" width="4" height="16" rx="2" fill="#f59e0b" opacity="0.6" />
        <rect x="54" y="8" width="4" height="16" rx="2" fill="#f59e0b" opacity="0.6" />
        <rect x="20" y="44" width="12" height="12" rx="3" fill="rgba(85,239,196,0.25)" stroke="rgba(85,239,196,0.3)" strokeWidth="1" />
        <rect x="36" y="44" width="12" height="12" rx="3" fill="rgba(245,158,11,0.15)" stroke="rgba(245,158,11,0.2)" strokeWidth="1" />
        <rect x="52" y="44" width="12" height="12" rx="3" fill="rgba(20,184,166,0.12)" stroke="rgba(20,184,166,0.2)" strokeWidth="1" />
        <circle cx="60" cy="60" r="12" fill="rgba(85,239,196,0.15)" stroke="rgba(85,239,196,0.3)" strokeWidth="1.5" />
        <line x1="60" y1="55" x2="60" y2="60" stroke="#8ff5d6" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="60" y1="60" x2="63" y2="63" stroke="#8ff5d6" strokeWidth="1.5" strokeLinecap="round" />
      </svg>

      <div className="flex flex-col gap-2">
        <p className="font-bold text-lg" style={{ color: 'var(--color-text)' }}>Sin eventos programados</p>
        <p className="text-sm leading-relaxed max-w-xs" style={{ color: '#4b5563' }}>
          {isAdmin
            ? 'Añade el primer evento para que tu clase esté al tanto de lo que se viene.'
            : 'Todavía no hay eventos en el calendario. Vuelve pronto para estar al día.'}
        </p>
      </div>

      {isAdmin && (
        <button
          onClick={onNew}
          className="btn-primary px-5 py-2.5 text-sm mt-1"
        >
          <Plus size={15} />
          Crear primer evento
        </button>
      )}
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

// ─── Main component ───────────────────────────────────────────────────────────

export default function CalendarPage() {
  const { usuario } = useAuth()
  const isAdmin = usuario?.rol === 'admin'

  const {
    eventos,
    loading,
    init,
    refresh,
    createEvento,
    deleteEvento,
  } = useEventos()

  const [refreshing, setRefreshing] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [alert, setAlert] = useState<AlertState>(null)
  const [pastExpanded, setPastExpanded] = useState(false)
  const [diaHighlight, setDiaHighlight] = useState<string | null>(null)
  const [viewDate, setViewDate] = useState(() => new Date())

  const viewYear = viewDate.getFullYear()
  const viewMonth = viewDate.getMonth()

  const handlePrevMonth = useCallback(() => {
    setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  }, [])

  const handleNextMonth = useCallback(() => {
    setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))
  }, [])

  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [materia, setMateria] = useState('')
  const [fecha, setFecha] = useState(() => new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)

  const categoriaActual = inferirCategoria(titulo)
  const mostrarMateria = categoriaActual === 'examen' || categoriaActual === 'entrega'

  // Refs para scroll a evento por fecha
  const eventRefs = useRef<Record<string, HTMLDivElement | null>>({})

  // Inicializar carga con cache al montar
  useEffect(() => {
    init()
  }, [init])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await refresh()
    setRefreshing(false)
  }, [refresh])

  async function handleGuardar(e: React.FormEvent) {
    e.preventDefault()
    if (!titulo.trim() || !fecha) {
      setAlert({ type: 'error', title: 'Error', message: 'El título y la fecha son obligatorios.' })
      return
    }
    setSaving(true)
    const { error } = await createEvento({
      titulo: titulo.trim(),
      descripcion: descripcion.trim() || null,
      materia: mostrarMateria && materia.trim() ? materia.trim() : null,
      fecha,
      created_by: usuario!.id,
    })
    setSaving(false)
    if (error) {
      setAlert({ type: 'error', title: 'Error', message: 'No se pudo crear el evento: ' + error })
      return
    }
    setModalVisible(false)
    setTitulo(''); setDescripcion(''); setMateria(''); setFecha(new Date().toISOString().split('T')[0])
  }

  function handleEliminar(ev: EventoCalendario) {
    setAlert({
      title: 'Eliminar evento',
      message: `¿Eliminar "${ev.titulo}"?`,
      confirmLabel: 'Eliminar',
      confirmDestructive: true,
      onConfirm: async () => {
        const { error } = await deleteEvento(ev.id)
        if (error) {
          setAlert({ type: 'error', title: 'Error', message: 'No se pudo eliminar el evento.' })
        }
      },
    })
  }

  function handleDiaClick(fechaStr: string) {
    setDiaHighlight(fechaStr)
    // Buscar el primer evento de ese día y hacer scroll
    const firstEvento = eventos.find(ev => ev.fecha === fechaStr)
    if (firstEvento) {
      const el = eventRefs.current[firstEvento.id]
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 50)
      }
    }
    // Quitar highlight después de 2s
    setTimeout(() => setDiaHighlight(null), 2000)
  }

  const upcoming = eventos.filter(e => isUpcoming(e.fecha))
  const past = eventos.filter(e => !isUpcoming(e.fecha)).reverse()

  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const todayStr = hoy.toISOString().split('T')[0]
  const weekEnd = new Date(hoy)
  weekEnd.setDate(hoy.getDate() + 7)

  const todayCount = upcoming.filter(e => e.fecha === todayStr).length
  const weekCount = upcoming.filter(e => {
    const d = new Date(e.fecha + 'T00:00:00')
    return d >= hoy && d < weekEnd
  }).length

  if (loading) return <CalendarSkeleton />

  return (
    <div className="animate-fade-in h-full overflow-y-auto">

      {/* ── Header ── */}
      <div
        className="relative px-4 md:px-6 py-5 overflow-hidden"
        style={{ borderBottom: '1px solid var(--overlay-06)' }}
      >
        <div className="max-w-[1100px] mx-auto flex justify-between items-start gap-4 relative">
          <div className="flex items-start gap-3">
            <div
              className="w-9 h-9 flex items-center justify-center rounded-xl mt-0.5 shrink-0"
              style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)' }}
            >
              <CalendarDays size={15} style={{ color: '#f59e0b' }} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-extrabold text-xl tracking-tight capitalize" style={{ color: 'var(--color-text)' }}>
                  Calendario
                </h1>
                {todayCount > 0 && (
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full animate-pulse-soft"
                    style={{ background: 'rgba(244,63,94,0.15)', color: '#f43f5e', border: '1px solid rgba(244,63,94,0.25)' }}
                  >
                    <Zap size={9} style={{ display: 'inline', marginRight: 3, verticalAlign: 'middle' }} />
                    {todayCount} hoy
                  </span>
                )}
              </div>
              {/* Stats rápidas */}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <StatChip value={upcoming.length} label="próximos" color="#4b5563" />
                <span style={{ color: '#2d3748', fontSize: 10 }}>·</span>
                <StatChip value={weekCount} label="esta semana" color="#55efc4" />
                {todayCount > 0 && (
                  <>
                    <span style={{ color: '#2d3748', fontSize: 10 }}>·</span>
                    <StatChip value={todayCount} label="hoy" color="#f43f5e" pulse />
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-150 hover:bg-white/5"
              style={{ border: '1px solid var(--overlay-08)', color: '#64748b' }}
              aria-label="Actualizar"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            </button>
            {isAdmin && (
              <button onClick={() => setModalVisible(true)} className="btn-primary px-4 py-2.5 text-sm">
                <Plus size={15} />
                Nuevo Evento
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-[1100px] mx-auto p-4 md:p-6 flex flex-col gap-5">

        {eventos.length === 0 ? (
          <EmptyState isAdmin={isAdmin} onNew={() => setModalVisible(true)} />
        ) : (
          <>
            {/* Mini calendar grid */}
            <MiniCalendario
              eventos={eventos}
              onDiaClick={handleDiaClick}
              diaHighlight={diaHighlight}
              viewYear={viewYear}
              viewMonth={viewMonth}
              onPrevMonth={handlePrevMonth}
              onNextMonth={handleNextMonth}
            />

            {/* Upcoming events */}
            {upcoming.length > 0 && (
              <div className="flex flex-col gap-2.5">
                <SectionLabel label="Próximos" count={upcoming.length} color="#f59e0b" colorBg="rgba(245,158,11,0.1)" colorBorder="rgba(245,158,11,0.2)" />
                {upcoming.map((ev, idx) => (
                  <div
                    key={ev.id}
                    ref={el => { eventRefs.current[ev.id] = el }}
                    className="animate-slide-up"
                    style={{ animationDelay: `${idx * 40}ms` }}
                  >
                    <EventCard
                      evento={ev}
                      isAdmin={isAdmin}
                      onDelete={() => handleEliminar(ev)}
                      highlight={diaHighlight === ev.fecha}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Past events — collapsible */}
            {past.length > 0 && (
              <div className="flex flex-col gap-2.5">
                <button
                  onClick={() => setPastExpanded(p => !p)}
                  className="flex items-center gap-2 group"
                  aria-expanded={pastExpanded}
                >
                  <SectionLabel label="Pasados" count={past.length} color="#374151" colorBg="var(--overlay-04)" colorBorder="var(--overlay-06)" />
                  <span
                    className="ml-auto text-xs px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all duration-150"
                    style={{
                      color: '#4b5563',
                      background: pastExpanded ? 'var(--overlay-06)' : 'transparent',
                      border: '1px solid var(--overlay-06)',
                    }}
                  >
                    {pastExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                    {pastExpanded ? 'Ocultar' : `Ver ${past.length} pasados`}
                  </span>
                </button>

                {pastExpanded && (
                  <div className="flex flex-col gap-2.5">
                    {past.map((ev, idx) => (
                      <div
                        key={ev.id}
                        ref={el => { eventRefs.current[ev.id] = el }}
                        className="animate-slide-up"
                        style={{ animationDelay: `${idx * 30}ms` }}
                      >
                        <EventCard
                          evento={ev}
                          isAdmin={isAdmin}
                          onDelete={() => handleEliminar(ev)}
                          past
                          highlight={diaHighlight === ev.fecha}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Modal crear evento — via portal ── */}
      {modalVisible && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className="absolute inset-0"
            style={{ background: 'var(--color-modal-backdrop)', backdropFilter: 'blur(10px)' }}
            onClick={() => setModalVisible(false)}
          />
          <div
            className="relative w-full sm:max-w-md animate-slide-in-bottom sm:animate-scale-in-modal rounded-t-2xl sm:rounded-2xl shadow-modal"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--overlay-08)' }}
          >
            <div className="w-8 h-1 mx-auto mt-4 mb-1 sm:hidden rounded-full" style={{ background: 'var(--overlay-15)' }} />

            <div className="p-6 pt-4 sm:pt-6">
              <div className="flex items-center gap-3 mb-5">
                <div
                  className="w-9 h-9 flex items-center justify-center rounded-xl"
                  style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)' }}
                >
                  <CalendarDays size={15} style={{ color: '#f59e0b' }} />
                </div>
                <div>
                  <h2 className="font-extrabold text-lg leading-tight" style={{ color: 'var(--color-text)' }}>Nuevo Evento</h2>
                  <p className="text-xs mt-0.5" style={{ color: '#4b5563' }}>El tipo se detecta automáticamente del título</p>
                </div>
              </div>

              {/* Category preview chips */}
              <div className="flex items-center gap-1.5 mb-5 flex-wrap">
                {(Object.keys(CATEGORIA_CONFIG) as Categoria[]).map(cat => {
                  const cfg = CATEGORIA_CONFIG[cat]
                  const active = inferirCategoria(titulo) === cat
                  return (
                    <span
                      key={cat}
                      className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-all duration-200"
                      style={{
                        background: active ? cfg.bg : 'var(--overlay-03)',
                        color: active ? cfg.color : '#374151',
                        border: `1px solid ${active ? cfg.border : 'var(--overlay-06)'}`,
                        fontWeight: active ? 600 : 400,
                        transform: active ? 'scale(1.04)' : 'scale(1)',
                      }}
                    >
                      <cfg.Icon size={10} />
                      {cfg.label}
                    </span>
                  )
                })}
              </div>

              <form onSubmit={handleGuardar} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold" style={{ color: '#94a3b8' }}>Título</label>
                  <input
                    type="text"
                    value={titulo}
                    onChange={e => setTitulo(e.target.value)}
                    placeholder="Ej: Examen de Programación"
                    className="input-base"
                    autoFocus
                  />
                </div>
                {mostrarMateria && (
                  <div className="flex flex-col gap-1.5 animate-fade-in">
                    <label className="text-xs font-semibold" style={{ color: '#94a3b8' }}>
                      Asignatura
                    </label>
                    <input
                      value={materia}
                      onChange={e => setMateria(e.target.value)}
                      placeholder="Selecciona o escribe..."
                      className="input-base"
                      list="cal-materias-list"
                    />
                    <datalist id="cal-materias-list">
                      {MATERIAS.map(m => <option key={m.codigo} value={m.nombreCorto} />)}
                    </datalist>
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold" style={{ color: '#94a3b8' }}>Descripción (opcional)</label>
                  <textarea
                    value={descripcion}
                    onChange={e => setDescripcion(e.target.value)}
                    placeholder="Más detalles..."
                    rows={3}
                    className="input-base resize-none"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold" style={{ color: '#94a3b8' }}>Fecha</label>
                  <input
                    type="date"
                    value={fecha}
                    onChange={e => setFecha(e.target.value)}
                    className="input-base [color-scheme:dark]"
                  />
                  {/* Human-readable date preview */}
                  {fecha && (
                    <p className="text-xs capitalize mt-0.5" style={{ color: '#55efc4' }}>
                      {formatFechaPreview(fecha)}
                    </p>
                  )}
                </div>
                <div className="flex gap-3 mt-1">
                  <button type="button" onClick={() => setModalVisible(false)} className="flex-1 btn-ghost py-3 text-sm">
                    Cancelar
                  </button>
                  <button type="submit" disabled={saving} className="flex-[2] btn-primary py-3 text-sm">
                    {saving ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full animate-spin" style={{ border: '1.5px solid var(--overlay-20)', borderTopColor: 'white' }} />
                        Creando...
                      </div>
                    ) : 'Crear Evento'}
                  </button>
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

function StatChip({ value, label, color, pulse }: { value: number; label: string; color: string; pulse?: boolean }) {
  return (
    <span
      className={`text-xs ${pulse ? 'animate-pulse-soft' : ''}`}
      style={{ color: value > 0 ? color : '#2d3748' }}
    >
      <span className="font-bold">{value}</span>{' '}
      <span style={{ color: '#4b5563' }}>{label}</span>
    </span>
  )
}

function SectionLabel({
  label, count, color, colorBg, colorBorder,
}: {
  label: string
  count: number
  color: string
  colorBg: string
  colorBorder: string
}) {
  return (
    <div className="flex items-center gap-2">
      <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color }}>
        {label}
      </h2>
      <span
        className="text-xs font-bold px-2 py-0.5 rounded-full"
        style={{ background: colorBg, color, border: `1px solid ${colorBorder}` }}
      >
        {count}
      </span>
    </div>
  )
}

function EventCard({
  evento, isAdmin, onDelete, past, highlight,
}: {
  evento: EventoCalendario
  isAdmin: boolean
  onDelete: () => void
  past?: boolean
  highlight?: boolean
}) {
  const relativo = fechaRelativa(evento.fecha)
  const isToday = relativo === 'Hoy'

  const dayNum = parseInt(evento.fecha.split('-')[2])
  const monthIdx = parseInt(evento.fecha.split('-')[1]) - 1

  const categoria = inferirCategoria(evento.titulo)
  const cat = CATEGORIA_CONFIG[categoria]

  // Si hay materia, el color visual principal es determinista por asignatura
  const hue = evento.materia ? materiaHue(evento.materia) : null
  const mainColor  = hue !== null ? `hsl(${hue},60%,65%)`       : cat.color
  const mainBg     = hue !== null ? `hsla(${hue},60%,65%,0.1)`  : cat.bg
  const mainBorder = hue !== null ? `hsla(${hue},60%,65%,0.28)` : cat.border

  // Días hasta el evento para colorear el badge de proximidad
  const hoyMidnight = new Date(); hoyMidnight.setHours(0, 0, 0, 0)
  const evDate = new Date(evento.fecha + 'T00:00:00')
  const daysUntil = Math.round((evDate.getTime() - hoyMidnight.getTime()) / 86400000)

  // Badge color: rojo → naranja → ámbar → verde → slate
  const badgeStyle = past ? {
    background: 'var(--overlay-03)',
    color: '#374151',
    border: '1px solid var(--overlay-05)',
  } : daysUntil === 0 ? {
    background: 'rgba(244,63,94,0.15)',
    color: '#f43f5e',
    border: '1px solid rgba(244,63,94,0.3)',
  } : daysUntil === 1 ? {
    background: 'rgba(249,115,22,0.12)',
    color: '#fb923c',
    border: '1px solid rgba(249,115,22,0.25)',
  } : daysUntil <= 3 ? {
    background: 'rgba(245,158,11,0.12)',
    color: '#f59e0b',
    border: '1px solid rgba(245,158,11,0.25)',
  } : daysUntil <= 7 ? {
    background: 'rgba(16,185,129,0.1)',
    color: '#34d399',
    border: '1px solid rgba(16,185,129,0.2)',
  } : {
    background: 'var(--overlay-05)',
    color: '#64748b',
    border: '1px solid var(--overlay-08)',
  }

  return (
    <div
      className="flex rounded-2xl overflow-hidden transition-all duration-200"
      style={{
        background: past
          ? 'rgba(20,23,32,0.55)'
          : 'var(--gradient-card)',
        border: highlight
          ? '1px solid rgba(85,239,196,0.45)'
          : isToday
          ? '1px solid rgba(244,63,94,0.2)'
          : past
          ? '1px solid var(--overlay-04)'
          : '1px solid var(--overlay-07)',
        opacity: past ? 0.55 : 1,
        boxShadow: highlight
          ? '0 0 0 3px rgba(85,239,196,0.12)'
          : isToday
          ? '0 0 0 1px rgba(244,63,94,0.08), inset 0 1px 0 var(--overlay-04)'
          : 'inset 0 1px 0 var(--overlay-03)',
      }}
    >
      {/* Color bar — left side, color por asignatura si la hay */}
      <div
        className="w-1 shrink-0"
        style={{ background: past ? 'var(--overlay-06)' : mainColor, opacity: past ? 1 : 0.8 }}
      />

      <div className="flex gap-3.5 flex-1 min-w-0" style={{ padding: '14px 16px' }}>
        {/* Date block */}
        <div
          className="w-12 h-12 flex flex-col items-center justify-center shrink-0 rounded-xl"
          style={{
            background: isToday
              ? `linear-gradient(135deg, ${mainColor}, ${mainColor}cc)`
              : past
              ? 'var(--overlay-04)'
              : mainBg,
            border: isToday
              ? 'none'
              : past
              ? '1px solid var(--overlay-05)'
              : `1px solid ${mainBorder}`,
            boxShadow: isToday ? `0 4px 16px ${mainColor}50` : 'none',
          }}
        >
          <span
            className="text-base font-extrabold leading-none tabular-nums"
            style={{ color: isToday ? 'white' : past ? '#374151' : mainColor }}
          >
            {dayNum}
          </span>
          <span
            className="text-xs mt-0.5 uppercase font-medium"
            style={{ color: isToday ? 'rgba(255,255,255,0.7)' : past ? '#2d3748' : mainColor, opacity: isToday ? 1 : 0.65 }}
          >
            {MESES_CORTO[monthIdx]}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 min-w-0">
              {/* Category badge */}
              {!past && (
                <span
                  className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md shrink-0 mt-0.5"
                  style={{ background: cat.bg, color: cat.color, border: `1px solid ${cat.border}` }}
                >
                  <cat.Icon size={9} />
                  <span className="hidden sm:inline font-medium">{cat.label}</span>
                </span>
              )}
              <p
                className="font-semibold text-sm leading-snug"
                style={{ color: past ? '#4b5563' : '#f1f5f9' }}
              >
                {evento.titulo}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span
                className={`text-xs font-semibold px-2.5 py-1 rounded-lg whitespace-nowrap flex items-center gap-1 ${isToday ? 'animate-pulse-soft' : ''}`}
                style={badgeStyle}
              >
                {isToday && <Zap size={9} />}
                {relativo}
              </span>
              {isAdmin && !past && (
                <button
                  onClick={onDelete}
                  className="w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-150"
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
                  aria-label="Eliminar evento"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </div>

          {evento.materia && (
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full w-fit"
              style={{
                background: mainBg,
                color: mainColor,
                border: `1px solid ${mainBorder}`,
              }}
            >
              {evento.materia}
            </span>
          )}
          {evento.descripcion && (
            <p
              className="text-xs leading-relaxed line-clamp-2"
              style={{ color: past ? '#374151' : '#64748b' }}
            >
              {evento.descripcion}
            </p>
          )}

          <div className="flex items-center gap-1 mt-0.5">
            <Clock size={10} style={{ color: past ? '#2d3748' : '#4b5563' }} />
            <p className="text-xs" style={{ color: past ? '#2d3748' : '#4b5563' }}>
              {formatFecha(evento.fecha)}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
