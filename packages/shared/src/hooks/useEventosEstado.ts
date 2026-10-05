import { useState, useCallback, useEffect, useRef } from 'react'
import { getSupabase } from '../lib/supabase'

interface Options {
  usuarioId: string | undefined
  clase: string | null | undefined
  /** Si es true se calculan también las estadísticas de la clase (admins). */
  isAdmin: boolean
  /** IDs de eventos (actividad/trabajo) sobre los que consultar el estado. */
  eventoIds: string[]
}

export interface UseEventosEstadoReturn {
  /** evento_id -> completada, para el usuario actual */
  estados: Record<string, boolean>
  /** evento_id -> nº de alumnos que la completaron (solo admin) */
  statsAdmin: Record<string, number>
  totalAlumnos: number
  toggling: string | null
  toggle: (eventoId: string) => Promise<{ error: string | null }>
  refresh: () => Promise<void>
}

export function useEventosEstado({ usuarioId, clase, isAdmin, eventoIds }: Options): UseEventosEstadoReturn {
  const [estados, setEstados] = useState<Record<string, boolean>>({})
  const [statsAdmin, setStatsAdmin] = useState<Record<string, number>>({})
  const [totalAlumnos, setTotalAlumnos] = useState(0)
  const [toggling, setToggling] = useState<string | null>(null)
  const mountedRef = useRef(true)
  const estadosRef = useRef(estados)
  estadosRef.current = estados

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const idsKey = eventoIds.join(',')

  const refresh = useCallback(async () => {
    if (!usuarioId) return
    const supabase = getSupabase()
    const ids = idsKey ? idsKey.split(',') : []

    const { data } = await supabase
      .from('eventos_estado')
      .select('evento_id, completada')
      .eq('usuario_id', usuarioId)
    if (!mountedRef.current) return
    if (data) {
      const map: Record<string, boolean> = {}
      data.forEach((e: { evento_id: string; completada: boolean }) => { map[e.evento_id] = e.completada })
      setEstados(map)
    }

    if (isAdmin && clase && ids.length > 0) {
      const [statsRes, usersRes] = await Promise.all([
        supabase.from('eventos_estado').select('evento_id').eq('completada', true).in('evento_id', ids),
        supabase.from('usuarios').select('id', { count: 'exact', head: true }).eq('clase', clase),
      ])
      if (!mountedRef.current) return
      if (statsRes.data) {
        const counts: Record<string, number> = {}
        statsRes.data.forEach((e: { evento_id: string }) => {
          counts[e.evento_id] = (counts[e.evento_id] ?? 0) + 1
        })
        setStatsAdmin(counts)
      }
      setTotalAlumnos(usersRes.count ?? 0)
    }
  }, [usuarioId, clase, isAdmin, idsKey])

  useEffect(() => { refresh() }, [refresh])

  const toggle = useCallback(async (eventoId: string): Promise<{ error: string | null }> => {
    if (!usuarioId) return { error: 'Sin sesión' }
    const actual = estadosRef.current[eventoId] ?? false
    const nuevo = !actual
    setToggling(eventoId)
    setEstados(prev => ({ ...prev, [eventoId]: nuevo }))
    const { error } = await getSupabase().from('eventos_estado').upsert({
      evento_id: eventoId,
      usuario_id: usuarioId,
      completada: nuevo,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'evento_id,usuario_id' })
    if (mountedRef.current) setToggling(null)
    if (error) {
      if (mountedRef.current) setEstados(prev => ({ ...prev, [eventoId]: actual }))
      return { error: error.message }
    }
    return { error: null }
  }, [usuarioId])

  return { estados, statsAdmin, totalAlumnos, toggling, toggle, refresh }
}
