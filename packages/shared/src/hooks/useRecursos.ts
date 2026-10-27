import { useState, useEffect, useCallback } from 'react'
import { getSupabase } from '../lib/supabase'
import { Recurso } from '../lib/types'

interface UseRecursosReturn {
  recursos: Recurso[]
  loading: boolean
  error: string | null
  addRecurso: (data: Omit<Recurso, 'id' | 'created_at'>) => Promise<{ error: string | null }>
  deleteRecurso: (id: string) => Promise<{ error: string | null }>
  refresh: () => void
}

export function useRecursos(): UseRecursosReturn {
  const [recursos, setRecursos] = useState<Recurso[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getSupabase()
      .from('recursos')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error: e }) => {
        if (cancelled) return
        if (e) setError(e.message)
        else setRecursos((data ?? []) as Recurso[])
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [tick])

  const addRecurso = useCallback(async (data: Omit<Recurso, 'id' | 'created_at'>) => {
    const { error: e } = await getSupabase().from('recursos').insert(data)
    if (!e) setTick(t => t + 1)
    return { error: e?.message ?? null }
  }, [])

  const deleteRecurso = useCallback(async (id: string) => {
    const { error: e } = await getSupabase().from('recursos').delete().eq('id', id)
    if (!e) setRecursos(prev => prev.filter(r => r.id !== id))
    return { error: e?.message ?? null }
  }, [])

  return { recursos, loading, error, addRecurso, deleteRecurso, refresh: () => setTick(t => t + 1) }
}
