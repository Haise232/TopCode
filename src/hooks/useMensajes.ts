import { useState, useCallback, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Mensaje, MensajePrivado } from '../lib/types'

// ── Public chat messages ──────────────────────────────────────────────────────

interface UsePublicMensajesReturn {
  mensajes: Mensaje[]
  avatares: Record<string, string | null>
  loading: boolean
  error: string | null
  typingUsers: string[]
  enviar: (texto: string, usuarioId: string, autor: string) => Promise<void>
  editarMensaje: (id: string, nuevoTexto: string) => Promise<{ error: string | null }>
  eliminarMensaje: (id: string) => Promise<{ error: string | null }>
  emitirTyping: (nombre: string) => void
}

export function usePublicMensajes(): UsePublicMensajesReturn {
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [avatares, setAvatares] = useState<Record<string, string | null>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [typingUsers, setTypingUsers] = useState<string[]>([])

  const mountedRef = useRef(true)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const typingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    mountedRef.current = true
    const controller = new AbortController()

    async function cargar() {
      try {
        const [msgsRes, usersRes] = await Promise.all([
          supabase
            .from('mensajes')
            .select('id, usuario_id, autor, texto, editado, eliminado, created_at')
            .order('created_at', { ascending: true })
            .limit(100)
            .abortSignal(controller.signal),
          supabase
            .from('usuarios')
            .select('id, avatar_url')
            .abortSignal(controller.signal),
        ])

        if (!mountedRef.current) return

        if (msgsRes.error) { setError(msgsRes.error.message); return }

        setMensajes((msgsRes.data ?? []) as Mensaje[])
        const map: Record<string, string | null> = {}
        ;(usersRes.data ?? []).forEach((u: { id: string; avatar_url: string | null }) => {
          map[u.id] = u.avatar_url
        })
        setAvatares(map)
        setError(null)
      } catch (err: unknown) {
        if (!mountedRef.current) return
        const isAbort = err instanceof Error && err.name === 'AbortError'
        if (!isAbort) setError('Error de conexión')
      } finally {
        if (mountedRef.current) setLoading(false)
      }
    }

    cargar()

    const channel = supabase
      .channel('public-chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes' }, payload => {
        if (!mountedRef.current) return
        setMensajes(prev => [...prev, payload.new as Mensaje])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'mensajes' }, payload => {
        if (!mountedRef.current) return
        const updated = payload.new as Mensaje
        setMensajes(prev => prev.map(m => m.id === updated.id ? updated : m))
      })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (!mountedRef.current) return
        const nombre = payload?.nombre as string
        if (!nombre) return
        setTypingUsers(prev => prev.includes(nombre) ? prev : [...prev, nombre])
        if (typingTimers.current[nombre]) clearTimeout(typingTimers.current[nombre])
        typingTimers.current[nombre] = setTimeout(() => {
          setTypingUsers(prev => prev.filter(n => n !== nombre))
          delete typingTimers.current[nombre]
        }, 3000)
      })
      .subscribe()

    channelRef.current = channel

    return () => {
      mountedRef.current = false
      controller.abort()
      Object.values(typingTimers.current).forEach(clearTimeout)
      supabase.removeChannel(channel)
    }
  }, [])

  const enviar = useCallback(async (texto: string, usuarioId: string, autor: string) => {
    if (!texto.trim()) return
    await supabase.from('mensajes').insert({ usuario_id: usuarioId, autor, texto: texto.trim() })
  }, [])

  const editarMensaje = useCallback(async (id: string, nuevoTexto: string): Promise<{ error: string | null }> => {
    const texto = nuevoTexto.trim()
    if (!texto) return { error: 'El mensaje no puede estar vacío.' }
    // Optimistic
    setMensajes(prev => prev.map(m => m.id === id ? { ...m, texto, editado: true } : m))
    const { error: e } = await supabase
      .from('mensajes')
      .update({ texto, editado: true })
      .eq('id', id)
    if (e) {
      // Revert — re-fetch para restaurar el texto original
      supabase
        .from('mensajes')
        .select('id, usuario_id, autor, texto, editado, eliminado, created_at')
        .eq('id', id)
        .single()
        .then(({ data }) => {
          if (data) setMensajes(prev => prev.map(m => m.id === id ? data as Mensaje : m))
        })
      return { error: e.message }
    }
    return { error: null }
  }, [])

  const eliminarMensaje = useCallback(async (id: string): Promise<{ error: string | null }> => {
    setMensajes(prev => prev.map(m => m.id === id ? { ...m, eliminado: true } : m))
    const { error: e } = await supabase
      .from('mensajes')
      .update({ eliminado: true })
      .eq('id', id)
    if (e) {
      setMensajes(prev => prev.map(m => m.id === id ? { ...m, eliminado: false } : m))
      return { error: e.message }
    }
    return { error: null }
  }, [])

  const emitirTyping = useCallback((nombre: string) => {
    channelRef.current?.send({ type: 'broadcast', event: 'typing', payload: { nombre } })
  }, [])

  return { mensajes, avatares, loading, error, typingUsers, enviar, editarMensaje, eliminarMensaje, emitirTyping }
}

