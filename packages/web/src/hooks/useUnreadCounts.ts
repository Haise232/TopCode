import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export interface UnreadCounts {
  chat: number        // mensajes públicos (último día)
  dm: number          // DMs no leídos desde última visita a /chat
  dmSenders: string[] // nombres de los remitentes con DMs no leídos
  actividades: number // actividades/trabajos creados desde última visita a la vista Actividades del calendario
  docs: number        // páginas de documentación creadas desde última visita a /docs
}

const LAST_CHAT_KEY  = (uid: string) => `lastChatVisit_${uid}`
const LAST_ACTS_KEY  = (uid: string) => `lastActsVisit_${uid}`
const LAST_DOCS_KEY  = (uid: string) => `lastDocsVisit_${uid}`
const UNREAD_CHANGED_EVENT = 'topcode:unread-changed'

function notifyUnreadCountsChanged() {
  window.dispatchEvent(new Event(UNREAD_CHANGED_EVENT))
}

export function markChatVisited(uid: string) {
  try {
    localStorage.setItem(LAST_CHAT_KEY(uid), new Date().toISOString())
    notifyUnreadCountsChanged()
  } catch { /* ignore */ }
}

export function markCalendarioActividadesVisited(uid: string) {
  try {
    localStorage.setItem(LAST_ACTS_KEY(uid), new Date().toISOString())
    notifyUnreadCountsChanged()
  } catch { /* ignore */ }
}

export function markDocsVisited(uid: string) {
  try {
    localStorage.setItem(LAST_DOCS_KEY(uid), new Date().toISOString())
    notifyUnreadCountsChanged()
  } catch { /* ignore */ }
}

export function useUnreadCounts() {
  const { usuario } = useAuth()
  const [counts, setCounts] = useState<UnreadCounts>({
    chat: 0, dm: 0, dmSenders: [], actividades: 0, docs: 0,
  })

  useEffect(() => {
    if (!usuario) return

    const uid = usuario.id

    async function fetchCounts() {
      const lastChatVisit = localStorage.getItem(LAST_CHAT_KEY(uid)) ?? new Date(0).toISOString()
      const lastActsVisit = localStorage.getItem(LAST_ACTS_KEY(uid)) ?? new Date(0).toISOString()
      const lastDocsVisit = localStorage.getItem(LAST_DOCS_KEY(uid)) ?? new Date(0).toISOString()

      const [chatRes, dmRes, actsRes, docsRes] = await Promise.all([
        supabase
          .from('mensajes')
          .select('id', { count: 'exact', head: true })
          .gt('created_at', lastChatVisit),
        supabase
          .from('mensajes_privados')
          .select('de_id, de_nombre')
          .eq('para_id', uid)
          .gt('created_at', lastChatVisit),
        supabase
          .from('eventos')
          .select('id', { count: 'exact', head: true })
          .in('tipo', ['actividad', 'trabajo'])
          .gt('created_at', lastActsVisit)
          .gte('fecha', new Date().toISOString().slice(0, 10)),
        supabase
          .from('docs_paginas')
          .select('id', { count: 'exact', head: true })
          .gt('created_at', lastDocsVisit)
          .neq('created_by', uid),
      ])

      const dmRows = (dmRes.data ?? []) as { de_id: string; de_nombre: string }[]
      const sendersMap = new Map<string, string>()
      dmRows.forEach(r => sendersMap.set(r.de_id, r.de_nombre))

      setCounts({
        chat: (chatRes.count ?? 0) + dmRows.length,
        dm: sendersMap.size,
        dmSenders: Array.from(sendersMap.values()),
        actividades: actsRes.count ?? 0,
        docs: docsRes.count ?? 0,
      })
    }

    fetchCounts()
    const id = setInterval(fetchCounts, 30000)
    window.addEventListener(UNREAD_CHANGED_EVENT, fetchCounts)
    return () => {
      clearInterval(id)
      window.removeEventListener(UNREAD_CHANGED_EVENT, fetchCounts)
    }
  }, [usuario])

  return counts
}
