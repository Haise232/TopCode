import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Calendar, MessageCircle,
  FolderOpen, RefreshCw, ChevronRight, ArrowUpRight,
  GraduationCap, Shield, Camera, X, ClipboardCheck, Clock, Newspaper,
} from 'lucide-react'
import { supabase, eliminarArchivoStorage } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { EventoCalendario, Actividad } from '../lib/types'
import { SkeletonBox, SkeletonCard, SkeletonSchedule, SkeletonQuickActions } from '../components/Skeleton'
import { cacheGet, cacheSet, cacheInvalidatePrefix } from '../lib/cache'

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
      <div
        className="px-4 md:px-6 py-8"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
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
    color: '#818cf8',
    bg: 'rgba(99,102,241,0.1)',
    border: 'rgba(99,102,241,0.25)',
    glow: 'rgba(99,102,241,0.2)',
    gradFrom: 'rgba(99,102,241,0.06)',
    gradTo: 'rgba(99,102,241,0.02)',
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
    color: '#c084fc',
    bg: 'rgba(139,92,246,0.1)',
    border: 'rgba(139,92,246,0.25)',
    glow: 'rgba(139,92,246,0.2)',
    gradFrom: 'rgba(139,92,246,0.06)',
    gradTo: 'rgba(139,92,246,0.02)',
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
  const { usuario, refreshUsuario } = useAuth()
  const navigate = useNavigate()
  const [proximoEvento, setProximoEvento] = useState<EventoCalendario | null>(null)
  const [proximaActividad, setProximaActividad] = useState<Actividad | null>(null)
  const [actividadesPendientes, setActividadesPendientes] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [bannerUrl, setBannerUrl] = useState<string | null>(null)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const bannerInputRef = useRef<HTMLInputElement>(null)
  // Guardia de montado: evita actualizaciones de estado tras desmontar el componente
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  // Sincronizar con el perfil cuando carga el usuario
  useEffect(() => {
    setBannerUrl(usuario?.banner_url ?? null)
  }, [usuario?.banner_url])

  async function handleBannerChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !usuario) return
    e.target.value = ''
    setUploadingBanner(true)
    try {
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `banner_${usuario.id}.${ext}`

      const { data: storageData, error: storageError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { contentType: file.type, upsert: true })

      if (storageError) return

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(storageData.path)

      const { error: dbError } = await supabase
        .from('usuarios')
        .update({ banner_url: publicUrl })
        .eq('id', usuario.id)

      if (dbError) return

      setBannerUrl(publicUrl)
      refreshUsuario()
    } finally {
      setUploadingBanner(false)
    }
  }

  async function handleBannerRemove() {
    if (!usuario || !bannerUrl) return
    // Extraer la ruta real del storage desde la URL pública
    try {
      const storagePath = new URL(bannerUrl).pathname.split('/object/public/avatars/')[1]
      if (storagePath) await eliminarArchivoStorage('avatars', decodeURIComponent(storagePath))
    } catch { /* si falla el borrado del archivo, seguimos igual */ }
    await supabase.from('usuarios').update({ banner_url: null }).eq('id', usuario.id)
    setBannerUrl(null)
    refreshUsuario()
  }

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
    if (!usuario) return // esperar a que AuthContext cargue el perfil
    cargarDatos().finally(() => setLoading(false))
  }, [cargarDatos, usuario])

  async function handleRefresh() {
    setRefreshing(true)
    await cargarDatos(true)
    setRefreshing(false)
  }

  if (loading) return <HomeSkeleton />

  const initial = (usuario?.nombre?.[0] ?? 'U').toUpperCase()
  const { texto: saludo, emoji } = saludoEmoji()
  const esAdmin = usuario?.rol === 'admin'
  const quickActions = esAdmin ? [...QUICK_ACTIONS, ADMIN_ACTION] : QUICK_ACTIONS

  return (
    <div className="animate-fade-in h-full overflow-y-auto">

      {/* ── Hero header ───────────────────────────────────────────────────── */}
      <div
        className="group relative px-4 md:px-6 py-8 overflow-hidden"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        {/* Fondo: banner de usuario o gradiente por defecto */}
        {bannerUrl ? (
          <>
            <img
              src={bannerUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            />
            {/* Overlay oscuro para legibilidad */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: 'linear-gradient(135deg, rgba(15,17,23,0.72) 0%, rgba(15,17,23,0.55) 100%)' }}
            />
          </>
        ) : (
          <>
            <div
              className="absolute inset-0 pointer-events-none animate-gradient-shift"
              style={{
                background: 'linear-gradient(135deg, rgba(99,102,241,0.07) 0%, rgba(20,184,166,0.05) 50%, rgba(139,92,246,0.06) 100%)',
                backgroundSize: '200% 200%',
              }}
            />
            <div
              className="absolute -top-8 -right-8 w-48 h-48 rounded-full pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(20,184,166,0.12) 0%, transparent 70%)', filter: 'blur(24px)' }}
            />
            <div
              className="absolute -bottom-6 -left-6 w-40 h-40 rounded-full pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)', filter: 'blur(20px)' }}
            />
          </>
        )}

        {/* Botones de banner — visibles al hacer hover sobre el hero */}
        <div className="absolute top-3 left-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
          <button
            onClick={() => !uploadingBanner && bannerInputRef.current?.click()}
            disabled={uploadingBanner}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold backdrop-blur-sm transition-all duration-150 hover:scale-105"
            style={{ background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.12)', color: '#f1f5f9', opacity: uploadingBanner ? 0.6 : 1 }}
            title="Cambiar banner"
          >
            {uploadingBanner
              ? <div className="w-3 h-3 rounded-full animate-spin" style={{ border: '1.5px solid rgba(255,255,255,0.3)', borderTopColor: 'white' }} />
              : <Camera size={12} />
            }
            {bannerUrl ? 'Cambiar' : 'Añadir banner'}
          </button>
          {bannerUrl && (
            <button
              onClick={handleBannerRemove}
              className="w-7 h-7 flex items-center justify-center rounded-lg backdrop-blur-sm transition-all duration-150 hover:scale-105"
              style={{ background: 'rgba(244,63,94,0.3)', border: '1px solid rgba(244,63,94,0.4)', color: '#fda4af' }}
              title="Quitar banner"
            >
              <X size={12} />
            </button>
          )}
        </div>
        <input
          ref={bannerInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleBannerChange}
        />

        <div className="max-w-[1100px] mx-auto flex justify-between items-start relative">
          <div className="flex flex-col gap-1">
            {/* Saludo + badge de rol en la misma línea */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="text-sm leading-none">{emoji}</span>
                <span
                  className="text-sm font-medium tracking-wide uppercase"
                  style={{ color: '#4b5563', letterSpacing: '0.06em' }}
                >
                  {saludo}
                </span>
              </div>
              {/* Separador puntual */}
              <span className="w-1 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.12)', display: 'inline-block' }} />
              {esAdmin ? (
                <span
                  className="inline-flex items-center gap-1 text-2xs font-bold px-2.5 py-1 rounded-full"
                  style={{
                    background: 'rgba(244,63,94,0.12)',
                    color: '#fb7185',
                    border: '1px solid rgba(244,63,94,0.22)',
                    boxShadow: '0 0 10px rgba(244,63,94,0.18)',
                    letterSpacing: '0.04em',
                  }}
                >
                  <Shield size={10} />
                  ADMIN
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-1 text-2xs font-bold px-2.5 py-1 rounded-full"
                  style={{
                    background: 'rgba(99,102,241,0.1)',
                    color: '#818cf8',
                    border: '1px solid rgba(99,102,241,0.18)',
                    letterSpacing: '0.04em',
                  }}
                >
                  <GraduationCap size={10} />
                  ALUMNO
                </span>
              )}
            </div>

            <h1
              className="font-extrabold text-3xl md:text-4xl tracking-tight mt-1"
              style={{
                background: 'linear-gradient(135deg, #f1f5f9 30%, #818cf8 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {usuario?.nombre ?? 'Estudiante'}
            </h1>

            {/* Separador decorativo con gradiente de color primario */}
            <div className="flex items-center gap-2 mt-1.5">
              <div
                style={{
                  width: 32,
                  height: 2,
                  background: 'linear-gradient(90deg, #6366f1, #818cf8)',
                  borderRadius: 9999,
                }}
              />
              <div
                style={{
                  width: 6,
                  height: 6,
                  background: '#6366f1',
                  borderRadius: 9999,
                  opacity: 0.5,
                }}
              />
            </div>

            {/* Fecha con icono sutil */}
            <p
              className="text-xs mt-1.5 capitalize flex items-center gap-1.5"
              style={{ color: '#374151' }}
            >
              <span
                className="inline-block w-1 h-1 rounded-full"
                style={{ background: 'rgba(99,102,241,0.5)' }}
              />
              {fechaFormateada()}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-150 hover:bg-white/5"
              style={{ border: '1px solid rgba(255,255,255,0.08)', color: '#64748b' }}
              aria-label="Actualizar"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            </button>

            <button
              onClick={() => navigate('/profile')}
              className="relative w-10 h-10 overflow-hidden rounded-xl transition-all duration-150 hover:ring-2 hover:ring-primary/50"
              style={{ border: '1.5px solid rgba(99,102,241,0.3)' }}
            >
              {usuario?.avatar_url ? (
                <img src={usuario.avatar_url} alt="" className="w-10 h-10 object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.15)' }}>
                  <span className="font-bold text-sm" style={{ color: '#818cf8' }}>{initial}</span>
                </div>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1100px] mx-auto p-4 md:p-6 flex flex-col gap-6">

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
                <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#4b5563' }}>
                  {esFinDeSemana ? 'Próximo lunes' : `Horario — ${diasSemana[diaSemana]}`}
                </h2>
                <span className="text-xs" style={{ color: '#374151' }}>
                  {clases.length} clases
                </span>
              </div>
              <div
                className="rounded-2xl overflow-hidden"
                style={{
                  background: 'linear-gradient(145deg, #1a1d27, #141720)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
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
                        <div
                          className="flex items-center gap-2 px-4 py-1.5"
                          style={{ borderTop: '1px solid rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                        >
                          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.04)' }} />
                          <span className="text-2xs font-medium" style={{ color: '#4b5563' }}>Descanso</span>
                          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.04)' }} />
                        </div>
                      )}
                      <div
                        className="relative flex items-center gap-3 px-4 py-3 transition-all duration-200"
                        style={{
                          borderTop: idx > 0 && !hayDescanso ? '1px solid rgba(255,255,255,0.04)' : undefined,
                          background: esCurso
                            ? `linear-gradient(90deg, ${color}12 0%, ${color}04 60%, transparent 100%)`
                            : 'transparent',
                          opacity: haPasado ? 0.32 : 1,
                        }}
                      >
                        {/* Borde izquierdo de color de materia — solo en clase activa */}
                        {esCurso && (
                          <div
                            className="absolute left-0 top-1.5 bottom-1.5 rounded-r-full"
                            style={{
                              width: 3,
                              background: `linear-gradient(180deg, ${color}, ${color}77)`,
                              boxShadow: `0 0 8px ${color}88`,
                            }}
                          />
                        )}

                        {/* Bloque de hora: inicio + fin apilados */}
                        <div className="shrink-0 flex flex-col items-end" style={{ width: '46px' }}>
                          <span
                            className="text-xs font-mono font-semibold leading-tight"
                            style={{ color: esCurso ? '#f1f5f9' : '#4b5563' }}
                          >
                            {clase.inicio}
                          </span>
                          <span
                            className="text-2xs font-mono leading-tight"
                            style={{ color: esCurso ? `${color}99` : '#2d3748' }}
                          >
                            {clase.fin}
                          </span>
                        </div>

                        {/* Indicador de color puntual */}
                        <div className="shrink-0 flex flex-col items-center gap-0.5">
                          <div
                            className="rounded-full transition-all duration-200"
                            style={{
                              width: esCurso ? 9 : 6,
                              height: esCurso ? 9 : 6,
                              background: haPasado ? '#374151' : color,
                              boxShadow: esCurso ? `0 0 8px ${color}, 0 0 16px ${color}44` : 'none',
                            }}
                          />
                          {esCurso && (
                            <div
                              className="animate-pulse rounded-full"
                              style={{ width: 3, height: 3, background: color, opacity: 0.5 }}
                            />
                          )}
                        </div>

                        {/* Nombre de la materia */}
                        <div className="flex-1 min-w-0">
                          <span
                            className="text-sm truncate block"
                            style={{
                              color: esCurso ? '#f1f5f9' : haPasado ? '#374151' : '#94a3b8',
                              fontWeight: esCurso ? 700 : 400,
                            }}
                          >
                            {clase.materia}
                          </span>
                          {esCurso && (
                            <span
                              className="text-2xs font-semibold"
                              style={{ color, opacity: 0.8 }}
                            >
                              En curso
                            </span>
                          )}
                        </div>

                        {/* Badge código */}
                        <span
                          className="shrink-0 text-xs font-bold px-2 py-0.5 rounded-lg"
                          style={{
                            background: esCurso ? `${color}20` : 'rgba(255,255,255,0.04)',
                            color: esCurso ? color : '#374151',
                            border: `1px solid ${esCurso ? `${color}40` : 'rgba(255,255,255,0.05)'}`,
                            boxShadow: esCurso ? `0 0 6px ${color}30` : 'none',
                          }}
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
            <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#4b5563' }}>
              Acceso rápido
            </h2>
            <div className="h-px flex-1 mx-3" style={{ background: 'linear-gradient(90deg, rgba(99,102,241,0.15), transparent)' }} />
          </div>
          <div className={`grid gap-3 grid-cols-3 ${esAdmin ? 'sm:grid-cols-6' : 'sm:grid-cols-5'}`}>
            {quickActions.map(({ label, desc, Icon, to, color, border, glow, gradFrom, gradTo }, index) => {
              const badge = to === '/actividades' && actividadesPendientes > 0
                ? (actividadesPendientes > 9 ? '9+' : String(actividadesPendientes))
                : null
              return (
              <button
                key={to}
                onClick={() => navigate(to)}
                className="group relative flex flex-col items-center gap-2 rounded-2xl transition-all duration-200 active:scale-[0.96] text-center overflow-hidden animate-fade-in"
                style={{
                  animationDelay: `${index * 60}ms`,
                  padding: '18px 12px 14px',
                  background: `linear-gradient(160deg, ${gradFrom} 0%, ${gradTo} 50%, rgba(20,23,32,0.0) 100%), linear-gradient(145deg, #1c1f2e, #141720)`,
                  border: `1px solid rgba(255,255,255,0.07)`,
                  boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.transform = 'translateY(-4px) scale(1.02)'
                  el.style.borderColor = border
                  el.style.boxShadow = `0 16px 32px rgba(0,0,0,0.45), 0 0 0 1px ${border}, 0 0 24px ${glow}`
                  el.style.background = `linear-gradient(160deg, ${gradFrom} 0%, ${gradTo} 60%, rgba(20,23,32,0.0) 100%), linear-gradient(145deg, #1c1f2e, #141720)`
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.transform = 'translateY(0) scale(1)'
                  el.style.borderColor = 'rgba(255,255,255,0.07)'
                  el.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)'
                }}
              >
                {/* Shimmer de fondo al hover — línea diagonal sutil */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                  style={{
                    background: `linear-gradient(135deg, ${color}06 0%, transparent 50%)`,
                  }}
                />

                {/* Badge de notificación */}
                {badge && (
                  <div
                    className="absolute top-2.5 right-2.5 min-w-[20px] h-5 flex items-center justify-center rounded-full text-2xs font-bold px-1"
                    style={{
                      background: 'linear-gradient(135deg, #f43f5e, #e11d48)',
                      color: '#fff',
                      boxShadow: '0 2px 8px rgba(244,63,94,0.5)',
                    }}
                  >
                    {badge}
                  </div>
                )}

                {/* Icono con fondo glassmorphism */}
                <div
                  className="relative w-14 h-14 flex items-center justify-center rounded-2xl transition-all duration-200 group-hover:scale-110 group-hover:rotate-[-4deg]"
                  style={{
                    background: `linear-gradient(135deg, ${color}1a, ${color}08)`,
                    border: `1px solid ${border}`,
                    boxShadow: `0 4px 16px ${glow}, inset 0 1px 0 rgba(255,255,255,0.08)`,
                  }}
                >
                  <Icon size={24} style={{ color }} />
                </div>

                <div className="flex flex-col items-center gap-0.5 mt-0.5">
                  <span className="text-sm font-bold leading-tight" style={{ color: '#e2e8f0' }}>{label}</span>
                  <span className="text-2xs font-medium" style={{ color: '#4b5563' }}>{desc}</span>
                </div>

                {/* Flecha inferior derecha al hover */}
                <ArrowUpRight
                  size={11}
                  className="absolute bottom-2.5 right-2.5 opacity-0 group-hover:opacity-50 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  style={{ color }}
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
              <h2 className="text-xs font-semibold uppercase tracking-wider shrink-0" style={{ color: '#4b5563' }}>
                Próximamente
              </h2>
              <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, rgba(99,102,241,0.15), transparent)' }} />
            </div>
            <div className="flex flex-col gap-2.5">

              {/* Próxima actividad pendiente */}
              {proximaActividad && (() => {
                const diff = new Date(proximaActividad.fecha_entrega).getTime() - Date.now()
                const dias = diff / 86400000
                const urgColor = dias < 1 ? '#f43f5e' : dias < 3 ? '#f59e0b' : '#34d399'
                const urgBg    = dias < 1 ? 'rgba(244,63,94,0.08)' : dias < 3 ? 'rgba(245,158,11,0.08)' : 'rgba(16,185,129,0.08)'
                const urgBorder= dias < 1 ? 'rgba(244,63,94,0.2)'  : dias < 3 ? 'rgba(245,158,11,0.2)'  : 'rgba(16,185,129,0.2)'
                const label = diff < 0 ? 'Vence hoy' : dias < 1
                  ? `${Math.floor(diff / 3600000)}h restantes`
                  : dias < 2 ? 'Mañana'
                  : `En ${Math.floor(dias)} días`
                const fechaEvento = new Date(proximaActividad.fecha_entrega)
                return (
                  <button
                    onClick={() => navigate('/actividades')}
                    className="group w-full text-left rounded-2xl flex items-stretch gap-0 transition-all duration-200 overflow-hidden"
                    style={{
                      background: `linear-gradient(135deg, ${urgBg}, rgba(20,23,32,0.0) 70%), linear-gradient(145deg, #1c1f2e, #141720)`,
                      border: `1px solid ${urgBorder}`,
                      boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
                    }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLElement
                      el.style.transform = 'translateY(-2px)'
                      el.style.boxShadow = `0 10px 24px rgba(0,0,0,0.4), 0 0 16px ${urgColor}18`
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLElement
                      el.style.transform = 'translateY(0)'
                      el.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)'
                    }}
                  >
                    {/* Badge de fecha — columna izquierda */}
                    <div
                      className="shrink-0 flex flex-col items-center justify-center px-4 py-4 gap-0.5"
                      style={{
                        background: `linear-gradient(180deg, ${urgColor}18, ${urgColor}08)`,
                        borderRight: `1px solid ${urgBorder}`,
                        minWidth: '58px',
                      }}
                    >
                      <span className="text-xs font-black leading-none uppercase" style={{ color: urgColor }}>
                        {fechaEvento.toLocaleDateString('es', { month: 'short' })}
                      </span>
                      <span className="text-2xl font-black leading-none" style={{ color: urgColor }}>
                        {fechaEvento.getDate()}
                      </span>
                    </div>

                    {/* Contenido principal */}
                    <div className="flex-1 min-w-0 flex items-center gap-3 px-4 py-3.5">
                      <div className="w-9 h-9 shrink-0 flex items-center justify-center rounded-xl" style={{ background: urgBg, border: `1px solid ${urgBorder}` }}>
                        <ClipboardCheck size={16} style={{ color: urgColor }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <span
                            className="text-2xs font-bold px-2 py-0.5 rounded-full"
                            style={{ background: `${urgColor}18`, color: urgColor, border: `1px solid ${urgColor}28` }}
                          >
                            {label}
                          </span>
                          {proximaActividad.materia && (
                            <span className="text-2xs font-medium" style={{ color: '#4b5563' }}>
                              {proximaActividad.materia}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-semibold truncate" style={{ color: '#f1f5f9' }}>
                          {proximaActividad.titulo}
                        </p>
                        <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: '#4b5563' }}>
                          <Clock size={9} />
                          {fechaEvento.toLocaleDateString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <ChevronRight size={15} className="shrink-0 opacity-30 group-hover:opacity-60 transition-opacity" style={{ color: urgColor }} />
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
                    className="group w-full text-left rounded-2xl flex items-stretch gap-0 transition-all duration-200 overflow-hidden"
                    style={{
                      background: 'linear-gradient(135deg, rgba(245,158,11,0.07), rgba(20,23,32,0.0) 70%), linear-gradient(145deg, #1c1f2e, #141720)',
                      border: '1px solid rgba(245,158,11,0.2)',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
                    }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLElement
                      el.style.transform = 'translateY(-2px)'
                      el.style.borderColor = 'rgba(245,158,11,0.35)'
                      el.style.boxShadow = '0 10px 24px rgba(0,0,0,0.4), 0 0 16px rgba(245,158,11,0.12)'
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLElement
                      el.style.transform = 'translateY(0)'
                      el.style.borderColor = 'rgba(245,158,11,0.2)'
                      el.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)'
                    }}
                  >
                    {/* Badge de fecha — columna izquierda */}
                    <div
                      className="shrink-0 flex flex-col items-center justify-center px-4 py-4 gap-0.5"
                      style={{
                        background: 'linear-gradient(180deg, rgba(245,158,11,0.18), rgba(245,158,11,0.07))',
                        borderRight: '1px solid rgba(245,158,11,0.2)',
                        minWidth: '58px',
                      }}
                    >
                      <span className="text-xs font-black leading-none uppercase" style={{ color: '#fbbf24' }}>
                        {fechaEvt.toLocaleDateString('es', { month: 'short' })}
                      </span>
                      <span className="text-2xl font-black leading-none" style={{ color: '#fbbf24' }}>
                        {fechaEvt.getDate()}
                      </span>
                    </div>

                    {/* Contenido principal */}
                    <div className="flex-1 min-w-0 flex items-center gap-3 px-4 py-3.5">
                      <div className="w-9 h-9 shrink-0 flex items-center justify-center rounded-xl" style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)' }}>
                        <Calendar size={16} style={{ color: '#fbbf24' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span
                            className="text-2xs font-bold px-2 py-0.5 rounded-full"
                            style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.25)' }}
                          >
                            {evtLabel}
                          </span>
                          <span className="text-2xs font-semibold uppercase tracking-wider" style={{ color: '#4b5563' }}>
                            Evento
                          </span>
                        </div>
                        <p className="text-sm font-semibold truncate" style={{ color: '#f1f5f9' }}>{proximoEvento.titulo}</p>
                        <p className="text-xs mt-0.5 capitalize" style={{ color: '#4b5563' }}>
                          {fechaEvt.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </p>
                      </div>
                      <ChevronRight size={15} className="shrink-0 opacity-30 group-hover:opacity-60 transition-opacity" style={{ color: '#fbbf24' }} />
                    </div>
                  </button>
                )
              })()}
            </div>
          </div>
        )}

        <div className="pt-4 pb-2 flex items-center justify-center">
          <span style={{ color: '#1f2937', fontSize: '11px', fontWeight: 500 }}>
            TopCode © 2026
          </span>
        </div>

      </div>
    </div>
  )
}
