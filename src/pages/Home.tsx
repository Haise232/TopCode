import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  TrendingUp, BookOpen, FileText, Plus, Calendar, MessageCircle,
  FolderOpen, RefreshCw, ChevronRight,
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
    <div>
      <div className="px-4 md:px-6 py-8" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
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
  { label: 'Notas', desc: 'Calificaciones', Icon: Plus, to: '/notes', color: '#6366f1' },
  { label: 'Eventos', desc: 'Calendario', Icon: Calendar, to: '/calendar', color: '#f59e0b' },
  { label: 'Chat', desc: 'Mensajes', Icon: MessageCircle, to: '/chat', color: '#10b981' },
  { label: 'Apuntes', desc: 'Archivos', Icon: FolderOpen, to: '/apuntes', color: '#8b5cf6' },
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
    <div className="animate-fade-in">
      {/* Header */}
      <div className="relative px-4 md:px-6 py-8 overflow-hidden" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-[1100px] mx-auto flex justify-between items-center relative">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium" style={{ color: '#64748b' }}>{saludoHora()}</span>
            <h1 className="font-extrabold text-2xl md:text-3xl tracking-tight" style={{ color: '#f1f5f9' }}>
              {usuario?.nombre ?? 'Estudiante'}
            </h1>
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
              className="relative w-10 h-10 overflow-hidden rounded-xl transition-all duration-150 hover:ring-2 hover:ring-primary"
              style={{ border: '1px solid rgba(99,102,241,0.3)' }}
            >
              {usuario?.avatar_url ? (
                <img src={usuario.avatar_url} alt="" className="w-10 h-10 object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.15)' }}>
                  <span className="font-bold text-base" style={{ color: '#818cf8' }}>{initial}</span>
                </div>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1100px] mx-auto p-4 md:p-6 flex flex-col gap-6">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {/* Promedio */}
          <div
            className="relative p-4 flex flex-col items-center gap-2 rounded-2xl cursor-pointer transition-all duration-150 hover:scale-[1.02]"
            style={{
              background: '#1a1d27',
              border: `1px solid ${gradeColor(promedio)}30`,
            }}
            onClick={() => navigate('/notes')}
          >
            <div className="w-9 h-9 flex items-center justify-center rounded-xl" style={{ background: `${gradeColor(promedio)}18` }}>
              <TrendingUp size={15} style={{ color: gradeColor(promedio) }} />
            </div>
            <span className="text-2xl font-extrabold" style={{ color: gradeColor(promedio) }}>
              {promedio.toFixed(1)}
            </span>
            <div className="text-center">
              <span className="text-xs font-medium block" style={{ color: '#64748b' }}>Promedio</span>
              <span className="text-xs font-semibold" style={{ color: `${gradeColor(promedio)}cc` }}>
                {gradeLabel(promedio)}
              </span>
            </div>
          </div>

          {/* Materias */}
          <div
            className="p-4 flex flex-col items-center gap-2 rounded-2xl transition-all duration-150 hover:scale-[1.02]"
            style={{ background: '#1a1d27', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="w-9 h-9 flex items-center justify-center rounded-xl" style={{ background: 'rgba(99,102,241,0.12)' }}>
              <BookOpen size={15} style={{ color: '#818cf8' }} />
            </div>
            <span className="text-2xl font-extrabold" style={{ color: '#f1f5f9' }}>{materias}</span>
            <span className="text-xs font-medium" style={{ color: '#64748b' }}>Materias</span>
          </div>

          {/* Registros */}
          <div
            className="p-4 flex flex-col items-center gap-2 rounded-2xl transition-all duration-150 hover:scale-[1.02]"
            style={{ background: '#1a1d27', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="w-9 h-9 flex items-center justify-center rounded-xl" style={{ background: 'rgba(139,92,246,0.12)' }}>
              <FileText size={15} style={{ color: '#a78bfa' }} />
            </div>
            <span className="text-2xl font-extrabold" style={{ color: '#f1f5f9' }}>{notas.length}</span>
            <span className="text-xs font-medium" style={{ color: '#64748b' }}>Registros</span>
          </div>
        </div>

        {/* Quick access */}
        <div className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>
            Acceso rápido
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {QUICK_ACTIONS.map(({ label, desc, Icon, to, color }) => (
              <button
                key={to}
                onClick={() => navigate(to)}
                className="relative p-4 flex flex-col items-center gap-3 rounded-2xl transition-all duration-150 group active:scale-[0.97] hover:scale-[1.02]"
                style={{ background: '#1a1d27', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <div
                  className="w-11 h-11 flex items-center justify-center rounded-xl transition-transform duration-150 group-hover:scale-110"
                  style={{ background: `${color}18` }}
                >
                  <Icon size={20} style={{ color }} />
                </div>
                <div className="text-center">
                  <span className="text-sm font-semibold block" style={{ color: '#f1f5f9' }}>{label}</span>
                  <span className="text-xs" style={{ color: '#64748b' }}>{desc}</span>
                </div>
                <ChevronRight
                  size={11}
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-40 transition-opacity"
                  style={{ color }}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Recent notes */}
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>
              Últimas notas
            </h2>
            <button
              onClick={() => navigate('/notes')}
              className="flex items-center gap-1 text-xs font-semibold transition-colors hover:opacity-80"
              style={{ color: '#818cf8' }}
            >
              Ver todas
              <ChevronRight size={13} />
            </button>
          </div>

          {notas.length === 0 ? (
            <div
              className="p-10 flex flex-col items-center gap-3 text-center rounded-2xl"
              style={{ background: '#1a1d27', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="w-14 h-14 flex items-center justify-center rounded-2xl" style={{ background: 'rgba(99,102,241,0.12)' }}>
                <FileText size={22} style={{ color: '#818cf8' }} />
              </div>
              <div>
                <p className="font-semibold text-base" style={{ color: '#f1f5f9' }}>Sin notas todavía</p>
                <p className="text-sm mt-1 max-w-xs leading-relaxed" style={{ color: '#64748b' }}>
                  Ve a la sección de Notas para registrar tus primeras calificaciones.
                </p>
              </div>
              <button
                onClick={() => navigate('/notes')}
                className="btn-primary px-5 py-2.5 text-sm mt-1"
              >
                <Plus size={14} />
                Añadir nota
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {notas.slice(0, 5).map((nota, idx) => {
                const codigo = MATERIAS.find(m => m.nombre === nota.materia)?.codigo
                  ?? nota.materia.slice(0, 3).toUpperCase()
                return (
                  <div
                    key={nota.id}
                    className="px-4 py-3.5 flex items-center gap-3 rounded-xl animate-slide-up transition-all duration-150 hover:border-white/10"
                    style={{
                      animationDelay: `${idx * 40}ms`,
                      background: '#1a1d27',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    <div
                      className="w-10 h-10 flex items-center justify-center rounded-xl shrink-0"
                      style={{ background: 'rgba(99,102,241,0.12)' }}
                    >
                      <span className="text-xs font-bold" style={{ color: '#818cf8' }}>{codigo}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium truncate block" style={{ color: '#f1f5f9' }}>{nota.tema}</span>
                      <span className="text-xs truncate block" style={{ color: '#64748b' }}>{nota.materia}</span>
                    </div>
                    <div
                      className="px-2.5 py-1 text-sm font-bold rounded-lg shrink-0"
                      style={{
                        color: gradeColor(nota.media),
                        background: `${gradeColor(nota.media)}15`,
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
