import { useState, useCallback, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Mensaje, MensajePrivado } from '../lib/types'

// ── Public chat messages ──────────────────────────────────────────────────────

interface UsePublicMensajesReturn {
  mensajes: Mensaje[]
  avatares: Record<string, string | null>
  loading: boolean
  error: string | null
  enviar: (texto: string, usuarioId: string, autor: string) => Promise<void>
}

const PUBLIC_CACHE_TTL_MS = 0 // el chat público usa realtime, no cachear

export function usePublicMensajes(): UsePublicMensajesReturn {
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [avatares, setAvatares] = useState<Record<string, string | null>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    const controller = new AbortController()

    async function cargar() {
      try {
        const [msgsRes, usersRes] = await Promise.all([
          supabase
            .from('mensajes')
            .select('id, usuario_id, autor, texto, created_at')
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

    // Realtime subscription
    const channel = supabase
      .channel('public-chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes' }, payload => {
        if (!mountedRef.current) return
        setMensajes(prev => [...prev, payload.new as Mensaje])
      })
      .subscribe()

    return () => {
      mountedRef.current = false
      controller.abort()
      supabase.removeChannel(channel)
    }
  }, []) // solo se ejecuta al montar/desmontar

  const enviar = useCallback(async (texto: string, usuarioId: string, autor: string) => {
    if (!texto.trim()) return
    await supabase.from('mensajes').insert({ usuario_id: usuarioId, autor, texto: texto.trim() })
  }, [])

  // Silenciar la advertencia de PUBLIC_CACHE_TTL_MS no usado
  void PUBLIC_CACHE_TTL_MS

  return { mensajes, avatares, loading, error, enviar }
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

    // Filtro servidor: solo INSERT donde el receptor soy yo.
    // Los mensajes que yo envío se añaden via optimistic en `enviar`.
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
    // Optimistic: el filtro Realtime no captura mensajes propios (para_id != meId),
    // así que los añadimos inmediatamente al estado local.
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
