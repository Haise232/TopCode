import { useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Actividad } from '../lib/types'

interface UseActividadesOptions {
  usuarioId: string | undefined
  isAdmin?: boolean
}

interface AdminStats {
  counts: Record<string, number>
  totalAlumnos: number
}

interface UseActividadesReturn {
  actividades: Actividad[]
  estados: Record<string, boolean>
  adminStats: AdminStats
  loading: boolean
  error: string | null
  init: () => Promise<void>
  refresh: () => Promise<void>
  createActividadOptimistic: (
    act: Omit<Actividad, 'id' | 'created_at'>
  ) => Promise<{ error: string | null }>
  deleteActividadOptimistic: (id: string) => Promise<{ error: string | null }>
  toggleEstado: (actId: string, current: boolean) => Promise<void>
}

const CACHE_TTL_MS = 30_000

export function useActividades({
  usuarioId,
  isAdmin = false,
}: UseActividadesOptions): UseActividadesReturn {
  const [actividades, setActividades] = useState<Actividad[]>([])
  const [estados, setEstados] = useState<Record<string, boolean>>({})
  const [adminStats, setAdminStats] = useState<AdminStats>({ counts: {}, totalAlumnos: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cacheRef = useRef<{
    actividades: Actividad[]
    estados: Record<string, boolean>
    adminStats: AdminStats
    ts: number
  } | null>(null)

  const mountedRef = useRef(true)

  const fetchAll = useCallback(async (force = false) => {
    if (!usuarioId) return

    if (!force && cacheRef.current && Date.now() - cacheRef.current.ts < CACHE_TTL_MS) {
      if (mountedRef.current) {
        setActividades(cacheRef.current.actividades)
        setEstados(cacheRef.current.estados)
        setAdminStats(cacheRef.current.adminStats)
        setLoading(false)
      }
      return
    }

    const controller = new AbortController()
    const signal = controller.signal

    try {
      // Limpiar actividades vencidas
      await supabase
        .from('actividades')
        .delete()
        .lt('fecha_entrega', new Date().toISOString())

      const [actsRes, estadosRes] = await Promise.all([
        supabase
          .from('actividades')
          .select('id, titulo, descripcion, materia, fecha_entrega, created_by, created_at')
          .order('fecha_entrega', { ascending: true })
          .limit(100)
          .abortSignal(signal),
        supabase
          .from('actividades_estado')
          .select('actividad_id, completada')
          .eq('usuario_id', usuarioId)
          .abortSignal(signal),
      ])

      if (!mountedRef.current) return

      if (actsRes.error) { setError(actsRes.error.message); return }

      const acts = (actsRes.data ?? []) as Actividad[]
      const estadosMap: Record<string, boolean> = {}
      ;(estadosRes.data ?? []).forEach((e: { actividad_id: string; completada: boolean }) => {
        estadosMap[e.actividad_id] = e.completada
      })

      let stats: AdminStats = { counts: {}, totalAlumnos: 0 }

      if (isAdmin) {
        const [statsRes, usersRes] = await Promise.all([
          supabase.from('actividades_estado').select('actividad_id').eq('completada', true).abortSignal(signal),
          supabase.from('usuarios').select('id', { count: 'exact', head: true }).abortSignal(signal),
        ])
        if (!mountedRef.current) return

        if (statsRes.data) {
          const counts: Record<string, number> = {}
          statsRes.data.forEach((e: { actividad_id: string }) => {
            counts[e.actividad_id] = (counts[e.actividad_id] ?? 0) + 1
          })
          stats = { counts, totalAlumnos: usersRes.count ?? 0 }
        }
      }

      cacheRef.current = { actividades: acts, estados: estadosMap, adminStats: stats, ts: Date.now() }
      setActividades(acts)
      setEstados(estadosMap)
      setAdminStats(stats)
      setError(null)
    } catch (err: unknown) {
      if (!mountedRef.current) return
      const isAbort = err instanceof Error && err.name === 'AbortError'
      if (!isAbort) setError('Error de conexión')
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [usuarioId, isAdmin])

  const init = useCallback(() => fetchAll(false), [fetchAll])

  const refresh = useCallback(async () => {
    setLoading(true)
    await fetchAll(true)
  }, [fetchAll])

  // Optimistic create
  const createActividadOptimistic = useCallback(async (
    act: Omit<Actividad, 'id' | 'created_at'>
  ): Promise<{ error: string | null }> => {
    const tempId = `temp-${Date.now()}`
    const tempAct: Actividad = { ...act, id: tempId, created_at: new Date().toISOString() }

    setActividades(prev =>
      [...prev, tempAct].sort(
        (a, b) => new Date(a.fecha_entrega).getTime() - new Date(b.fecha_entrega).getTime()
      )
    )

    const { data, error: insertError } = await supabase
      .from('actividades')
      .insert(act)
      .select()
      .single()

    if (insertError) {
      setActividades(prev => prev.filter(a => a.id !== tempId))
      return { error: insertError.message }
    }

    const real = data as Actividad
    setActividades(prev =>
      prev
        .map(a => (a.id === tempId ? real : a))
        .sort((a, b) => new Date(a.fecha_entrega).getTime() - new Date(b.fecha_entrega).getTime())
    )
    return { error: null }
  }, [])

  // Optimistic delete
  const deleteActividadOptimistic = useCallback(async (
    id: string
  ): Promise<{ error: string | null }> => {
    const snapshot = actividades.find(a => a.id === id)

    setActividades(prev => prev.filter(a => a.id !== id))

    const { error: deleteError } = await supabase
      .from('actividades')
      .delete()
      .eq('id', id)

    if (deleteError) {
      if (snapshot) {
        setActividades(prev =>
          [...prev, snapshot].sort(
            (a, b) => new Date(a.fecha_entrega).getTime() - new Date(b.fecha_entrega).getTime()
          )
        )
      }
      return { error: deleteError.message }
    }

    return { error: null }
  }, [actividades])

  // Toggle estado con optimistic update
  const toggleEstado = useCallback(async (actId: string, current: boolean) => {
    if (!usuarioId) return
    const nuevo = !current

    // Optimistic
    setEstados(prev => ({ ...prev, [actId]: nuevo }))

    const { error: upsertError } = await supabase
      .from('actividades_estado')
      .upsert(
        {
          actividad_id: actId,
          usuario_id: usuarioId,
          completada: nuevo,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'actividad_id,usuario_id' }
      )

    if (upsertError) {
      // Revertir
      setEstados(prev => ({ ...prev, [actId]: current }))
    }
  }, [usuarioId])

  return {
    actividades,
    estados,
    adminStats,
    loading,
    error,
    init,
    refresh,
    createActividadOptimistic,
    deleteActividadOptimistic,
    toggleEstado,
  }
}
