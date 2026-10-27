import { useState, useCallback, useRef, useEffect } from 'react'
import { getSupabase } from '../lib/supabase'
import { HorarioClase } from '../lib/types'
import { cacheGet, cacheSet } from '../lib/cache'

type HorarioInput = Omit<HorarioClase, 'id' | 'created_at' | 'clase'>
type HorarioUpdate = Partial<HorarioInput>

interface UseHorarioReturn {
  horario: HorarioClase[]
  porDia: Record<number, HorarioClase[]>
  loading: boolean
  error: string | null
  init: () => Promise<void>
  refresh: () => Promise<void>
  createClase: (input: HorarioInput) => Promise<{ error: string | null }>
  updateClase: (id: string, updates: HorarioUpdate) => Promise<{ error: string | null }>
  deleteClase: (id: string) => Promise<{ error: string | null }>
}

const CACHE_TTL_MS = 60_000

function sortHorario(list: HorarioClase[]): HorarioClase[] {
  return [...list].sort((a, b) =>
    a.dia_semana !== b.dia_semana
      ? a.dia_semana - b.dia_semana
      : a.hora_inicio.localeCompare(b.hora_inicio)
  )
}

function agrupar(list: HorarioClase[]): Record<number, HorarioClase[]> {
  const porDia: Record<number, HorarioClase[]> = {}
  for (const c of list) {
    (porDia[c.dia_semana] ??= []).push(c)
  }
  return porDia
}

export function useHorario(clase: string | null | undefined): UseHorarioReturn {
  const [horario, setHorario] = useState<HorarioClase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const cacheKey = clase ? `horario:${clase}` : null

  const fetchHorario = useCallback(async (force = false) => {
    const supabase = getSupabase()
    if (!clase) {
      setHorario([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    if (!force) {
      const cached = cacheGet<HorarioClase[]>(cacheKey!)
      if (cached !== null) {
        setHorario(cached)
        setLoading(false)
        return
      }
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('horario')
        .select('id, clase, dia_semana, hora_inicio, hora_fin, materia, codigo, created_at')
        .eq('clase', clase)
        .order('dia_semana', { ascending: true })
        .order('hora_inicio', { ascending: true })

      if (!mountedRef.current) return

      if (fetchError) {
        setError(fetchError.message)
        setLoading(false)
        return
      }

      const result = (data ?? []) as HorarioClase[]
      cacheSet(cacheKey!, result, CACHE_TTL_MS)
      setHorario(result)
      setError(null)
      setLoading(false)
    } catch {
      if (!mountedRef.current) return
      setError('No se pudo cargar el horario.')
      setLoading(false)
    }
  }, [clase, cacheKey])

  const init = useCallback(() => fetchHorario(false), [fetchHorario])
  const refresh = useCallback(async () => { setLoading(true); await fetchHorario(true) }, [fetchHorario])

  const createClase = useCallback(async (input: HorarioInput): Promise<{ error: string | null }> => {
    const supabase = getSupabase()
    if (!clase) return { error: 'Selecciona una clase primero' }

    try {
      const { data, error: insertError } = await supabase
        .from('horario')
        .insert({ ...input, clase })
        .select()
        .single()

      if (insertError) return { error: insertError.message }

      const real = data as HorarioClase
      const updated = sortHorario([...horario, real])
      setHorario(updated)
      if (cacheKey) cacheSet(cacheKey, updated, CACHE_TTL_MS)
      return { error: null }
    } catch {
      return { error: 'Error de conexión. Inténtalo de nuevo.' }
    }
  }, [clase, horario, cacheKey])

  const updateClase = useCallback(async (id: string, updates: HorarioUpdate): Promise<{ error: string | null }> => {
    const supabase = getSupabase()
    const snapshot = horario.find(c => c.id === id)
    const updated = sortHorario(horario.map(c => c.id === id ? { ...c, ...updates } : c))
    setHorario(updated)

    let updateError: string | null = null
    try {
      const { error } = await supabase.from('horario').update(updates).eq('id', id)
      if (error) updateError = error.message
    } catch {
      updateError = 'Error de conexión. Inténtalo de nuevo.'
    }
    if (updateError) {
      if (snapshot) setHorario(prev => sortHorario(prev.map(c => c.id === id ? snapshot : c)))
      return { error: updateError }
    }
    if (cacheKey) cacheSet(cacheKey, updated, CACHE_TTL_MS)
    return { error: null }
  }, [horario, cacheKey])

  const deleteClase = useCallback(async (id: string): Promise<{ error: string | null }> => {
    const supabase = getSupabase()
    const snapshot = horario.find(c => c.id === id)
    const updated = horario.filter(c => c.id !== id)
    setHorario(updated)

    let deleteError: string | null = null
    try {
      const { error } = await supabase.from('horario').delete().eq('id', id)
      if (error) deleteError = error.message
    } catch {
      deleteError = 'Error de conexión. Inténtalo de nuevo.'
    }
    if (deleteError) {
      if (snapshot) setHorario(prev => sortHorario([...prev, snapshot]))
      return { error: deleteError }
    }
    if (cacheKey) cacheSet(cacheKey, updated, CACHE_TTL_MS)
    return { error: null }
  }, [horario, cacheKey])

  return { horario, porDia: agrupar(horario), loading, error, init, refresh, createClase, updateClase, deleteClase }
}
