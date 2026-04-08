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
import { SkeletonBox, SkeletonCard } from '../components/Skeleton'

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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => (
            <SkeletonCard key={i} className="flex flex-col items-center gap-3 py-6">
              <SkeletonBox className="h-11 w-11 shimmer rounded-xl" />
              <SkeletonBox className="h-3 w-14 shimmer" />
            </SkeletonCard>
          ))}
        </div>
        {[1, 2, 3].map(i => (
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

  const cargarDatos = useCallback(async () => {
    if (!usuario) return
    const now = new Date().toISOString()
    const [evento, acts, estados] = await Promise.all([
      supabase.from('eventos').select('*').gte('fecha', new Date().toISOString().slice(0, 10)).order('fecha', { ascending: true }).limit(1),
      supabase.from('actividades').select('*').gte('fecha_entrega', now).order('fecha_entrega', { ascending: true }),
      supabase.from('actividades_estado').select('actividad_id').eq('usuario_id', usuario.id).eq('completada', true),
    ])
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
    await cargarDatos()
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
          <div className="flex flex-col gap-1.5">
            {/* Saludo con emoji */}
            <div className="flex items-center gap-2">
              <span className="text-base leading-none">{emoji}</span>
              <span
                className="text-base font-medium"
                style={{ color: '#64748b' }}
              >
                {saludo},
              </span>
              <span
                className="inline-block w-px h-3.5 rounded-full"
                style={{ background: 'rgba(255,255,255,0.1)' }}
              />
            </div>

            <h1
              className="font-extrabold text-3xl md:text-4xl tracking-tight"
              style={{
                background: 'linear-gradient(135deg, #f1f5f9, #94a3b8)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {usuario?.nombre ?? 'Estudiante'}
            </h1>
            {/* Línea decorativa bajo el nombre */}
            <div
              style={{
                width: 40,
                height: 2,
                background: 'linear-gradient(90deg, #6366f1, transparent)',
                borderRadius: 9999,
                marginTop: 6,
              }}
            />

            <p className="text-xs mt-0.5 capitalize" style={{ color: '#4b5563' }}>
              {fechaFormateada()}
            </p>

            {/* Badge de rol */}
            <div className="mt-1.5">
              {esAdmin ? (
                <span
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
                  style={{
                    background: 'rgba(244,63,94,0.1)',
                    color: '#fb7185',
                    border: '1px solid rgba(244,63,94,0.2)',
                    boxShadow: '0 0 12px rgba(244,63,94,0.2)',
                  }}
                >
                  <Shield size={13} />
                  Admin
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full"
                  style={{
                    background: 'rgba(99,102,241,0.08)',
                    color: '#818cf8',
                    border: '1px solid rgba(99,102,241,0.15)',
                  }}
                >
                  <GraduationCap size={13} />
                  Alumno
                </span>
              )}
            </div>
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
                        className="flex items-center gap-3 px-4 py-3 transition-colors duration-150"
                        style={{
                          borderTop: idx > 0 && !hayDescanso ? '1px solid rgba(255,255,255,0.04)' : undefined,
                          background: esCurso ? 'rgba(99,102,241,0.06)' : 'transparent',
                          opacity: haPasado ? 0.35 : 1,
                        }}
                      >
                        {/* Hora */}
                        <div className="shrink-0 text-right" style={{ width: '42px' }}>
                          <span className="text-xs font-mono" style={{ color: esCurso ? '#818cf8' : '#4b5563' }}>
                            {clase.inicio}
                          </span>
                        </div>

                        {/* Indicador de color */}
                        <div className="shrink-0 flex items-center gap-1">
                          <div
                            className="rounded-full"
                            style={{
                              width: esCurso ? 8 : 6,
                              height: esCurso ? 8 : 6,
                              background: esCurso ? color : haPasado ? '#374151' : color,
                              boxShadow: esCurso ? `0 0 6px ${color}` : 'none',
                              transition: 'all 0.2s',
                            }}
                          />
                          {esCurso && (
                            <span
                              className="animate-pulse rounded-full inline-block"
                              style={{ width: 4, height: 4, background: color, opacity: 0.6 }}
                            />
                          )}
                        </div>

                        {/* Nombre */}
                        <span
                          className="flex-1 text-sm truncate"
                          style={{
                            color: esCurso ? '#f1f5f9' : haPasado ? '#4b5563' : '#94a3b8',
                            fontWeight: esCurso ? 600 : 400,
                          }}
                        >
                          {clase.materia}
                        </span>

                        {/* Badge código */}
                        <span
                          className="shrink-0 text-xs font-bold px-2 py-0.5 rounded-lg"
                          style={{
                            background: esCurso ? `${color}22` : 'rgba(255,255,255,0.04)',
                            color: esCurso ? color : '#374151',
                            border: `1px solid ${esCurso ? `${color}33` : 'rgba(255,255,255,0.06)'}`,
                          }}
                        >
                          {clase.codigo}
                        </span>

                        {/* Fin de la clase */}
                        <div className="shrink-0 text-right" style={{ width: '42px' }}>
                          <span className="text-xs font-mono" style={{ color: '#374151' }}>
                            {clase.fin}
                          </span>
                        </div>
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
          <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#4b5563' }}>
            Acceso rápido
          </h2>
          <div className={`grid gap-3 grid-cols-3 ${esAdmin ? 'sm:grid-cols-6' : 'sm:grid-cols-5'}`}>
            {quickActions.map(({ label, desc, Icon, to, color, bg, border, glow, gradFrom, gradTo }, index) => {
              const badge = to === '/actividades' && actividadesPendientes > 0
                ? (actividadesPendientes > 9 ? '9+' : String(actividadesPendientes))
                : null
              return (
              <button
                key={to}
                onClick={() => navigate(to)}
                className="group relative p-4 sm:p-5 flex flex-col items-center gap-2.5 sm:gap-3 rounded-2xl transition-all duration-200 active:scale-[0.97] text-center overflow-hidden animate-fade-in"
                style={{
                  animationDelay: `${index * 60}ms`,
                  background: `linear-gradient(145deg, ${gradFrom}, ${gradTo}), linear-gradient(145deg, #1a1d27, #141720)`,
                  border: `1px solid rgba(255,255,255,0.06)`,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.transform = 'translateY(-3px) scale(1.02)'
                  el.style.borderColor = border
                  el.style.boxShadow = `0 12px 28px rgba(0,0,0,0.4), 0 0 0 1px ${border}, 0 0 20px ${glow}`
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.transform = 'translateY(0) scale(1)'
                  el.style.borderColor = 'rgba(255,255,255,0.06)'
                  el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.25)'
                }}
              >
                {/* Badge de notificación */}
                {badge && (
                  <div
                    className="absolute top-3 right-3 w-5 h-5 flex items-center justify-center rounded-full text-2xs font-bold"
                    style={{
                      background: 'linear-gradient(135deg, #f43f5e, #e11d48)',
                      color: '#fff',
                      boxShadow: '0 2px 6px rgba(244,63,94,0.4)',
                    }}
                  >
                    {badge}
                  </div>
                )}

                <div
                  className="w-16 h-16 flex items-center justify-center rounded-2xl transition-all duration-200 group-hover:scale-110 group-hover:rotate-[-3deg]"
                  style={{
                    background: bg,
                    border: `1px solid ${border}`,
                    boxShadow: `0 4px 12px ${glow}`,
                  }}
                >
                  <Icon size={26} style={{ color }} />
                </div>

                <div>
                  <span className="text-sm font-bold block" style={{ color: '#f1f5f9' }}>{label}</span>
                  <span className="text-xs" style={{ color: '#64748b' }}>{desc}</span>
                </div>

                <ArrowUpRight
                  size={12}
                  className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-60 transition-opacity duration-200"
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
            <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#4b5563' }}>
              Próximamente
            </h2>
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
                return (
                  <button
                    onClick={() => navigate('/actividades')}
                    className="group w-full text-left p-5 rounded-2xl flex items-center gap-4 transition-all duration-200"
                    style={{ background: `${urgBg}, linear-gradient(145deg, #1a1d27, #141720)`, border: `1px solid ${urgBorder}`, boxShadow: '0 2px 8px rgba(0,0,0,0.25)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 20px rgba(0,0,0,0.35), 0 0 12px ${urgColor}18` }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.25)' }}
                  >
                    <div className="w-12 h-12 shrink-0 flex items-center justify-center rounded-xl" style={{ background: urgBg, border: `1px solid ${urgBorder}` }}>
                      <ClipboardCheck size={18} style={{ color: urgColor }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="text-2xs font-semibold uppercase tracking-wider" style={{ color: urgColor }}>
                          Actividad pendiente
                        </span>
                        {proximaActividad.materia && (
                          <span className="text-2xs font-medium px-1.5 py-0.5 rounded-full" style={{ background: `${urgColor}18`, color: urgColor, border: `1px solid ${urgColor}28` }}>
                            {proximaActividad.materia}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold truncate" style={{ color: '#f1f5f9' }}>
                        {proximaActividad.titulo}
                      </p>
                      <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: '#64748b' }}>
                        <Clock size={10} />
                        {label} · {new Date(proximaActividad.fecha_entrega).toLocaleDateString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <ChevronRight size={16} className="shrink-0 opacity-40 group-hover:opacity-70 transition-opacity" style={{ color: urgColor }} />
                  </button>
                )
              })()}

              {/* Próximo evento */}
              {proximoEvento && (
                <button
                  onClick={() => navigate('/calendar')}
                  className="group w-full text-left p-5 rounded-2xl flex items-center gap-4 transition-all duration-200"
                  style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.06) 0%, rgba(20,184,166,0.04) 100%), linear-gradient(145deg, #1a1d27, #141720)', border: '1px solid rgba(245,158,11,0.18)', boxShadow: '0 2px 8px rgba(0,0,0,0.25)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(245,158,11,0.32)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 20px rgba(0,0,0,0.35), 0 0 12px rgba(245,158,11,0.1)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(245,158,11,0.18)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.25)' }}
                >
                  <div className="w-12 h-12 shrink-0 flex items-center justify-center rounded-xl" style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)' }}>
                    <Calendar size={18} style={{ color: '#fbbf24' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-2xs font-semibold uppercase tracking-wider block mb-0.5" style={{ color: '#fbbf24' }}>Próximo evento</span>
                    <p className="text-sm font-semibold truncate" style={{ color: '#f1f5f9' }}>{proximoEvento.titulo}</p>
                    <p className="text-xs mt-0.5 truncate capitalize" style={{ color: '#64748b' }}>
                      {new Date(proximoEvento.fecha + 'T00:00:00').toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </p>
                  </div>
                  <ChevronRight size={16} className="shrink-0 opacity-40 group-hover:opacity-70 transition-opacity" style={{ color: '#fbbf24' }} />
                </button>
              )}
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
