import { useCallback, useEffect, useRef, useState } from 'react'
import { getSupabase } from '../lib/supabase'
import type { Falta } from '../lib/types'

export type FaltaInput = Pick<Falta, 'modulo' | 'fecha' | 'hora_inicio'> & { justificada?: boolean }

/** Una falta justificada cuenta un 25 % menos que una sin justificar. */
export const PESO_JUSTIFICADA = 0.75

/** Horas que computa una falta para el límite. */
export const pesoFalta = (f: Pick<Falta, 'justificada'>) => (f.justificada ? PESO_JUSTIFICADA : 1)

const COLUMNAS = 'id, usuario_id, modulo, fecha, hora_inicio, justificada, created_at'

const ordenar = (l: Falta[]) =>
  [...l].sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.hora_inicio ?? '').localeCompare(a.hora_inicio ?? '') || b.created_at.localeCompare(a.created_at))

const mensaje = (err: unknown) => (err instanceof Error ? err.message : 'Error de conexión.')

/** Faltas del usuario con altas, bajas y cambios optimistas. */
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

  /**
   * Añade faltas (un día, una sesión o una importación). Una sesión ya apuntada
   * (mismo día y hora) no se duplica: solo se actualiza si cambia su justificación.
   */
  const anadir = useCallback(async (filas: FaltaInput[]): Promise<{ error: string | null; nuevas: number; actualizadas: number }> => {
    if (!usuarioId || filas.length === 0) return { error: null, nuevas: 0, actualizadas: 0 }
    const clave = (f: Pick<Falta, 'fecha' | 'hora_inicio'>) => `${f.fecha} ${f.hora_inicio}`
    const previas = new Map(actual.current.filter(f => f.hora_inicio).map(f => [clave(f), f]))
    const completas = filas.map(f => ({ ...f, justificada: f.justificada ?? false }))
    // Solo se envía lo nuevo y lo que cambia de justificación
    const enviar = completas.filter(f => {
      const p = f.hora_inicio ? previas.get(clave(f)) : undefined
      return !p || p.justificada !== f.justificada
    })
    if (enviar.length === 0) return { error: null, nuevas: 0, actualizadas: 0 }

    const temporales: Falta[] = enviar
      .filter(f => !(f.hora_inicio && previas.has(clave(f))))
      .map((f, i) => ({ ...f, id: `tmp-${Date.now()}-${i}`, usuario_id: usuarioId, created_at: new Date().toISOString() }))
    const tmp = new Set(temporales.map(t => t.id))
    setFaltas(prev => ordenar([...temporales, ...prev]))
    try {
      const { data, error: e } = await getSupabase()
        .from('faltas')
        .upsert(enviar.map(f => ({ ...f, usuario_id: usuarioId })), { onConflict: 'usuario_id,fecha,hora_inicio' })
        .select(COLUMNAS)
      if (e) throw new Error(e.message)
      const llegadas = (data ?? []) as Falta[]
      const porId = new Map(llegadas.map(f => [f.id, f]))
      const yaEstaban = new Set(actual.current.map(f => f.id))
      setFaltas(prev => ordenar([
        ...llegadas.filter(f => !yaEstaban.has(f.id)),
        ...prev.filter(f => !tmp.has(f.id)).map(f => porId.get(f.id) ?? f),
      ]))
      const nuevas = llegadas.filter(f => !yaEstaban.has(f.id)).length
      return { error: null, nuevas, actualizadas: llegadas.length - nuevas }
    } catch (err) {
      setFaltas(prev => prev.filter(f => !tmp.has(f.id)))
      return { error: mensaje(err), nuevas: 0, actualizadas: 0 }
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
      return { error: mensaje(err) }
    }
  }, [])

  /** Marca una falta como justificada o sin justificar. */
  const justificar = useCallback(async (id: string, justificada: boolean): Promise<{ error: string | null }> => {
    setFaltas(prev => prev.map(f => f.id === id ? { ...f, justificada } : f))
    try {
      const { error: e } = await getSupabase().from('faltas').update({ justificada }).eq('id', id)
      if (e) throw new Error(e.message)
      return { error: null }
    } catch (err) {
      setFaltas(prev => prev.map(f => f.id === id ? { ...f, justificada: !justificada } : f))
      return { error: mensaje(err) }
    }
  }, [])

  return { faltas, loading, error, refresh: cargar, anadir, borrar, justificar }
}
