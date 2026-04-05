import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  TrendingUp, BookOpen, FileText, Plus, Calendar, MessageCircle,
  FolderOpen, RefreshCw, ChevronRight, ArrowUpRight,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Nota } from '../lib/types'
import { MATERIAS } from '../constants/materias'
import { SkeletonBox, SkeletonCard } from '../components/Skeleton'

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

function saludoHora() {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 20) return 'Buenas tardes'
  return 'Buenas noches'
}

function HomeSkeleton() {
  return (
    <div className="animate-fade-in">
      {/* Header skeleton */}
      <div
        className="px-4 md:px-6 py-8"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="max-w-[1100px] mx-auto flex justify-between items-center">
          <div className="flex flex-col gap-2.5">
            <SkeletonBox className="h-3 w-20 shimmer" />
            <SkeletonBox className="h-8 w-52 shimmer" />
          </div>
          <SkeletonBox className="h-10 w-10 shimmer rounded-xl" />
        </div>
      </div>
      <div className="max-w-[1100px] mx-auto p-4 md:p-6 flex flex-col gap-6">
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map(i => (
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

const QUICK_ACTIONS = [
  {
    label: 'Notas',
    desc: 'Calificaciones',
    Icon: Plus,
    to: '/notes',
    color: '#6366f1',
    bg: 'rgba(99,102,241,0.1)',
    border: 'rgba(99,102,241,0.2)',
  },
  {
    label: 'Eventos',
    desc: 'Calendario',
    Icon: Calendar,
    to: '/calendar',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.1)',
    border: 'rgba(245,158,11,0.2)',
  },
  {
    label: 'Chat',
    desc: 'Mensajes',
    Icon: MessageCircle,
    to: '/chat',
    color: '#10b981',
    bg: 'rgba(16,185,129,0.1)',
    border: 'rgba(16,185,129,0.2)',
  },
  {
    label: 'Apuntes',
    desc: 'Archivos',
    Icon: FolderOpen,
    to: '/apuntes',
    color: '#8b5cf6',
    bg: 'rgba(139,92,246,0.1)',
    border: 'rgba(139,92,246,0.2)',
  },
]

export default function Home() {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const [notas, setNotas] = useState<Nota[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const cargarDatos = useCallback(async () => {
    if (!usuario) return
    const { data } = await supabase
      .from('notas')
      .select('*')
      .eq('usuario_id', usuario.id)
      .order('created_at', { ascending: false })
      .limit(5)
    if (data) setNotas(data)
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

  return (
    <div className="animate-fade-in h-full overflow-y-auto">

      {/* ── Hero header ── */}
      <div
        className="relative px-4 md:px-6 py-8 overflow-hidden"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        {/* Subtle background glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 60% 100% at 5% 50%, rgba(99,102,241,0.07) 0%, transparent 70%)',
          }}
        />

        <div className="max-w-[1100px] mx-auto flex justify-between items-center relative">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium" style={{ color: '#64748b' }}>
              {saludoHora()},
            </span>
            <h1 className="font-extrabold text-2xl md:text-3xl tracking-tight" style={{ color: '#f1f5f9' }}>
              {usuario?.nombre ?? 'Estudiante'}
            </h1>
            <p className="text-sm mt-0.5" style={{ color: '#4b5563' }}>
              {new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}
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

        {/* ── Stats row ── */}
        <div className="grid grid-cols-3 gap-3">
          {/* Promedio */}
          <button
            onClick={() => navigate('/notes')}
            className="group relative p-4 md:p-5 flex flex-col items-center gap-2.5 rounded-2xl transition-all duration-200 hover:scale-[1.02] text-left"
            style={{
              background: 'linear-gradient(145deg, #1a1d27, #141720)',
              border: `1px solid ${gradeColor(promedio)}28`,
              boxShadow: `0 2px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)`,
            }}
          >
            <div
              className="w-10 h-10 flex items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110"
              style={{ background: `${gradeColor(promedio)}18` }}
            >
              <TrendingUp size={16} style={{ color: gradeColor(promedio) }} />
            </div>
            <span className="text-2xl md:text-3xl font-extrabold tabular-nums" style={{ color: gradeColor(promedio) }}>
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
            className="p-4 md:p-5 flex flex-col items-center gap-2.5 rounded-2xl transition-all duration-200 hover:scale-[1.02]"
            style={{
              background: 'linear-gradient(145deg, #1a1d27, #141720)',
              border: '1px solid rgba(99,102,241,0.12)',
              boxShadow: '0 2px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
          >
            <div
              className="w-10 h-10 flex items-center justify-center rounded-xl"
              style={{ background: 'rgba(99,102,241,0.12)' }}
            >
              <BookOpen size={16} style={{ color: '#818cf8' }} />
            </div>
            <span className="text-2xl md:text-3xl font-extrabold" style={{ color: '#f1f5f9' }}>{materias}</span>
            <span className="text-xs font-medium text-center" style={{ color: '#64748b' }}>Materias</span>
          </div>

          {/* Registros */}
          <div
            className="p-4 md:p-5 flex flex-col items-center gap-2.5 rounded-2xl transition-all duration-200 hover:scale-[1.02]"
            style={{
              background: 'linear-gradient(145deg, #1a1d27, #141720)',
              border: '1px solid rgba(139,92,246,0.12)',
              boxShadow: '0 2px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
          >
            <div
              className="w-10 h-10 flex items-center justify-center rounded-xl"
              style={{ background: 'rgba(139,92,246,0.12)' }}
            >
              <FileText size={16} style={{ color: '#a78bfa' }} />
            </div>
            <span className="text-2xl md:text-3xl font-extrabold" style={{ color: '#f1f5f9' }}>{notas.length}</span>
            <span className="text-xs font-medium text-center" style={{ color: '#64748b' }}>Registros</span>
          </div>
        </div>

        {/* ── Quick access ── */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#4b5563' }}>
              Acceso rápido
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {QUICK_ACTIONS.map(({ label, desc, Icon, to, color, bg, border }) => (
              <button
                key={to}
                onClick={() => navigate(to)}
                className="group relative p-4 flex flex-col items-center gap-3 rounded-2xl transition-all duration-200 active:scale-[0.97] hover:scale-[1.02] text-center"
                style={{
                  background: 'linear-gradient(145deg, #1a1d27, #141720)',
                  border: `1px solid rgba(255,255,255,0.06)`,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.borderColor = border
                  el.style.boxShadow = `0 4px 16px rgba(0,0,0,0.35), 0 0 0 1px ${border}`
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.borderColor = 'rgba(255,255,255,0.06)'
                  el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.25)'
                }}
              >
                <div
                  className="w-12 h-12 flex items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110"
                  style={{ background: bg, border: `1px solid ${border}` }}
                >
                  <Icon size={20} style={{ color }} />
                </div>
                <div>
                  <span className="text-sm font-semibold block" style={{ color: '#f1f5f9' }}>{label}</span>
                  <span className="text-xs" style={{ color: '#64748b' }}>{desc}</span>
                </div>
                <ArrowUpRight
                  size={12}
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-50 transition-opacity"
                  style={{ color }}
                />
              </button>
            ))}
          </div>
        </div>

        {/* ── Recent notes ── */}
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
                return (
                  <div
                    key={nota.id}
                    className="px-4 py-3.5 flex items-center gap-3 animate-slide-up transition-colors duration-150 cursor-default"
                    style={{
                      animationDelay: `${idx * 40}ms`,
                      borderBottom: idx < notas.length - 1 && idx < 4
                        ? '1px solid rgba(255,255,255,0.04)'
                        : 'none',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  >
                    {/* Subject badge */}
                    <div
                      className="w-10 h-10 flex items-center justify-center rounded-xl shrink-0"
                      style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.18)' }}
                    >
                      <span className="text-xs font-bold" style={{ color: '#818cf8' }}>{codigo}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium truncate block" style={{ color: '#f1f5f9' }}>
                        {nota.tema}
                      </span>
                      <span className="text-xs truncate block mt-0.5" style={{ color: '#64748b' }}>
                        {nota.materia}
                      </span>
                    </div>

                    {/* Grade pill */}
                    <div
                      className="px-3 py-1.5 text-sm font-bold rounded-xl shrink-0 tabular-nums"
                      style={{
                        color: gradeColor(nota.media),
                        background: `${gradeColor(nota.media)}15`,
                        border: `1px solid ${gradeColor(nota.media)}25`,
                      }}
                    >
                      {nota.media.toFixed(1)}
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
