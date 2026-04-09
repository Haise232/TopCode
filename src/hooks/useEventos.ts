import { useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { EventoCalendario } from '../lib/types'

interface UseEventosReturn {
  eventos: EventoCalendario[]
  loading: boolean
  error: string | null
  init: () => Promise<void>
  refresh: () => Promise<void>
  createEvento: (
    ev: Omit<EventoCalendario, 'id' | 'created_at'>
  ) => Promise<{ error: string | null }>
  deleteEvento: (id: string) => Promise<{ error: string | null }>
}

const CACHE_TTL_MS = 60_000 // 1 minuto — los eventos cambian con menos frecuencia

export function useEventos(): UseEventosReturn {
  const [eventos, setEventos] = useState<EventoCalendario[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cacheRef = useRef<{ data: EventoCalendario[]; ts: number } | null>(null)
  const mountedRef = useRef(true)

  const fetchEventos = useCallback(async (force = false) => {
    if (!force && cacheRef.current && Date.now() - cacheRef.current.ts < CACHE_TTL_MS) {
      if (mountedRef.current) {
        setEventos(cacheRef.current.data)
        setLoading(false)
      }
      return
    }

    const controller = new AbortController()

    try {
      const { data, error: fetchError } = await supabase
        .from('eventos')
        .select('id, titulo, descripcion, materia, fecha, created_by, created_at')
        .order('fecha', { ascending: true })
        .limit(200)
        .abortSignal(controller.signal)

      if (!mountedRef.current) return

      if (fetchError) { setError(fetchError.message); return }

      const result = (data ?? []) as EventoCalendario[]
      cacheRef.current = { data: result, ts: Date.now() }
      setEventos(result)
      setError(null)
    } catch (err: unknown) {
      if (!mountedRef.current) return
      const isAbort = err instanceof Error && err.name === 'AbortError'
      if (!isAbort) setError('Error de conexión')
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [])

  const init = useCallback(() => fetchEventos(false), [fetchEventos])

  const refresh = useCallback(async () => {
    setLoading(true)
    await fetchEventos(true)
  }, [fetchEventos])

  const createEvento = useCallback(async (
    ev: Omit<EventoCalendario, 'id' | 'created_at'>
  ): Promise<{ error: string | null }> => {
    const tempId = `temp-${Date.now()}`
    const tempEvento: EventoCalendario = {
      ...ev,
      id: tempId,
      created_at: new Date().toISOString(),
    }

    // Optimistic: insertar y re-ordenar por fecha
    setEventos(prev =>
      [...prev, tempEvento].sort((a, b) => a.fecha.localeCompare(b.fecha))
    )

    const { data, error: insertError } = await supabase
      .from('eventos')
      .insert(ev)
      .select()
      .single()

    if (insertError) {
      setEventos(prev => prev.filter(e => e.id !== tempId))
      return { error: insertError.message }
    }

    const real = data as EventoCalendario
    setEventos(prev =>
      prev
        .map(e => (e.id === tempId ? real : e))
        .sort((a, b) => a.fecha.localeCompare(b.fecha))
    )
    if (cacheRef.current) {
      cacheRef.current = {
        data: [...cacheRef.current.data, real].sort((a, b) => a.fecha.localeCompare(b.fecha)),
        ts: Date.now(),
      }
    }
    return { error: null }
  }, [])

  const deleteEvento = useCallback(async (id: string): Promise<{ error: string | null }> => {
    const snapshot = eventos.find(e => e.id === id)

    setEventos(prev => prev.filter(e => e.id !== id))

    const { error: deleteError } = await supabase
      .from('eventos')
      .delete()
      .eq('id', id)

    if (deleteError) {
      if (snapshot) {
        setEventos(prev =>
          [...prev, snapshot].sort((a, b) => a.fecha.localeCompare(b.fecha))
        )
      }
      return { error: deleteError.message }
    }

    if (cacheRef.current) {
      cacheRef.current = {
        data: cacheRef.current.data.filter(e => e.id !== id),
        ts: Date.now(),
      }
    }
    return { error: null }
  }, [eventos])

  return { eventos, loading, error, init, refresh, createEvento, deleteEvento }
}
