import { useCallback, useEffect, useRef, useState } from 'react'
import { getSupabase } from '../lib/supabase'
import type { Falta } from '../lib/types'

export type FaltaInput = Pick<Falta, 'modulo' | 'fecha' | 'hora_inicio'>

const COLUMNAS = 'id, usuario_id, modulo, fecha, hora_inicio, created_at'

const ordenar = (l: Falta[]) =>
  [...l].sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.hora_inicio ?? '').localeCompare(a.hora_inicio ?? '') || b.created_at.localeCompare(a.created_at))

/** Faltas del usuario con altas y bajas optimistas. */
export function useFaltas(usuarioId: string | undefined) {
  const [faltas, setFaltas] = useState<Falta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const vivo = useRef(true)
  const actual = useRef<Falta[]>([])
  actual.current = faltas

  useEffect(() => {
    vivo.current = true
    return () => { vivo.current = false }
  }, [])

  const cargar = useCallback(async () => {
    if (!usuarioId) { setFaltas([]); setLoading(false); return }
    setLoading(true)
    try {
      const { data, error: e } = await getSupabase()
        .from('faltas').select(COLUMNAS).eq('usuario_id', usuarioId)
        .order('fecha', { ascending: false })
      if (!vivo.current) return
      if (e) setError(e.message)
      else { setFaltas(ordenar((data ?? []) as Falta[])); setError(null) }
    } catch {
      if (vivo.current) setError('No se pudieron cargar las faltas.')
    } finally {
      if (vivo.current) setLoading(false)
    }
  }, [usuarioId])

  useEffect(() => { void cargar() }, [cargar])

  /** Añade varias horas de falta de golpe (un día, una sesión o una importación). Devuelve cuántas eran nuevas. */
  const anadir = useCallback(async (filas: FaltaInput[]): Promise<{ error: string | null; nuevas: number }> => {
    if (!usuarioId || filas.length === 0) return { error: null, nuevas: 0 }
    const temporales: Falta[] = filas.map((f, i) => ({
      ...f, id: `tmp-${Date.now()}-${i}`, usuario_id: usuarioId, created_at: new Date().toISOString(),
    }))
    setFaltas(prev => ordenar([...temporales, ...prev]))
    const ids = new Set(temporales.map(t => t.id))
    try {
      const { data, error: e } = await getSupabase()
        .from('faltas')
        // Las sesiones ya apuntadas (mismo día y hora) se ignoran: nunca se duplican
        .upsert(filas.map(f => ({ ...f, usuario_id: usuarioId })), { onConflict: 'usuario_id,fecha,hora_inicio', ignoreDuplicates: true })
        .select(COLUMNAS)
      if (e) throw new Error(e.message)
      setFaltas(prev => ordenar([...(data as Falta[]), ...prev.filter(f => !ids.has(f.id))]))
      return { error: null, nuevas: data?.length ?? 0 }
    } catch (err) {
      setFaltas(prev => prev.filter(f => !ids.has(f.id)))
      return { error: err instanceof Error ? err.message : 'Error de conexión.', nuevas: 0 }
    }
  }, [usuarioId])

  const borrar = useCallback(async (ids: string[]): Promise<{ error: string | null }> => {
    const quitar = new Set(ids)
    const copia = actual.current.filter(f => quitar.has(f.id))
    setFaltas(prev => prev.filter(f => !quitar.has(f.id)))
    try {
      const { error: e } = await getSupabase().from('faltas').delete().in('id', ids)
      if (e) throw new Error(e.message)
      return { error: null }
    } catch (err) {
      setFaltas(prev => ordenar([...copia, ...prev]))
      return { error: err instanceof Error ? err.message : 'Error de conexión.' }
    }
  }, [])

  return { faltas, loading, error, refresh: cargar, anadir, borrar }
}
