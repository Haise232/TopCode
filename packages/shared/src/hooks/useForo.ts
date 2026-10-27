import { useState, useEffect, useCallback } from 'react'
import { getSupabase } from '../lib/supabase'
import { ForoPost, ForoRespuesta } from '../lib/types'

// ── Lista de posts ────────────────────────────────────────────────────────────

interface UseForoPostsReturn {
  posts: ForoPost[]
  loading: boolean
  error: string | null
  createPost: (data: { usuario_id: string; autor: string; titulo: string; cuerpo: string; materia: string }) => Promise<{ error: string | null; id?: string }>
  markResuelto: (id: string) => Promise<{ error: string | null }>
  deletePost: (id: string) => Promise<{ error: string | null }>
  refresh: () => void
}

export function useForoPosts(): UseForoPostsReturn {
  const [posts, setPosts] = useState<ForoPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const cargar = async () => {
      try {
        const { data, error: e } = await getSupabase()
          .from('foro_posts')
          .select('*, foro_respuestas(id)')
          .order('created_at', { ascending: false })
        if (cancelled) return
        if (e) setError(e.message)
        else setPosts((data ?? []) as ForoPost[])
      } catch {
        if (!cancelled) setError('No se pudieron cargar las publicaciones.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    cargar()
    return () => { cancelled = true }
  }, [tick])

  const createPost = useCallback(async (data: { usuario_id: string; autor: string; titulo: string; cuerpo: string; materia: string }) => {
    const { data: inserted, error: e } = await getSupabase()
      .from('foro_posts')
      .insert(data)
      .select('id')
      .single()
    if (!e) setTick(t => t + 1)
    return { error: e?.message ?? null, id: (inserted as { id: string } | null)?.id }
  }, [])

  const markResuelto = useCallback(async (id: string) => {
    const { error: e } = await getSupabase().from('foro_posts').update({ resuelto: true }).eq('id', id)
    if (!e) setPosts(prev => prev.map(p => p.id === id ? { ...p, resuelto: true } : p))
    return { error: e?.message ?? null }
  }, [])

  const deletePost = useCallback(async (id: string) => {
    const { error: e } = await getSupabase().from('foro_posts').delete().eq('id', id)
    if (!e) setPosts(prev => prev.filter(p => p.id !== id))
    return { error: e?.message ?? null }
  }, [])

  return { posts, loading, error, createPost, markResuelto, deletePost, refresh: () => setTick(t => t + 1) }
}

// ── Post individual + respuestas ──────────────────────────────────────────────

interface UseForoPostReturn {
  post: ForoPost | null
  respuestas: ForoRespuesta[]
  loading: boolean
  error: string | null
  addRespuesta: (data: { usuario_id: string; autor: string; cuerpo: string }) => Promise<{ error: string | null }>
  markSolucion: (respuestaId: string) => Promise<{ error: string | null }>
  markResuelto: () => Promise<{ error: string | null }>
  refresh: () => void
}

export function useForoPost(id: string): UseForoPostReturn {
  const [post, setPost] = useState<ForoPost | null>(null)
  const [respuestas, setRespuestas] = useState<ForoRespuesta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!id) {
      setError('Publicación no válida.')
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    const supabase = getSupabase()

    const cargar = async () => {
      try {
        const [postRes, respRes] = await Promise.all([
          supabase.from('foro_posts').select('*').eq('id', id).single(),
          supabase.from('foro_respuestas').select('*').eq('post_id', id).order('created_at', { ascending: true }),
        ])
        if (cancelled) return
        if (postRes.error) {
          setError(postRes.error.message)
          return
        }
        setPost(postRes.data as ForoPost)
        setRespuestas((respRes.data ?? []) as ForoRespuesta[])
      } catch {
        if (!cancelled) setError('No se pudo cargar la publicación.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    cargar()

    return () => { cancelled = true }
  }, [id, tick])

  const addRespuesta = useCallback(async (data: { usuario_id: string; autor: string; cuerpo: string }) => {
    const { error: e } = await getSupabase().from('foro_respuestas').insert({ ...data, post_id: id })
    if (!e) setTick(t => t + 1)
    return { error: e?.message ?? null }
  }, [id])

  const markSolucion = useCallback(async (respuestaId: string) => {
    const supabase = getSupabase()
    await supabase.from('foro_respuestas').update({ es_solucion: false }).eq('post_id', id)
    const { error: e } = await supabase.from('foro_respuestas').update({ es_solucion: true }).eq('id', respuestaId)
    if (!e) setRespuestas(prev => prev.map(r => ({ ...r, es_solucion: r.id === respuestaId })))
    return { error: e?.message ?? null }
  }, [id])

  const markResuelto = useCallback(async () => {
    const { error: e } = await getSupabase().from('foro_posts').update({ resuelto: true }).eq('id', id)
    if (!e) setPost(prev => prev ? { ...prev, resuelto: true } : prev)
    return { error: e?.message ?? null }
  }, [id])

  return { post, respuestas, loading, error, addRespuesta, markSolucion, markResuelto, refresh: () => setTick(t => t + 1) }
}
