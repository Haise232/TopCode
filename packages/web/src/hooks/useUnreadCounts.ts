import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export interface UnreadCounts {
  chat: number        // mensajes públicos (último día)
  dm: number          // DMs no leídos desde última visita a /chat
  dmSenders: string[] // nombres de los remitentes con DMs no leídos
  actividades: number
  news: number
}

const LAST_VISIT_KEY = (uid: string) => `lastChatVisit_${uid}`

export function markChatVisited(uid: string) {
  try { localStorage.setItem(LAST_VISIT_KEY(uid), new Date().toISOString()) } catch { /* ignore */ }
}

export function useUnreadCounts() {
  const { usuario } = useAuth()
  const [counts, setCounts] = useState<UnreadCounts>({
    chat: 0, dm: 0, dmSenders: [], actividades: 0, news: 0,
  })

  useEffect(() => {
    if (!usuario) return

    const uid = usuario.id

    async function fetchCounts() {
      const now = new Date().toISOString()
      const lastVisit = localStorage.getItem(LAST_VISIT_KEY(uid)) ?? new Date(0).toISOString()

      const [chatRes, dmRes, actsRes, newsRes] = await Promise.all([
        supabase
          .from('mensajes')
          .select('id', { count: 'exact', head: true })
          .gt('created_at', new Date(Date.now() - 86400000).toISOString()),
        supabase
          .from('mensajes_privados')
          .select('de_id, de_nombre')
          .eq('para_id', uid)
          .gt('created_at', lastVisit),
        supabase
          .from('actividades')
          .select('id', { count: 'exact', head: true })
          .gte('fecha_entrega', now),
        supabase
          .from('noticias')
          .select('id', { count: 'exact', head: true })
          .gt('created_at', new Date(Date.now() - 7 * 86400000).toISOString()),
      ])

      // Calcular remitentes únicos con DMs no leídos
      const dmRows = (dmRes.data ?? []) as { de_id: string; de_nombre: string }[]
      const sendersMap = new Map<string, string>()
      dmRows.forEach(r => sendersMap.set(r.de_id, r.de_nombre))
      const dmSenders = Array.from(sendersMap.values())

      setCounts({
        chat: chatRes.count ?? 0,
        dm: sendersMap.size,
        dmSenders,
        actividades: actsRes.count ?? 0,
        news: newsRes.count ?? 0,
      })
    }

    fetchCounts()
    const id = setInterval(fetchCounts, 30000)
    return () => clearInterval(id)
  }, [usuario])

  return counts
}
