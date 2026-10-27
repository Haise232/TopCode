import type { RealtimeChannel } from '@supabase/supabase-js'
import { getSupabase } from './supabase'

// Canales privados de Realtime (Broadcast) que alimentan los triggers de supabase/migracion_realtime_broadcast.sql.
// Supabase reutiliza el canal si dos componentes piden el mismo tema (p. ej. el aviso de mensaje privado y la
// conversación abierta escuchan los dos dm:<yo>), así que aquí hay un solo canal por tema con todos sus oyentes, y se
// cierra un momento después de que se vaya el último (un remontaje no lo cierra y lo vuelve a abrir).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (payload: any) => void

interface Tema {
  channel: RealtimeChannel
  handlers: Map<string, Set<Handler>>
  cierre: ReturnType<typeof setTimeout> | null
}

const CIERRE_MS = 2000
const temas = new Map<string, Tema>()

function abrir(topic: string): Tema {
  const existente = temas.get(topic)
  if (existente) {
    if (existente.cierre) clearTimeout(existente.cierre)
    existente.cierre = null
    return existente
  }
  const handlers = new Map<string, Set<Handler>>()
  const channel = getSupabase()
    .channel(topic, { config: { private: true } })
    .on('broadcast', { event: '*' }, ({ event, payload }) => {
      handlers.get(event)?.forEach(handler => handler(payload))
    })
  channel.subscribe()
  const tema = { channel, handlers, cierre: null }
  temas.set(topic, tema)
  return tema
}

// Escucha event en topic; devuelve la función para dejar de escuchar.
export function onBroadcast(topic: string, event: string, handler: Handler): () => void {
  const tema = abrir(topic)
  if (!tema.handlers.has(event)) tema.handlers.set(event, new Set())
  tema.handlers.get(event)!.add(handler)

  return () => {
    tema.handlers.get(event)?.delete(handler)
    if ([...tema.handlers.values()].some(set => set.size > 0)) return
    tema.cierre = setTimeout(() => {
      temas.delete(topic)
      getSupabase().removeChannel(tema.channel)
    }, CIERRE_MS)
  }
}

// Envía un aviso por un tema que ya se está escuchando (lo usa el «escribiendo…» del chat).
export function sendBroadcast(topic: string, event: string, payload: Record<string, unknown>): void {
  temas.get(topic)?.channel.send({ type: 'broadcast', event, payload })
}
