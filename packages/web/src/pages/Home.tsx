import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useHorario, type EventoCalendario, cacheGet, cacheSet, cacheInvalidatePrefix } from '@topcode/shared'
import { SkeletonBox, SkeletonCard, SkeletonSchedule, SkeletonQuickActions } from '../components/Skeleton'
import HomeView, { type DudaInicio } from '../components/home/HomeView'

// ── Skeleton ──────────────────────────────────────────────────────────────────
// Refleja la estructura de Inicio: cabecera, horario | próximamente + dudas, accesos.

function HomeSkeleton() {
  return (
    <div className="animate-fade-in">
      <div className="max-w-[1100px] mx-auto px-4 md:px-6 pt-6 pb-8 flex flex-col gap-8">
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-2.5">
            <SkeletonBox className="h-3 w-24 shimmer" />
            <SkeletonBox className="h-9 w-56 shimmer" />
            <SkeletonBox className="h-5 w-40 shimmer rounded-full" />
          </div>
          <SkeletonBox className="h-10 w-10 shimmer rounded-xl" />
        </div>

        <div className="grid gap-8 lg:gap-6 lg:grid-cols-12 items-start">
          <div className="lg:col-span-7">
            <SkeletonSchedule rows={6} />
          </div>
          <div className="lg:col-span-5 flex flex-col gap-2.5">
            {[1, 2, 3].map(i => (
              <SkeletonCard key={i} className="flex items-center gap-3 py-4">
                <SkeletonBox className="h-10 w-10 shrink-0 shimmer rounded-xl" />
                <div className="flex-1 flex flex-col gap-2">
                  <SkeletonBox className="h-4 w-3/4 shimmer" />
                  <SkeletonBox className="h-3 w-1/4 shimmer" />
                </div>
              </SkeletonCard>
            ))}
          </div>
        </div>

        <SkeletonQuickActions count={7} />
        <SkeletonQuickActions count={5} />
      </div>
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────
// Aquí vive la carga de datos; la presentación está en components/home/HomeView.

export default function Home() {
  const { usuario, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [proximoEvento, setProximoEvento] = useState<EventoCalendario | null>(null)
  const [proximaActividad, setProximaActividad] = useState<EventoCalendario | null>(null)
  const [dudasRecientes, setDudasRecientes] = useState<DudaInicio[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const { porDia: horarioPorDia, loading: horarioLoading, init: initHorario } = useHorario(usuario?.clase)
  // Guardia de montado: evita actualizaciones de estado tras desmontar el componente
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const cargarDatos = useCallback(async (forzar = false) => {
    if (!usuario) return
    const hoy = new Date().toISOString().slice(0, 10)

    // Claves de caché para datos globales (no dependen del usuario)
    const CACHE_EVENTO = 'home:proximo-evento'
    const CACHE_ACTS   = 'home:actividades-futuras'

    // Si se fuerza un refresh (botón manual), invalidar caché global
    if (forzar) cacheInvalidatePrefix('home:')

    // Leer caché para las dos queries globales; si hay miss, ir a Supabase
    const cachedEvento = cacheGet<EventoCalendario[]>(CACHE_EVENTO)
    const cachedActs   = cacheGet<EventoCalendario[]>(CACHE_ACTS)

    const [evento, acts, estados, dudas] = await Promise.all([
      cachedEvento !== null
        ? Promise.resolve({ data: cachedEvento, error: null })
        : supabase.from('eventos').select('*').not('tipo', 'in', '(actividad,trabajo)').gte('fecha', hoy).order('fecha', { ascending: true }).limit(1),
      cachedActs !== null
        ? Promise.resolve({ data: cachedActs, error: null })
        : supabase.from('eventos').select('*').in('tipo', ['actividad', 'trabajo']).gte('fecha', hoy).order('fecha', { ascending: true }).limit(50),
      // eventos_estado es usuario-específico: siempre fresco
      supabase.from('eventos_estado').select('evento_id').eq('usuario_id', usuario.id).eq('completada', true),
      supabase.from('foro_posts').select('id, titulo, autor, created_at, foro_respuestas(id)').eq('resuelto', false).order('created_at', { ascending: false }).limit(3),
    ])

    // Guardar en caché si vinieron de red (no de caché previa)
    if (cachedEvento === null && evento.data) cacheSet(CACHE_EVENTO, evento.data)
    if (cachedActs   === null && acts.data)   cacheSet(CACHE_ACTS,   acts.data)

    // Si el componente se desmontó mientras las queries estaban en vuelo, no actualizar estado
    if (!mountedRef.current) return

    if (evento.data?.[0]) setProximoEvento(evento.data[0])
    else setProximoEvento(null)

    if (acts.data) {
      const doneIds = new Set((estados.data ?? []).map((e: { evento_id: string }) => e.evento_id))
      const pendientes = acts.data.filter((a: EventoCalendario) => !doneIds.has(a.id))
      setProximaActividad(pendientes[0] ?? null)
    }
    setDudasRecientes((dudas.data ?? []) as DudaInicio[])
  }, [usuario])

  useEffect(() => {
    cargarDatos().finally(() => setLoading(false))
  }, [cargarDatos])

  useEffect(() => {
    initHorario()
  }, [initHorario])

  async function handleRefresh() {
    setRefreshing(true)
    await cargarDatos(true)
    setRefreshing(false)
  }

  if (loading || authLoading || horarioLoading) return <HomeSkeleton />

  return (
    <HomeView
      usuario={usuario}
      horarioPorDia={horarioPorDia}
      proximoEvento={proximoEvento}
      proximaActividad={proximaActividad}
      dudasRecientes={dudasRecientes}
      refreshing={refreshing}
      onRefresh={handleRefresh}
      onNavigate={navigate}
    />
  )
}
