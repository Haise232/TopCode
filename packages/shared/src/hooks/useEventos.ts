import { useState, useCallback, useRef } from 'react'
import { getSupabase } from '../lib/supabase'
import { EventoCalendario } from '../lib/types'

type EventoInput = Omit<EventoCalendario, 'id' | 'created_at'>
type EventoUpdate = Partial<Pick<EventoCalendario, 'titulo' | 'descripcion' | 'materia' | 'fecha' | 'hora'>>

interface UseEventosReturn {
  eventos: EventoCalendario[]
  loading: boolean
  error: string | null
  init: () => Promise<void>
  refresh: () => Promise<void>
  createEvento: (ev: EventoInput) => Promise<{ error: string | null }>
  updateEvento: (id: string, updates: EventoUpdate) => Promise<{ error: string | null }>
  deleteEvento: (id: string) => Promise<{ error: string | null }>
}

const CACHE_TTL_MS = 60_000

export function useEventos(): UseEventosReturn {
  const [eventos, setEventos] = useState<EventoCalendario[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cacheRef = useRef<{ data: EventoCalendario[]; ts: number } | null>(null)
  const mountedRef = useRef(true)

  const sortEventos = (list: EventoCalendario[]) =>
    [...list].sort((a, b) =>
      a.fecha !== b.fecha
        ? a.fecha.localeCompare(b.fecha)
        : (a.hora ?? '').localeCompare(b.hora ?? '')
    )

  const fetchEventos = useCallback(async (force = false) => {
    const supabase = getSupabase()
    if (!force && cacheRef.current && Date.now() - cacheRef.current.ts < CACHE_TTL_MS) {
      if (mountedRef.current) { setEventos(cacheRef.current.data); setLoading(false) }
      return
    }

    const controller = new AbortController()
    try {
      const { data, error: fetchError } = await supabase
        .from('eventos')
        .select('id, clase, titulo, descripcion, materia, fecha, hora, created_by, created_at')
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
  const refresh = useCallback(async () => { setLoading(true); await fetchEventos(true) }, [fetchEventos])

  const createEvento = useCallback(async (ev: EventoInput): Promise<{ error: string | null }> => {
    const supabase = getSupabase()
    const tempId = `temp-${Date.now()}`
    const tempEvento: EventoCalendario = { ...ev, id: tempId, created_at: new Date().toISOString() }

    setEventos(prev => sortEventos([...prev, tempEvento]))

    const { data, error: insertError } = await supabase
      .from('eventos').insert(ev).select().single()

    if (insertError) {
      setEventos(prev => prev.filter(e => e.id !== tempId))
      return { error: insertError.message }
    }

    const real = data as EventoCalendario
    setEventos(prev => sortEventos(prev.map(e => e.id === tempId ? real : e)))
    if (cacheRef.current) {
      cacheRef.current = { data: sortEventos([...cacheRef.current.data, real]), ts: Date.now() }
    }
    return { error: null }
  }, [])

  const updateEvento = useCallback(async (id: string, updates: EventoUpdate): Promise<{ error: string | null }> => {
    const supabase = getSupabase()
    const snapshot = eventos.find(e => e.id === id)
    setEventos(prev => sortEventos(prev.map(e => e.id === id ? { ...e, ...updates } : e)))

    const { error: e } = await supabase.from('eventos').update(updates).eq('id', id)
    if (e) {
      if (snapshot) setEventos(prev => sortEventos(prev.map(ev => ev.id === id ? snapshot : ev)))
      return { error: e.message }
    }
    if (cacheRef.current) {
      cacheRef.current = {
        data: sortEventos(cacheRef.current.data.map(ev => ev.id === id ? { ...ev, ...updates } : ev)),
        ts: Date.now(),
      }
    }
    return { error: null }
  }, [eventos])

  const deleteEvento = useCallback(async (id: string): Promise<{ error: string | null }> => {
    const supabase = getSupabase()
    const snapshot = eventos.find(e => e.id === id)
    setEventos(prev => prev.filter(e => e.id !== id))

    const { error: deleteError } = await supabase.from('eventos').delete().eq('id', id)
    if (deleteError) {
      if (snapshot) setEventos(prev => sortEventos([...prev, snapshot]))
      return { error: deleteError.message }
    }
    if (cacheRef.current) {
      cacheRef.current = { data: cacheRef.current.data.filter(e => e.id !== id), ts: Date.now() }
    }
    return { error: null }
  }, [eventos])

  return { eventos, loading, error, init, refresh, createEvento, updateEvento, deleteEvento }
}
