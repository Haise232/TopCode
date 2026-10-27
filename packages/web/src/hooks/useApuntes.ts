import { useState, useCallback, useRef } from 'react'
import { supabase, subirArchivo, eliminarArchivoStorage } from '../lib/supabase'
import type { ClaseId } from '@topcode/shared'

export type ApunteConAutor = {
  id: string
  usuario_id: string
  clase: ClaseId | null
  nombre: string
  url: string
  tipo: 'pdf' | 'imagen' | 'otro'
  materia: string | null
  created_at: string
  usuarios: { nombre: string; avatar_url: string | null } | null
}

interface UseApuntesReturn {
  apuntes: ApunteConAutor[]
  loading: boolean
  error: string | null
  subiendo: boolean
  init: () => Promise<void>
  refresh: () => Promise<void>
  subirApunte: (
    file: File,
    usuarioId: string,
    tipo: 'pdf' | 'imagen' | 'otro',
    materia?: string | null
  ) => Promise<{ error: string | null }>
  eliminarApunte: (ap: ApunteConAutor) => Promise<{ error: string | null }>
}

const CACHE_TTL_MS = 30_000

function normalizarNombre(nombre: string): string {
  try {
    const bytes = Uint8Array.from(nombre, c => c.charCodeAt(0))
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).normalize('NFC')
  } catch {
    return nombre.normalize('NFC')
  }
}

export function useApuntes(clase: ClaseId | null | undefined): UseApuntesReturn {
  const [apuntes, setApuntes] = useState<ApunteConAutor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [subiendo, setSubiendo] = useState(false)

  const cacheRef = useRef<{ data: ApunteConAutor[]; ts: number } | null>(null)
  const mountedRef = useRef(true)

  const fetchApuntes = useCallback(async (force = false) => {
    if (!force && cacheRef.current && Date.now() - cacheRef.current.ts < CACHE_TTL_MS) {
      if (mountedRef.current) {
        setApuntes(cacheRef.current.data)
        setLoading(false)
      }
      return
    }

    const controller = new AbortController()

    try {
      const { data, error: fetchError } = await supabase
        .from('apuntes')
        .select('*, usuarios(nombre, avatar_url)')
        .order('created_at', { ascending: false })
        .abortSignal(controller.signal)

      if (!mountedRef.current) return

      if (fetchError) { setError(fetchError.message); return }

      const result = (data ?? []) as ApunteConAutor[]
      cacheRef.current = { data: result, ts: Date.now() }
      setApuntes(result)
      setError(null)
    } catch (err: unknown) {
      if (!mountedRef.current) return
      const isAbort = err instanceof Error && err.name === 'AbortError'
      if (!isAbort) setError('Error de conexión')
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [])

  const init = useCallback(() => fetchApuntes(false), [fetchApuntes])

  const refresh = useCallback(async () => {
    setLoading(true)
    await fetchApuntes(true)
  }, [fetchApuntes])

  const subirApunte = useCallback(async (
    file: File,
    usuarioId: string,
    tipo: 'pdf' | 'imagen' | 'otro',
    materia?: string | null
  ): Promise<{ error: string | null }> => {
    if (file.size > 20 * 1024 * 1024) {
      return { error: 'El archivo no puede superar los 20 MB.' }
    }

    setSubiendo(true)
    try {
      const ext = file.name.split('.').pop() ?? 'bin'
      const path = `${usuarioId}/${Date.now()}.${ext}`
      const url = await subirArchivo(file, path)
      if (!url) return { error: 'No se pudo subir el archivo. Inténtalo de nuevo.' }

      const nombre = normalizarNombre(file.name)

      // Optimistic insert (sin autor porque no tenemos el objeto usuario aquí)
      const tempId = `temp-${Date.now()}`
      const tempApunte: ApunteConAutor = {
        id: tempId,
        usuario_id: usuarioId,
        clase: clase ?? null,
        nombre,
        url,
        tipo,
        materia: materia ?? null,
        created_at: new Date().toISOString(),
        usuarios: null,
      }
      setApuntes(prev => [tempApunte, ...prev])

      const { data, error: insertError } = await supabase
        .from('apuntes')
        .insert({ usuario_id: usuarioId, clase: clase ?? null, nombre, url, tipo, materia: materia ?? null })
        .select('*, usuarios(nombre, avatar_url)')
        .single()

      if (insertError) {
        setApuntes(prev => prev.filter(a => a.id !== tempId))
        return { error: 'El archivo se subió pero no se pudo registrar. Recarga la página.' }
      }

      const real = data as ApunteConAutor
      setApuntes(prev => prev.map(a => (a.id === tempId ? real : a)))
      if (cacheRef.current) {
        cacheRef.current = {
          data: [real, ...cacheRef.current.data],
          ts: Date.now(),
        }
      }
      return { error: null }
    } catch {
      return { error: 'No se pudo conectar. Inténtalo de nuevo.' }
    } finally {
      setSubiendo(false)
    }
  }, [clase])

  const eliminarApunte = useCallback(async (
    ap: ApunteConAutor
  ): Promise<{ error: string | null }> => {
    // Optimistic remove
    setApuntes(prev => prev.filter(a => a.id !== ap.id))

    try {
      const urlObj = new URL(ap.url)
      const storagePath = urlObj.pathname.split('/object/public/apuntes/')[1]
      if (storagePath) await eliminarArchivoStorage('apuntes', decodeURIComponent(storagePath))
    } catch {
      // Si falla el borrado del storage, continuamos con la DB
    }

    const { error: deleteError } = await supabase
      .from('apuntes')
      .delete()
      .eq('id', ap.id)

    if (deleteError) {
      // Revertir
      setApuntes(prev => [ap, ...prev].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ))
      return { error: deleteError.message }
    }

    if (cacheRef.current) {
      cacheRef.current = {
        data: cacheRef.current.data.filter(a => a.id !== ap.id),
        ts: Date.now(),
      }
    }
    return { error: null }
  }, [])

  return { apuntes, loading, error, subiendo, init, refresh, subirApunte, eliminarApunte }
}
