import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export interface UnreadCounts {
  chat: number
  actividades: number
  news: number
}

export function useUnreadCounts() {
  const { usuario } = useAuth()
  const [counts, setCounts] = useState<UnreadCounts>({ chat: 0, actividades: 0, news: 0 })

  useEffect(() => {
    if (!usuario) return

    async function fetchCounts() {
      const now = new Date().toISOString()

      const [chatRes, actsRes, newsRes] = await Promise.all([
        // Mensajes en chat público de las últimas 24h (simplificado)
        supabase.from('mensajes').select('id', { count: 'exact', head: true }).gt('created_at', new Date(Date.now() - 86400000).toISOString()),
        // Actividades pendientes
        supabase.from('actividades').select('id', { count: 'exact', head: true }).gte('fecha_entrega', now),
        // Noticias de los últimos 7 días
        supabase.from('noticias').select('id', { count: 'exact', head: true }).gt('created_at', new Date(Date.now() - 7 * 86400000).toISOString()),
      ])

      setCounts({
        chat: chatRes.count ?? 0,
        actividades: actsRes.count ?? 0,
        news: newsRes.count ?? 0,
      })
    }

    fetchCounts()
    const id = setInterval(fetchCounts, 60000)
    return () => clearInterval(id)
  }, [usuario])

  return counts
}
