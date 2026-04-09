import { useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Nota, EventoCalendario, Actividad } from '../lib/types'

interface HomeDatos {
  notasRecientes: Nota[]
  allNotas: Nota[]
  proximoEvento: EventoCalendario | null
  proximaActividad: Actividad | null
  actividadesPendientes: number
}

interface UseHomeDatosReturn extends HomeDatos {
  loading: boolean
  error: string | null
  init: () => Promise<void>
  refresh: () => Promise<void>
}

const CACHE_TTL_MS = 30_000

export function useHomeDatos(usuarioId: string | undefined): UseHomeDatosReturn {
  const [datos, setDatos] = useState<HomeDatos>({
    notasRecientes: [],
    allNotas: [],
    proximoEvento: null,
    proximaActividad: null,
    actividadesPendientes: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cacheRef = useRef<{ data: HomeDatos; ts: number } | null>(null)
  const mountedRef = useRef(true)

  const fetchDatos = useCallback(async (force = false) => {
    if (!usuarioId) return

    if (!force && cacheRef.current && Date.now() - cacheRef.current.ts < CACHE_TTL_MS) {
      if (mountedRef.current) {
        setDatos(cacheRef.current.data)
        setLoading(false)
      }
      return
    }

    const controller = new AbortController()
    const signal = controller.signal
    const now = new Date().toISOString()

    try {
      // Una sola query de notas: elimina la query duplicada.
      // notasRecientes se extrae en cliente con .slice(0,5).
      const [todasNotasRes, eventoRes, actsRes, estadosRes] = await Promise.all([
        supabase
          .from('notas')
          .select('id, usuario_id, materia, tema, teorica, practica, media, created_at')
          .eq('usuario_id', usuarioId)
          .order('created_at', { ascending: false })
          .abortSignal(signal),
        supabase
          .from('eventos')
          .select('id, titulo, descripcion, materia, fecha, created_by, created_at')
          .gte('fecha', new Date().toISOString().slice(0, 10))
          .order('fecha', { ascending: true })
          .limit(1)
          .abortSignal(signal),
        supabase
          .from('actividades')
          .select('id, titulo, descripcion, materia, fecha_entrega, created_by, created_at')
          .gte('fecha_entrega', now)
          .order('fecha_entrega', { ascending: true })
          .limit(50)
          .abortSignal(signal),
        supabase
          .from('actividades_estado')
          .select('actividad_id')
          .eq('usuario_id', usuarioId)
          .eq('completada', true)
          .abortSignal(signal),
      ])

      if (!mountedRef.current) return

      const allNotas = (todasNotasRes.data ?? []) as Nota[]
      const notasRecientes = allNotas.slice(0, 5)
      const proximoEvento = (eventoRes.data?.[0] ?? null) as EventoCalendario | null

      let proximaActividad: Actividad | null = null
      let actividadesPendientes = 0

      if (actsRes.data) {
        const doneIds = new Set(
          (estadosRes.data ?? []).map((e: { actividad_id: string }) => e.actividad_id)
        )
        const pendientes = (actsRes.data as Actividad[]).filter(a => !doneIds.has(a.id))
        actividadesPendientes = pendientes.length
        proximaActividad = pendientes[0] ?? null
      }

      const result: HomeDatos = {
        notasRecientes,
        allNotas,
        proximoEvento,
        proximaActividad,
        actividadesPendientes,
      }

      cacheRef.current = { data: result, ts: Date.now() }
      setDatos(result)
      setError(null)
    } catch (err: unknown) {
      if (!mountedRef.current) return
      const isAbort = err instanceof Error && err.name === 'AbortError'
      if (!isAbort) setError('Error al cargar los datos')
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [usuarioId])

  const init = useCallback(() => fetchDatos(false), [fetchDatos])

  const refresh = useCallback(async () => {
    setLoading(true)
    await fetchDatos(true)
  }, [fetchDatos])

  return { ...datos, loading, error, init, refresh }
}
