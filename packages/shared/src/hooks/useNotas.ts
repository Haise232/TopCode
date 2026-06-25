import { useState, useCallback, useRef } from 'react'
import { getSupabase, actualizarPromedio } from '../lib/supabase'
import { Nota } from '../lib/types'

interface UseNotasOptions {
  usuarioId: string | undefined
}

interface UseNotasReturn {
  notas: Nota[]
  loading: boolean
  error: string | null
  init: () => Promise<void>
  refresh: () => Promise<void>
  addNotaOptimistic: (nota: Omit<Nota, 'id' | 'created_at'>) => Promise<{ error: string | null }>
  deleteNotaOptimistic: (id: string) => Promise<{ error: string | null }>
}

export function useNotas({ usuarioId }: UseNotasOptions): UseNotasReturn {
  const [notas, setNotas] = useState<Nota[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cacheRef = useRef<{ data: Nota[]; ts: number } | null>(null)
  const CACHE_TTL_MS = 30_000

  const mountedRef = useRef(true)

  const fetchNotas = useCallback(async (force = false) => {
    if (!usuarioId) return
    const supabase = getSupabase()

    if (!force && cacheRef.current && Date.now() - cacheRef.current.ts < CACHE_TTL_MS) {
      if (mountedRef.current) {
        setNotas(cacheRef.current.data)
        setLoading(false)
      }
      return
    }

    const controller = new AbortController()

    try {
      const { data, error: fetchError } = await supabase
        .from('notas')
        .select('id, usuario_id, materia, tema, teorica, practica, media, created_at')
        .eq('usuario_id', usuarioId)
        .order('created_at', { ascending: false })
        .abortSignal(controller.signal)

      if (!mountedRef.current) return

      if (fetchError) {
        setError(fetchError.message)
        return
      }
      const result = (data ?? []) as Nota[]
      cacheRef.current = { data: result, ts: Date.now() }
      setNotas(result)
      setError(null)
    } catch (err: unknown) {
      if (!mountedRef.current) return
      const isAbort = err instanceof Error && err.name === 'AbortError'
      if (!isAbort) setError('Error de conexión')
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [usuarioId])

  const init = useCallback(() => fetchNotas(false), [fetchNotas])

  const refresh = useCallback(async () => {
    setLoading(true)
    await fetchNotas(true)
  }, [fetchNotas])

  const addNotaOptimistic = useCallback(async (
    nota: Omit<Nota, 'id' | 'created_at'>
  ): Promise<{ error: string | null }> => {
    const supabase = getSupabase()
    const tempId = `temp-${Date.now()}`
    const tempNota: Nota = { ...nota, id: tempId, created_at: new Date().toISOString() }

    setNotas(prev => [tempNota, ...prev])

    const { data, error: insertError } = await supabase
      .from('notas')
      .insert(nota)
      .select()
      .single()

    if (insertError) {
      setNotas(prev => prev.filter(n => n.id !== tempId))
      return { error: insertError.message }
    }

    const real = data as Nota
    setNotas(prev => prev.map(n => n.id === tempId ? real : n))
    if (cacheRef.current) {
      cacheRef.current = { data: [real, ...cacheRef.current.data], ts: Date.now() }
    }

    await actualizarPromedio(nota.usuario_id)
    return { error: null }
  }, [])

  const deleteNotaOptimistic = useCallback(async (
    id: string
  ): Promise<{ error: string | null }> => {
    const supabase = getSupabase()
    const snapshot = notas.find(n => n.id === id)
    if (!snapshot) return { error: 'Nota no encontrada' }

    setNotas(prev => prev.filter(n => n.id !== id))

    const { error: deleteError } = await supabase
      .from('notas')
      .delete()
      .eq('id', id)

    if (deleteError) {
      setNotas(prev => {
        const copy = [...prev]
        copy.splice(0, 0, snapshot)
        return copy.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      })
      return { error: deleteError.message }
    }

    if (cacheRef.current) {
      cacheRef.current = { data: cacheRef.current.data.filter(n => n.id !== id), ts: Date.now() }
    }

    await actualizarPromedio(snapshot.usuario_id)
    return { error: null }
  }, [notas])

  return { notas, loading, error, init, refresh, addNotaOptimistic, deleteNotaOptimistic }
}
