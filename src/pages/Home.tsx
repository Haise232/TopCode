import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Calendar, MessageCircle,
  FolderOpen, RefreshCw, ChevronRight, ArrowUpRight,
  GraduationCap, Shield, ClipboardCheck, Clock, Newspaper,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { EventoCalendario, Actividad } from '../lib/types'
import { SkeletonBox, SkeletonCard, SkeletonSchedule, SkeletonQuickActions } from '../components/Skeleton'
import { cacheGet, cacheSet, cacheInvalidatePrefix } from '../lib/cache'
import { cn } from '../components/ui/cn'

// ── Helpers ──────────────────────────────────────────────────────────────────

function saludoEmoji() {
  const h = new Date().getHours()
  if (h < 12) return { texto: 'Buenos días', emoji: '☀️' }
  if (h < 20) return { texto: 'Buenas tardes', emoji: '🌤️' }
  return { texto: 'Buenas noches', emoji: '🌙' }
}

function fechaFormateada() {
  return new Date().toLocaleDateString('es', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

// Hash determinista del nombre de materia → color suave
function materiaColor(nombre: string): string {
  let hash = 0
  for (let i = 0; i < nombre.length; i++) {
    hash = nombre.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 65%, 60%)`
}

// ── Horario ──────────────────────────────────────────────────────────────────

type ClaseHorario = { inicio: string; fin: string; materia: string; codigo: string }

const HORARIO: Record<number, ClaseHorario[]> = {
  1: [
    { inicio: '14:30', fin: '15:25', materia: 'Lenguajes de marcas', codigo: 'LND' },
    { inicio: '15:25', fin: '16:20', materia: 'Lenguajes de marcas', codigo: 'LND' },
    { inicio: '16:20', fin: '17:15', materia: 'Itinerario para la empleabilidad', codigo: 'ITK' },
    { inicio: '17:45', fin: '18:40', materia: 'Inglés profesional', codigo: 'IKL' },
    { inicio: '18:40', fin: '19:35', materia: 'Programación', codigo: 'PRO' },
    { inicio: '19:35', fin: '20:30', materia: 'Bases de datos', codigo: 'BAE' },
  ],
  2: [
    { inicio: '15:30', fin: '16:20', materia: 'Digitalización aplicada', codigo: 'DJK' },
    { inicio: '16:20', fin: '17:10', materia: 'Programación', codigo: 'PRO' },
    { inicio: '17:10', fin: '18:00', materia: 'Entornos de desarrollo', codigo: 'ETS' },
    { inicio: '18:30', fin: '19:20', materia: 'Sistemas informáticos', codigo: 'SSF' },
    { inicio: '19:20', fin: '20:10', materia: 'Sistemas informáticos', codigo: 'SSF' },
    { inicio: '20:10', fin: '21:00', materia: 'Bases de datos', codigo: 'BAE' },
  ],
  3: [
    { inicio: '14:30', fin: '15:25', materia: 'Sistemas informáticos', codigo: 'SSF' },
    { inicio: '15:25', fin: '16:20', materia: 'Itinerario para la empleabilidad', codigo: 'ITK' },
    { inicio: '16:20', fin: '17:15', materia: 'Digitalización aplicada', codigo: 'DJK' },
    { inicio: '17:45', fin: '18:40', materia: 'Programación', codigo: 'PRO' },
    { inicio: '18:40', fin: '19:35', materia: 'Programación', codigo: 'PRO' },
    { inicio: '19:35', fin: '20:30', materia: 'Inglés profesional', codigo: 'IKL' },
  ],
  4: [
    { inicio: '14:30', fin: '15:25', materia: 'Lenguajes de marcas', codigo: 'LND' },
    { inicio: '15:25', fin: '16:20', materia: 'Lenguajes de marcas', codigo: 'LND' },
    { inicio: '16:20', fin: '17:15', materia: 'Programación', codigo: 'PRO' },
    { inicio: '17:45', fin: '18:40', materia: 'Sistemas informáticos', codigo: 'SSF' },
    { inicio: '18:40', fin: '19:35', materia: 'Bases de datos', codigo: 'BAE' },
    { inicio: '19:35', fin: '20:30', materia: 'Entornos de desarrollo', codigo: 'ETS' },
  ],
  5: [
    { inicio: '14:30', fin: '15:25', materia: 'Sistemas informáticos', codigo: 'SSF' },
    { inicio: '15:25', fin: '16:20', materia: 'Bases de datos', codigo: 'BAE' },
    { inicio: '16:20', fin: '17:15', materia: 'Bases de datos', codigo: 'BAE' },
    { inicio: '17:45', fin: '18:40', materia: 'Itinerario para la empleabilidad', codigo: 'ITK' },
    { inicio: '18:40', fin: '19:35', materia: 'Programación', codigo: 'PRO' },
    { inicio: '19:35', fin: '20:30', materia: 'Entornos de desarrollo', codigo: 'ETS' },
  ],
}

function enMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function HomeSkeleton() {
  return (
    <div className="animate-fade-in">
      {/* Hero header skeleton */}
      <div className="px-4 md:px-6 py-8 border-b border-overlay-6">
        <div className="max-w-[1100px] mx-auto flex justify-between items-center">
          <div className="flex flex-col gap-2.5">
            <SkeletonBox className="h-3 w-20 shimmer" />
            <SkeletonBox className="h-8 w-52 shimmer" />
            <SkeletonBox className="h-3 w-32 shimmer" />
          </div>
          <SkeletonBox className="h-10 w-10 shimmer rounded-xl" />
        </div>
      </div>

      <div className="max-w-[1100px] mx-auto p-4 md:p-6 flex flex-col gap-6">
        {/* Horario — 6 filas que reflejan la cantidad real de clases diarias */}
        <SkeletonSchedule rows={6} />

        {/* Acceso rápido — 5 cards (alumno), 6 si admin */}
        <SkeletonQuickActions count={5} />

        {/* Próximamente: actividad + evento */}
        {[1, 2].map(i => (
          <SkeletonCard key={i} className="flex items-center gap-3 py-4">
            <SkeletonBox className="h-10 w-10 shrink-0 shimmer rounded-xl" />
            <div className="flex-1 flex flex-col gap-2">
              <SkeletonBox className="h-4 w-3/4 shimmer" />
              <SkeletonBox className="h-3 w-1/4 shimmer" />
            </div>
            <SkeletonBox className="h-8 w-12 shimmer rounded-lg" />
          </SkeletonCard>
        ))}
      </div>
    </div>
  )
}

// ── Quick actions ─────────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  {
    label: 'News',
    desc: 'Tech',
    Icon: Newspaper,
    to: '/news',
    color: '#8ff5d6',
    bg: 'rgba(85,239,196,0.1)',
    border: 'rgba(85,239,196,0.25)',
    glow: 'rgba(85,239,196,0.2)',
    gradFrom: 'rgba(85,239,196,0.06)',
    gradTo: 'rgba(85,239,196,0.02)',
    badge: null,
  },
  {
    label: 'Eventos',
    desc: 'Calendario',
    Icon: Calendar,
    to: '/calendar',
    color: '#fbbf24',
    bg: 'rgba(245,158,11,0.1)',
    border: 'rgba(245,158,11,0.25)',
    glow: 'rgba(245,158,11,0.2)',
    gradFrom: 'rgba(245,158,11,0.06)',
    gradTo: 'rgba(245,158,11,0.02)',
    badge: null,
  },
  {
    label: 'Chat',
    desc: 'Mensajes',
    Icon: MessageCircle,
    to: '/chat',
    color: '#2dd4bf',
    bg: 'rgba(20,184,166,0.1)',
    border: 'rgba(20,184,166,0.25)',
    glow: 'rgba(20,184,166,0.2)',
    gradFrom: 'rgba(20,184,166,0.06)',
    gradTo: 'rgba(20,184,166,0.02)',
    badge: null,
  },
  {
    label: 'Apuntes',
    desc: 'Archivos',
    Icon: FolderOpen,
    to: '/apuntes',
    color: '#00cec9',
    bg: 'rgba(0,206,201,0.1)',
    border: 'rgba(0,206,201,0.25)',
    glow: 'rgba(0,206,201,0.2)',
    gradFrom: 'rgba(0,206,201,0.06)',
    gradTo: 'rgba(0,206,201,0.02)',
    badge: null,
  },
  {
    label: 'Actividades',
    desc: 'Tareas',
    Icon: ClipboardCheck,
    to: '/actividades',
    color: '#34d399',
    bg: 'rgba(16,185,129,0.1)',
    border: 'rgba(16,185,129,0.25)',
    glow: 'rgba(16,185,129,0.18)',
    gradFrom: 'rgba(16,185,129,0.06)',
    gradTo: 'rgba(16,185,129,0.02)',
    badge: null, // se sobreescribe dinámicamente en el render
  },
]

const ADMIN_ACTION = {
  label: 'Admin',
  desc: 'Panel',
  Icon: Shield,
  to: '/admin',
  color: '#fb7185',
  bg: 'rgba(244,63,94,0.1)',
  border: 'rgba(244,63,94,0.25)',
  glow: 'rgba(244,63,94,0.18)',
  gradFrom: 'rgba(244,63,94,0.06)',
  gradTo: 'rgba(244,63,94,0.02)',
  badge: null,
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Home() {
  const { usuario, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [proximoEvento, setProximoEvento] = useState<EventoCalendario | null>(null)
  const [proximaActividad, setProximaActividad] = useState<Actividad | null>(null)
  const [actividadesPendientes, setActividadesPendientes] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  // Guardia de montado: evita actualizaciones de estado tras desmontar el componente
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const cargarDatos = useCallback(async (forzar = false) => {
    if (!usuario) return
    const now = new Date().toISOString()
    const hoy = now.slice(0, 10)

    // Claves de caché para datos globales (no dependen del usuario)
    const CACHE_EVENTO = 'home:proximo-evento'
    const CACHE_ACTS   = 'home:actividades-futuras'

    // Si se fuerza un refresh (botón manual), invalidar caché global
    if (forzar) cacheInvalidatePrefix('home:')

    // Leer caché para las dos queries globales; si hay miss, ir a Supabase
    const cachedEvento = cacheGet<EventoCalendario[]>(CACHE_EVENTO)
    const cachedActs   = cacheGet<Actividad[]>(CACHE_ACTS)

    const [evento, acts, estados] = await Promise.all([
      cachedEvento !== null
        ? Promise.resolve({ data: cachedEvento, error: null })
        : supabase.from('eventos').select('*').gte('fecha', hoy).order('fecha', { ascending: true }).limit(1),
      cachedActs !== null
        ? Promise.resolve({ data: cachedActs, error: null })
        : supabase.from('actividades').select('*').gte('fecha_entrega', now).order('fecha_entrega', { ascending: true }),
      // actividades_estado es usuario-específico: siempre fresco
      supabase.from('actividades_estado').select('actividad_id').eq('usuario_id', usuario.id).eq('completada', true),
    ])

    // Guardar en caché si vinieron de red (no de caché previa)
    if (cachedEvento === null && evento.data) cacheSet(CACHE_EVENTO, evento.data)
    if (cachedActs   === null && acts.data)   cacheSet(CACHE_ACTS,   acts.data)

    // Si el componente se desmontó mientras las queries estaban en vuelo, no actualizar estado
    if (!mountedRef.current) return

    if (evento.data?.[0]) setProximoEvento(evento.data[0])
    else setProximoEvento(null)

    if (acts.data) {
      const doneIds = new Set((estados.data ?? []).map((e: { actividad_id: string }) => e.actividad_id))
      const pendientes = acts.data.filter((a: Actividad) => !doneIds.has(a.id))
      setActividadesPendientes(pendientes.length)
      setProximaActividad(pendientes[0] ?? null)
    }
  }, [usuario])

  useEffect(() => {
    cargarDatos().finally(() => setLoading(false))
  }, [cargarDatos])

  async function handleRefresh() {
    setRefreshing(true)
    await cargarDatos(true)
    setRefreshing(false)
  }

  if (loading || authLoading) return <HomeSkeleton />

  const initial = (usuario?.nombre?.[0] ?? 'U').toUpperCase()
  const { texto: saludo, emoji } = saludoEmoji()
  const esAdmin = usuario?.rol === 'admin'
  const quickActions = esAdmin ? [...QUICK_ACTIONS, ADMIN_ACTION] : QUICK_ACTIONS

  return (
    <div className="animate-fade-in h-full overflow-y-auto">

      <div className="max-w-[1100px] mx-auto px-4 md:px-6 pt-6 pb-6 flex flex-col gap-6">

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-1">
            {/* Saludo + badge de rol */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="text-sm leading-none">{emoji}</span>
                <span className="text-sm font-medium tracking-widest uppercase text-gray-500">
                  {saludo}
                </span>
              </div>
              <span className="w-1 h-1 rounded-full bg-white/[0.12] inline-block" />
              {esAdmin ? (
                <span className="inline-flex items-center gap-1 text-2xs font-bold px-2.5 py-1 rounded-full bg-rose-500/12 text-rose-300 border border-rose-500/20 shadow-[0_0_10px_rgba(244,63,94,0.18)] tracking-wide">
                  <Shield size={10} />
                  ADMIN
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-2xs font-bold px-2.5 py-1 rounded-full bg-primary/10 text-primary-light border border-primary/20 tracking-wide">
                  <GraduationCap size={10} />
                  ALUMNO
                </span>
              )}
            </div>

            <h1 className="font-extrabold text-3xl md:text-4xl tracking-tight mt-1 bg-gradient-to-br from-slate-100 via-slate-100 to-primary-light bg-clip-text text-transparent">
              {usuario?.nombre ?? 'Estudiante'}
            </h1>

            <div className="flex items-center gap-2 mt-1.5">
              <div className="w-8 h-0.5 bg-gradient-to-r from-primary to-primary-light rounded-full" />
              <div className="w-1.5 h-1.5 bg-primary rounded-full opacity-50" />
            </div>

            <p className="text-xs mt-1.5 capitalize flex items-center gap-1.5 text-gray-600">
              <span className="inline-block w-1 h-1 rounded-full bg-primary/50" />
              {fechaFormateada()}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-150 hover:bg-white/5 border border-white/[0.08] text-gray-400"
              aria-label="Actualizar"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            </button>

            <button
              onClick={() => navigate('/profile')}
              className="relative w-10 h-10 overflow-hidden rounded-xl transition-all duration-150 hover:ring-2 hover:ring-primary/50 border-[1.5px] border-primary/30"
            >
              {usuario?.avatar_url ? (
                <img src={usuario.avatar_url} alt="" className="w-10 h-10 object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-primary/15">
                  <span className="font-bold text-sm text-primary-light">{initial}</span>
                </div>
              )}
            </button>
          </div>
        </div>

        {/* ── Horario de hoy ──────────────────────────────────────────────── */}
        {(() => {
          const ahora = new Date()
          const diaSemana = ahora.getDay() // 0=Dom, 1=Lun ... 6=Sáb
          const esFinDeSemana = diaSemana === 0 || diaSemana === 6
          const diaClases = esFinDeSemana ? 1 : diaSemana
          const clases = HORARIO[diaClases] ?? []
          const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes()
          const diasSemana = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

          return (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  {esFinDeSemana ? 'Próximo lunes' : `Horario — ${diasSemana[diaSemana]}`}
                </h2>
                <span className="text-xs text-gray-600">
                  {clases.length} clases
                </span>
              </div>
              <div className="rounded-2xl overflow-hidden bg-gradient-card border border-overlay-6">
                {clases.map((clase, idx) => {
                  const iniciMin = enMinutos(clase.inicio)
                  const finMin   = enMinutos(clase.fin)
                  const esCurso  = !esFinDeSemana && minutosAhora >= iniciMin && minutosAhora < finMin
                  const haPasado = !esFinDeSemana && minutosAhora >= finMin
                  const color    = materiaColor(clase.materia)
                  // Detectar descanso entre esta clase y la anterior
                  const hayDescanso = idx > 0 && iniciMin - enMinutos(clases[idx - 1].fin) > 5

                  return (
                    <div key={idx}>
                      {hayDescanso && (
                        <div className="flex items-center gap-2 px-4 py-1.5 border-y border-overlay-4">
                          <div className="flex-1 h-px bg-overlay-4" />
                          <span className="text-2xs font-medium text-gray-500">Descanso</span>
                          <div className="flex-1 h-px bg-overlay-4" />
                        </div>
                      )}
                      <div
                        className={cn(
                          "relative flex items-center gap-3 px-4 py-3 transition-all duration-200",
                          idx > 0 && !hayDescanso && "border-t border-overlay-4",
                          haPasado && "opacity-[0.32]"
                        )}
                        style={esCurso ? { '--materia-color': color } as React.CSSProperties : undefined}
                      >
                        {/* Borde izquierdo de color de materia — solo en clase activa */}
                        {esCurso && (
                          <div
                            className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-gradient-to-b from-[var(--materia-color)] to-[var(--materia-color)]/50 shadow-[0_0_8px_var(--materia-color)]"
                          />
                        )}

                        {/* Bloque de hora: inicio + fin apilados */}
                        <div className="shrink-0 flex flex-col items-end w-[46px]">
                          <span
                            className={cn(
                              "text-xs font-mono font-semibold leading-tight",
                              esCurso ? "text-slate-100" : "text-gray-500"
                            )}
                          >
                            {clase.inicio}
                          </span>
                          <span
                            className={cn(
                              "text-2xs font-mono leading-tight",
                              esCurso ? "text-[var(--materia-color)]/60" : "text-gray-700"
                            )}
                          >
                            {clase.fin}
                          </span>
                        </div>

                        {/* Indicador de color puntual */}
                        <div className="shrink-0 flex flex-col items-center gap-0.5">
                          <div
                            className={cn(
                              "rounded-full transition-all duration-200",
                              esCurso ? "w-[9px] h-[9px]" : "w-1.5 h-1.5",
                              haPasado ? "bg-gray-600" : "bg-[var(--materia-color)]",
                              esCurso && "shadow-[0_0_8px_var(--materia-color)]"
                            )}
                          />
                          {esCurso && (
                            <div className="animate-pulse rounded-full w-[3px] h-[3px] bg-[var(--materia-color)] opacity-50" />
                          )}
                        </div>

                        {/* Nombre de la materia */}
                        <div className="flex-1 min-w-0">
                          <span
                            className={cn(
                              "text-sm truncate block",
                              esCurso && "text-slate-100 font-bold",
                              !esCurso && haPasado && "text-gray-600",
                              !esCurso && !haPasado && "text-slate-400"
                            )}
                          >
                            {clase.materia}
                          </span>
                          {esCurso && (
                            <span className="text-2xs font-semibold text-[var(--materia-color)] opacity-80">
                              En curso
                            </span>
                          )}
                        </div>

                        {/* Badge código */}
                        <span
                          className={cn(
                            "shrink-0 text-xs font-bold px-2 py-0.5 rounded-lg border",
                            esCurso
                              ? "bg-[var(--materia-color)]/10 text-[var(--materia-color)] border-[var(--materia-color)]/20 shadow-[0_0_6px_var(--materia-color)]/10"
                              : "bg-overlay-4 text-gray-600 border-overlay-5"
                          )}
                        >
                          {clase.codigo}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {/* ── Quick access ───────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Acceso rápido
            </h2>
            <div className="h-px flex-1 mx-3 bg-gradient-to-r from-primary/15 to-transparent" />
          </div>
          <div className={cn("grid gap-3 grid-cols-3", esAdmin ? "sm:grid-cols-6" : "sm:grid-cols-5")}>
            {quickActions.map(({ label, desc, Icon, to, color }, index) => {
              const badge = to === '/actividades' && actividadesPendientes > 0
                ? (actividadesPendientes > 9 ? '9+' : String(actividadesPendientes))
                : null
              return (
              <button
                key={to}
                onClick={() => navigate(to)}
                className={cn(
                  "group relative flex flex-col items-center gap-2 rounded-2xl transition-all duration-200 active:scale-[0.96] text-center overflow-hidden animate-fade-in",
                  "py-[18px] px-3 pb-3.5",
                  "bg-gradient-to-br from-surface to-input border border-overlay-7 shadow-card",
                  "hover:-translate-y-1 hover:scale-[1.02] hover:shadow-elevated"
                )}
                style={{ '--action-color': color, animationDelay: `${index * 60}ms` } as React.CSSProperties}
              >
                {/* Shimmer de fondo al hover — línea diagonal sutil */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none bg-gradient-to-br from-[var(--action-color)]/[0.04] to-transparent" />

                {/* Badge de notificación */}
                {badge && (
                  <div className="absolute top-2.5 right-2.5 min-w-5 h-5 flex items-center justify-center rounded-full text-2xs font-bold px-1 bg-gradient-to-br from-rose-400 to-rose-600 text-white shadow-[0_2px_8px_rgba(244,63,94,0.5)]">
                    {badge}
                  </div>
                )}

                {/* Icono con fondo glassmorphism */}
                <div className="relative w-14 h-14 flex items-center justify-center rounded-2xl transition-all duration-200 group-hover:scale-110 group-hover:rotate-[-4deg] bg-gradient-to-br from-[var(--action-color)]/10 to-[var(--action-color)]/[0.03] border border-[var(--action-color)]/20 shadow-[0_4px_16px_var(--action-color)]/20">
                  <Icon size={24} className="text-[var(--action-color)]" />
                </div>

                <div className="flex flex-col items-center gap-0.5 mt-0.5">
                  <span className="text-sm font-bold leading-tight text-slate-200">{label}</span>
                  <span className="text-2xs font-medium text-gray-500">{desc}</span>
                </div>

                {/* Flecha inferior derecha al hover */}
                <ArrowUpRight
                  size={11}
                  className="absolute bottom-2.5 right-2.5 opacity-0 group-hover:opacity-50 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 text-[var(--action-color)]"
                />
              </button>
              )
            })}
          </div>
        </div>

        {/* ── Próxima actividad + Próximo evento ──────────────────────────── */}
        {(proximaActividad || proximoEvento) && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider shrink-0 text-gray-500">
                Próximamente
              </h2>
              <div className="h-px flex-1 bg-gradient-to-r from-primary/15 to-transparent" />
            </div>
            <div className="flex flex-col gap-2.5">

              {/* Próxima actividad pendiente */}
              {proximaActividad && (() => {
                const diff = new Date(proximaActividad.fecha_entrega).getTime() - Date.now()
                const dias = diff / 86400000
                const urgColor = dias < 1 ? '#f43f5e' : dias < 3 ? '#f59e0b' : '#34d399'
                const urgBorder= dias < 1 ? 'rgba(244,63,94,0.2)'  : dias < 3 ? 'rgba(245,158,11,0.2)'  : 'rgba(16,185,129,0.2)'
                const label = diff < 0 ? 'Vence hoy' : dias < 1
                  ? `${Math.floor(diff / 3600000)}h restantes`
                  : dias < 2 ? 'Mañana'
                  : `En ${Math.floor(dias)} días`
                const fechaEvento = new Date(proximaActividad.fecha_entrega)
                return (
                  <button
                    onClick={() => navigate('/actividades')}
                    className="group w-full text-left rounded-2xl flex items-stretch gap-0 transition-all duration-200 overflow-hidden bg-gradient-to-br from-surface to-input border shadow-card hover:-translate-y-0.5 hover:shadow-card-hover"
                    style={{ borderColor: urgBorder, '--urg-color': urgColor } as React.CSSProperties}
                  >
                    {/* Badge de fecha — columna izquierda */}
                    <div className="shrink-0 flex flex-col items-center justify-center px-4 py-4 gap-0.5 bg-gradient-to-b from-[var(--urg-color)]/10 to-[var(--urg-color)]/5 border-r border-[var(--urg-color)]/20 min-w-[58px]">
                      <span className="text-xs font-black leading-none uppercase text-[var(--urg-color)]">
                        {fechaEvento.toLocaleDateString('es', { month: 'short' })}
                      </span>
                      <span className="text-2xl font-black leading-none text-[var(--urg-color)]">
                        {fechaEvento.getDate()}
                      </span>
                    </div>

                    {/* Contenido principal */}
                    <div className="flex-1 min-w-0 flex items-center gap-3 px-4 py-3.5">
                      <div className="w-9 h-9 shrink-0 flex items-center justify-center rounded-xl bg-[var(--urg-color)]/10 border border-[var(--urg-color)]/20">
                        <ClipboardCheck size={16} className="text-[var(--urg-color)]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <span className="text-2xs font-bold px-2 py-0.5 rounded-full bg-[var(--urg-color)]/10 text-[var(--urg-color)] border border-[var(--urg-color)]/20">
                            {label}
                          </span>
                          {proximaActividad.materia && (
                            <span className="text-2xs font-medium text-gray-500">
                              {proximaActividad.materia}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-semibold truncate text-text-primary">
                          {proximaActividad.titulo}
                        </p>
                        <p className="text-xs mt-0.5 flex items-center gap-1 text-gray-500">
                          <Clock size={9} />
                          {fechaEvento.toLocaleDateString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <ChevronRight size={15} className="shrink-0 opacity-30 group-hover:opacity-60 transition-opacity text-[var(--urg-color)]" />
                    </div>
                  </button>
                )
              })()}

              {/* Próximo evento */}
              {proximoEvento && (() => {
                const fechaEvt = new Date(proximoEvento.fecha + 'T00:00:00')
                const diffDias = Math.ceil((fechaEvt.getTime() - Date.now()) / 86400000)
                const evtLabel = diffDias <= 0 ? 'Hoy' : diffDias === 1 ? 'Mañana' : `En ${diffDias} días`
                return (
                  <button
                    onClick={() => navigate('/calendar')}
                    className="group w-full text-left rounded-2xl flex items-stretch gap-0 transition-all duration-200 overflow-hidden bg-gradient-to-br from-amber-500/5 to-transparent bg-surface border border-amber-500/20 shadow-card hover:-translate-y-0.5 hover:shadow-card-hover"
                  >
                    {/* Badge de fecha — columna izquierda */}
                    <div className="shrink-0 flex flex-col items-center justify-center px-4 py-4 gap-0.5 bg-gradient-to-b from-amber-500/15 to-amber-500/5 border-r border-amber-500/20 min-w-[58px]">
                      <span className="text-xs font-black leading-none uppercase text-amber-300">
                        {fechaEvt.toLocaleDateString('es', { month: 'short' })}
                      </span>
                      <span className="text-2xl font-black leading-none text-amber-300">
                        {fechaEvt.getDate()}
                      </span>
                    </div>

                    {/* Contenido principal */}
                    <div className="flex-1 min-w-0 flex items-center gap-3 px-4 py-3.5">
                      <div className="w-9 h-9 shrink-0 flex items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20">
                        <Calendar size={16} className="text-amber-300" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-2xs font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                            {evtLabel}
                          </span>
                          <span className="text-2xs font-semibold uppercase tracking-wider text-gray-500">
                            Evento
                          </span>
                        </div>
                        <p className="text-sm font-semibold truncate text-text-primary">{proximoEvento.titulo}</p>
                        <p className="text-xs mt-0.5 capitalize text-gray-500">
                          {fechaEvt.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </p>
                      </div>
                      <ChevronRight size={15} className="shrink-0 opacity-30 group-hover:opacity-60 transition-opacity text-amber-300" />
                    </div>
                  </button>
                )
              })()}
            </div>
          </div>
        )}

        <div className="pt-4 pb-2 flex items-center justify-center">
          <span className="text-gray-800 text-[11px] font-medium">
            TopCode © 2026
          </span>
        </div>

      </div>
    </div>
  )
}