// ── Private chat messages ─────────────────────────────────────────────────────

interface UsePrivateMensajesOptions {
  meId: string
  peerId: string
}

interface UsePrivateMensajesReturn {
  mensajes: MensajePrivado[]
  loading: boolean
  error: string | null
  enviar: (texto: string, deNombre: string) => Promise<void>
}

export function usePrivateMensajes({ meId, peerId }: UsePrivateMensajesOptions): UsePrivateMensajesReturn {
  const [mensajes, setMensajes] = useState<MensajePrivado[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    const controller = new AbortController()

    async function cargar() {
      try {
        const { data, error: fetchError } = await supabase
          .from('mensajes_privados')
          .select('id, de_id, de_nombre, para_id, texto, created_at')
          .or(`and(de_id.eq.${meId},para_id.eq.${peerId}),and(de_id.eq.${peerId},para_id.eq.${meId})`)
          .order('created_at', { ascending: true })
          .limit(200)
          .abortSignal(controller.signal)

        if (!mountedRef.current) return

        if (fetchError) { setError(fetchError.message); return }

        setMensajes((data ?? []) as MensajePrivado[])
        setError(null)
      } catch (err: unknown) {
        if (!mountedRef.current) return
        const isAbort = err instanceof Error && err.name === 'AbortError'
        if (!isAbort) setError('Error de conexión')
      } finally {
        if (mountedRef.current) setLoading(false)
      }
    }

    cargar()

    const channelName = `private-${[meId, peerId].sort().join('-')}`
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mensajes_privados',
          filter: `para_id=eq.${meId}`,
        },
        payload => {
          if (!mountedRef.current) return
          const msg = payload.new as MensajePrivado
          if (msg.de_id === peerId) {
            setMensajes(prev => [...prev, msg])
          }
        },
      )
      .subscribe()

    return () => {
      mountedRef.current = false
      controller.abort()
      supabase.removeChannel(channel)
    }
  }, [meId, peerId])

  const enviar = useCallback(async (texto: string, deNombre: string) => {
    if (!texto.trim()) return
    const t = texto.trim()
    const optimista: MensajePrivado = {
      id: `tmp-${Date.now()}`,
      de_id: meId,
      de_nombre: deNombre,
      para_id: peerId,
      texto: t,
      created_at: new Date().toISOString(),
    }
    setMensajes(prev => [...prev, optimista])
    await supabase.from('mensajes_privados').insert({
      de_id: meId,
      de_nombre: deNombre,
      para_id: peerId,
      texto: t,
    })
  }, [meId, peerId])

  return { mensajes, loading, error, enviar }
}
