import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  TrendingUp, BookOpen, FileText, Plus, Calendar, MessageCircle,
  FolderOpen, RefreshCw, ChevronRight, ArrowUpRight,
  Flame, GraduationCap, Shield, Zap, Camera, X, ClipboardCheck, Clock,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Nota, EventoCalendario, Actividad } from '../lib/types'
import { MATERIAS } from '../constants/materias'
import { SkeletonBox, SkeletonCard } from '../components/Skeleton'

// ── Helpers ──────────────────────────────────────────────────────────────────

function gradeColor(n: number) {
  if (n >= 8) return '#10b981'
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

// Últimos 7 días: devuelve array de { fecha ISO, label corto, tieneNota }
function semanaActual(notas: Nota[]) {
  const diasCortos = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá']
  const notasDates = new Set(
    notas.map(n => n.created_at.slice(0, 10))
  )
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    const iso = d.toISOString().slice(0, 10)
    return {
      iso,
      label: diasCortos[d.getDay()],
      activo: notasDates.has(iso),
      esHoy: i === 6,
    }
  })
}

// Días únicos con notas en los últimos 7 días = "racha semanal"
function rachaReciente(notas: Nota[]): number {
  const hace7 = new Date()
  hace7.setDate(hace7.getDate() - 6)
  const dias = new Set(
    notas
      .filter(n => new Date(n.created_at) >= hace7)
      .map(n => n.created_at.slice(0, 10))
  )
  return dias.size
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => (
            <SkeletonCard key={i} className="flex flex-col items-center gap-3 py-6">
              <SkeletonBox className="h-9 w-9 shimmer rounded-xl" />
              <SkeletonBox className="h-7 w-12 shimmer" />
              <SkeletonBox className="h-3 w-16 shimmer" />
            </SkeletonCard>
          ))}
        </div>
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
    label: 'Notas',
    desc: 'Calificaciones',
    Icon: Plus,
    to: '/notes',
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
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const [notas, setNotas] = useState<Nota[]>([])
  const [allNotas, setAllNotas] = useState<Nota[]>([])
  const [proximoEvento, setProximoEvento] = useState<EventoCalendario | null>(null)
  const [proximaActividad, setProximaActividad] = useState<Actividad | null>(null)
  const [actividadesPendientes, setActividadesPendientes] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const bannerKey = usuario ? `topcode-banner-${usuario.id}` : null
  const [bannerUrl, setBannerUrl] = useState<string | null>(() =>
    bannerKey ? localStorage.getItem(bannerKey) : null
  )
  const bannerInputRef = useRef<HTMLInputElement>(null)

  function handleBannerChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !bannerKey) return
    const reader = new FileReader()
    reader.onload = ev => {
      const url = ev.target?.result as string
      localStorage.setItem(bannerKey, url)
      setBannerUrl(url)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function handleBannerRemove() {
    if (!bannerKey) return
    localStorage.removeItem(bannerKey)
    setBannerUrl(null)
  }

  const cargarDatos = useCallback(async () => {
    if (!usuario) return
    const now = new Date().toISOString()
    const [notasRecientes, todasNotas, evento, acts, estados] = await Promise.all([
      supabase.from('notas').select('*').eq('usuario_id', usuario.id).order('created_at', { ascending: false }).limit(5),
      supabase.from('notas').select('*').eq('usuario_id', usuario.id),
      supabase.from('eventos').select('*').gte('fecha', new Date().toISOString().slice(0, 10)).order('fecha', { ascending: true }).limit(1),
      supabase.from('actividades').select('*').gte('fecha_entrega', now).order('fecha_entrega', { ascending: true }),
      supabase.from('actividades_estado').select('actividad_id').eq('usuario_id', usuario.id).eq('completada', true),
    ])
    if (notasRecientes.data) setNotas(notasRecientes.data)
    if (todasNotas.data) setAllNotas(todasNotas.data)
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

  const materias = [...new Set(notas.map(n => n.materia))].length
  const promedio = usuario?.promedio ?? 0
  const initial = (usuario?.nombre?.[0] ?? 'U').toUpperCase()
  const { texto: saludo, emoji } = saludoEmoji()
  const semana = semanaActual(allNotas)
  const racha = rachaReciente(allNotas)
  const esAdmin = usuario?.rol === 'admin'
  const quickActions = esAdmin ? [...QUICK_ACTIONS, ADMIN_ACTION] : QUICK_ACTIONS

  // Tendencia: compara promedio últimas 3 notas vs promedio general
  const promedioGeneral = allNotas.length
    ? allNotas.reduce((s, n) => s + n.media, 0) / allNotas.length
    : 0
  const ultimas3 = notas.slice(0, 3)
  const promedioReciente = ultimas3.length
    ? ultimas3.reduce((s, n) => s + n.media, 0) / ultimas3.length
    : promedioGeneral
  const tendenciaSubiendo = promedioReciente >= promedioGeneral

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
            onClick={() => bannerInputRef.current?.click()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold backdrop-blur-sm transition-all duration-150 hover:scale-105"
            style={{ background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.12)', color: '#f1f5f9' }}
            title="Cambiar banner"
          >
            <Camera size={12} />
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
            <div className="flex items-center gap-1.5">
              <span className="text-base leading-none">{emoji}</span>
              <span className="text-sm font-medium" style={{ color: '#64748b' }}>
                {saludo},
              </span>
            </div>

            <h1 className="font-extrabold text-2xl md:text-3xl tracking-tight" style={{ color: '#f1f5f9' }}>
              {usuario?.nombre ?? 'Estudiante'}
            </h1>

            <p className="text-xs mt-0.5 capitalize" style={{ color: '#4b5563' }}>
              {fechaFormateada()}
            </p>

            {/* Badge de rol */}
            <div className="mt-1.5">
              {esAdmin ? (
                <span
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{
                    background: 'rgba(244,63,94,0.1)',
                    color: '#fb7185',
                    border: '1px solid rgba(244,63,94,0.2)',
                  }}
                >
                  <Shield size={10} />
                  Admin
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
                  style={{
                    background: 'rgba(99,102,241,0.08)',
                    color: '#818cf8',
                    border: '1px solid rgba(99,102,241,0.15)',
                  }}
                >
                  <GraduationCap size={10} />
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

        {/* ── Stats row (4 tarjetas) ──────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

          {/* Promedio */}
          <button
            onClick={() => navigate('/notes')}
            className="group relative p-4 md:p-5 flex flex-col items-center gap-2.5 rounded-2xl transition-all duration-200 hover:scale-[1.03] text-left overflow-hidden"
            style={{
              background: 'linear-gradient(145deg, #1a1d27, #141720)',
              border: `1px solid ${gradeColor(promedio)}28`,
              boxShadow: `0 2px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)`,
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.boxShadow =
                `0 8px 24px rgba(0,0,0,0.4), 0 0 16px ${gradeColor(promedio)}22`
              ;(e.currentTarget as HTMLElement).style.borderColor = `${gradeColor(promedio)}44`
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.boxShadow =
                '0 2px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)'
              ;(e.currentTarget as HTMLElement).style.borderColor = `${gradeColor(promedio)}28`
            }}
          >
            {/* Barra de progreso lineal */}
            <div className="w-full h-1 rounded-full overflow-hidden mb-0.5" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min((promedio / 10) * 100, 100)}%`,
                  background: `linear-gradient(90deg, ${gradeColor(promedio)}, ${gradeColor(promedio)}aa)`,
                  boxShadow: `0 0 6px ${gradeColor(promedio)}66`,
                }}
              />
            </div>
            <div
              className="w-10 h-10 flex items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110"
              style={{ background: `${gradeColor(promedio)}18` }}
            >
              <TrendingUp size={16} style={{ color: gradeColor(promedio) }} />
            </div>
            <span
              className="text-2xl md:text-3xl font-extrabold tabular-nums animate-count-up"
              style={{ color: gradeColor(promedio) }}
            >
              {promedio.toFixed(1)}
            </span>
            <div className="text-center">
              <span className="text-xs font-medium block" style={{ color: '#64748b' }}>Promedio</span>
              <span className="text-xs font-semibold" style={{ color: `${gradeColor(promedio)}bb` }}>
                {gradeLabel(promedio)}
              </span>
            </div>
          </button>

          {/* Materias */}
          <div
            className="group p-4 md:p-5 flex flex-col items-center gap-2.5 rounded-2xl transition-all duration-200 hover:scale-[1.03] cursor-default overflow-hidden"
            style={{
              background: 'linear-gradient(145deg, #1a1d27, #141720)',
              border: '1px solid rgba(99,102,241,0.12)',
              boxShadow: '0 2px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.boxShadow =
                '0 8px 24px rgba(0,0,0,0.4), 0 0 16px rgba(99,102,241,0.15)'
              ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(99,102,241,0.28)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.boxShadow =
                '0 2px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)'
              ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(99,102,241,0.12)'
            }}
          >
            <div className="w-full h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }} />
            <div
              className="w-10 h-10 flex items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110"
              style={{ background: 'rgba(99,102,241,0.12)' }}
            >
              <BookOpen size={16} style={{ color: '#818cf8' }} />
            </div>
            <span className="text-2xl md:text-3xl font-extrabold animate-count-up" style={{ color: '#f1f5f9' }}>
              {materias}
            </span>
            <span className="text-xs font-medium text-center" style={{ color: '#64748b' }}>Materias</span>
          </div>

          {/* Registros */}
          <div
            className="group p-4 md:p-5 flex flex-col items-center gap-2.5 rounded-2xl transition-all duration-200 hover:scale-[1.03] cursor-default overflow-hidden"
            style={{
              background: 'linear-gradient(145deg, #1a1d27, #141720)',
              border: '1px solid rgba(139,92,246,0.12)',
              boxShadow: '0 2px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.boxShadow =
                '0 8px 24px rgba(0,0,0,0.4), 0 0 16px rgba(139,92,246,0.15)'
              ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(139,92,246,0.28)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.boxShadow =
                '0 2px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)'
              ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(139,92,246,0.12)'
            }}
          >
            <div className="w-full h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }} />
            <div
              className="w-10 h-10 flex items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110"
              style={{ background: 'rgba(139,92,246,0.12)' }}
            >
              <FileText size={16} style={{ color: '#a78bfa' }} />
            </div>
            <span className="text-2xl md:text-3xl font-extrabold animate-count-up" style={{ color: '#f1f5f9' }}>
              {allNotas.length}
            </span>
            <span className="text-xs font-medium text-center" style={{ color: '#64748b' }}>Registros</span>
          </div>

          {/* Racha semanal */}
          <div
            className="group p-4 md:p-5 flex flex-col items-center gap-2.5 rounded-2xl transition-all duration-200 hover:scale-[1.03] cursor-default overflow-hidden"
            style={{
              background: 'linear-gradient(145deg, #1a1d27, #141720)',
              border: 'rgba(245,158,11,0.12) 1px solid',
              boxShadow: '0 2px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.boxShadow =
                '0 8px 24px rgba(0,0,0,0.4), 0 0 16px rgba(245,158,11,0.15)'
              ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(245,158,11,0.28)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.boxShadow =
                '0 2px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)'
              ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(245,158,11,0.12)'
            }}
          >
            <div className="w-full h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }} />
            <div
              className="w-10 h-10 flex items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110"
              style={{ background: 'rgba(245,158,11,0.12)' }}
            >
              <Flame size={16} style={{ color: '#fbbf24' }} />
            </div>
            <span className="text-2xl md:text-3xl font-extrabold animate-count-up" style={{ color: '#fbbf24' }}>
              {racha}
            </span>
            <div className="text-center">
              <span className="text-xs font-medium block" style={{ color: '#64748b' }}>Semana</span>
              <span className="text-xs font-semibold" style={{ color: 'rgba(251,191,36,0.7)' }}>
                {racha === 7 ? '¡Perfecto!' : racha >= 4 ? 'Muy activo' : racha >= 1 ? 'En marcha' : 'Sin actividad'}
              </span>
            </div>
          </div>
        </div>

        {/* ── Activity strip — 7 días ─────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#4b5563' }}>
            Esta semana
          </h2>
          <div
            className="p-4 rounded-2xl flex items-center gap-2 md:gap-3"
            style={{
              background: 'linear-gradient(145deg, #1a1d27, #141720)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            {semana.map(dia => (
              <div
                key={dia.iso}
                className="flex-1 flex flex-col items-center gap-1.5"
                title={dia.iso}
              >
                <span className="text-2xs font-medium" style={{ color: dia.esHoy ? '#818cf8' : '#4b5563' }}>
                  {dia.label}
                </span>
                <div
                  className="w-full aspect-square max-w-[32px] rounded-lg transition-all duration-200"
                  style={{
                    background: dia.activo
                      ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                      : 'rgba(255,255,255,0.04)',
                    border: dia.esHoy
                      ? '1.5px solid rgba(99,102,241,0.4)'
                      : dia.activo
                        ? '1px solid rgba(99,102,241,0.3)'
                        : '1px solid rgba(255,255,255,0.06)',
                    boxShadow: dia.activo ? '0 0 8px rgba(99,102,241,0.25)' : 'none',
                  }}
                />
              </div>
            ))}
            <div
              className="hidden md:flex items-center gap-1.5 ml-2 shrink-0"
              style={{ borderLeft: '1px solid rgba(255,255,255,0.06)', paddingLeft: '12px' }}
            >
              <Zap size={12} style={{ color: '#fbbf24' }} />
              <span className="text-xs font-semibold" style={{ color: '#fbbf24' }}>
                {racha}/7
              </span>
            </div>
          </div>
        </div>

        {/* ── Quick access ───────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#4b5563' }}>
            Acceso rápido
          </h2>
          <div className={`grid gap-3 grid-cols-3 ${esAdmin ? 'sm:grid-cols-6' : 'sm:grid-cols-5'}`}>
            {quickActions.map(({ label, desc, Icon, to, color, bg, border, glow, gradFrom, gradTo }) => {
              const badge = to === '/actividades' && actividadesPendientes > 0
                ? (actividadesPendientes > 9 ? '9+' : String(actividadesPendientes))
                : null
              return (
              <button
                key={to}
                onClick={() => navigate(to)}
                className="group relative p-4 sm:p-5 flex flex-col items-center gap-2.5 sm:gap-3 rounded-2xl transition-all duration-200 active:scale-[0.97] text-center overflow-hidden"
                style={{
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
                  className="w-14 h-14 flex items-center justify-center rounded-2xl transition-all duration-200 group-hover:scale-110 group-hover:rotate-[-3deg]"
                  style={{
                    background: bg,
                    border: `1px solid ${border}`,
                    boxShadow: `0 4px 12px ${glow}`,
                  }}
                >
                  <Icon size={24} style={{ color }} />
                </div>

                <div>
                  <span className="text-sm font-semibold block" style={{ color: '#f1f5f9' }}>{label}</span>
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
                    className="group w-full text-left p-4 rounded-2xl flex items-center gap-4 transition-all duration-200"
                    style={{ background: `${urgBg}, linear-gradient(145deg, #1a1d27, #141720)`, border: `1px solid ${urgBorder}`, boxShadow: '0 2px 8px rgba(0,0,0,0.25)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 20px rgba(0,0,0,0.35), 0 0 12px ${urgColor}18` }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.25)' }}
                  >
                    <div className="w-11 h-11 shrink-0 flex items-center justify-center rounded-xl" style={{ background: urgBg, border: `1px solid ${urgBorder}` }}>
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
                  className="group w-full text-left p-4 rounded-2xl flex items-center gap-4 transition-all duration-200"
                  style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.06) 0%, rgba(20,184,166,0.04) 100%), linear-gradient(145deg, #1a1d27, #141720)', border: '1px solid rgba(245,158,11,0.18)', boxShadow: '0 2px 8px rgba(0,0,0,0.25)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(245,158,11,0.32)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 20px rgba(0,0,0,0.35), 0 0 12px rgba(245,158,11,0.1)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(245,158,11,0.18)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.25)' }}
                >
                  <div className="w-11 h-11 shrink-0 flex items-center justify-center rounded-xl" style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)' }}>
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

        {/* ── Últimas notas ───────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#4b5563' }}>
              Últimas notas
            </h2>
            <button
              onClick={() => navigate('/notes')}
              className="flex items-center gap-1 text-xs font-semibold transition-all duration-150 hover:gap-1.5"
              style={{ color: '#818cf8' }}
            >
              Ver todas
              <ChevronRight size={13} />
            </button>
          </div>

          {notas.length === 0 ? (
            <div
              className="py-14 flex flex-col items-center gap-4 text-center rounded-2xl"
              style={{
                background: 'linear-gradient(145deg, #1a1d27, #141720)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div
                className="w-16 h-16 flex items-center justify-center rounded-2xl"
                style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}
              >
                <FileText size={24} style={{ color: '#818cf8' }} />
              </div>
              <div>
                <p className="font-semibold text-base" style={{ color: '#f1f5f9' }}>Sin notas todavía</p>
                <p className="text-sm mt-1.5 max-w-xs leading-relaxed" style={{ color: '#64748b' }}>
                  Ve a la sección de Notas para registrar tus primeras calificaciones.
                </p>
              </div>
              <button
                onClick={() => navigate('/notes')}
                className="btn-primary px-5 py-2.5 text-sm"
              >
                <Plus size={14} />
                Añadir nota
              </button>
            </div>
          ) : (
            <div
              className="overflow-hidden rounded-2xl"
              style={{
                background: 'linear-gradient(145deg, #1a1d27, #141720)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              {notas.slice(0, 5).map((nota, idx) => {
                const codigo = MATERIAS.find(m => m.nombre === nota.materia)?.codigo
                  ?? nota.materia.slice(0, 3).toUpperCase()
                const barColor = materiaColor(nota.materia)
                const esTendenciaPositiva = nota.media >= promedioGeneral

                return (
                  <div
                    key={nota.id}
                    className="flex items-center gap-3 transition-colors duration-150 cursor-default animate-slide-up"
                    style={{
                      animationDelay: `${idx * 50}ms`,
                      borderBottom: idx < notas.length - 1 && idx < 4
                        ? '1px solid rgba(255,255,255,0.04)'
                        : 'none',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  >
                    {/* Barra lateral de color por materia */}
                    <div
                      className="self-stretch w-0.5 shrink-0 rounded-r-full my-2"
                      style={{
                        background: `linear-gradient(180deg, ${barColor}, ${barColor}66)`,
                        marginLeft: '0',
                        minWidth: '3px',
                      }}
                    />

                    <div className="flex items-center gap-3 flex-1 min-w-0 py-3.5 pr-4">
                      {/* Subject badge */}
                      <div
                        className="w-10 h-10 flex items-center justify-center rounded-xl shrink-0"
                        style={{
                          background: `${barColor}15`,
                          border: `1px solid ${barColor}28`,
                        }}
                      >
                        <span className="text-xs font-bold" style={{ color: barColor }}>{codigo}</span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium truncate block" style={{ color: '#f1f5f9' }}>
                          {nota.tema}
                        </span>
                        <span className="text-xs truncate block mt-0.5" style={{ color: '#64748b' }}>
                          {nota.materia}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Badge tendencia */}
                        <span
                          className="text-2xs font-semibold px-1.5 py-0.5 rounded-md"
                          style={{
                            background: esTendenciaPositiva ? 'rgba(16,185,129,0.1)' : 'rgba(244,63,94,0.1)',
                            color: esTendenciaPositiva ? '#34d399' : '#fb7185',
                          }}
                        >
                          {esTendenciaPositiva ? '↑' : '↓'}
                        </span>

                        {/* Nota */}
                        <div
                          className="px-3 py-1.5 text-sm font-bold rounded-xl tabular-nums"
                          style={{
                            color: gradeColor(nota.media),
                            background: `${gradeColor(nota.media)}15`,
                            border: `1px solid ${gradeColor(nota.media)}25`,
                          }}
                        >
                          {nota.media.toFixed(1)}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
