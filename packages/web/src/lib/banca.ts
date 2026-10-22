// La banca de Juegos (api/_juegos/banca.mjs): avisos de dinero y mensajes del master, y el Admin Abuse.
import { supabase } from './supabase'

export type AbuseMode = 'x2' | 'x3' | 'gratis'
export type AbuseScope = 'todo' | 'poker'

export interface Abuse {
  modo: AbuseMode
  ambito: AbuseScope
  desde: number
  hasta: number
}

export interface Aviso {
  id: number
  tipo: 'dinero' | 'mensaje'
  importe: number | null
  texto: string | null
  todos: boolean
}

export interface Jugador {
  id: string
  name: string
  avatar: string | null
  balance: number | null
}

export interface BancaReply {
  banca?: {
    avisos?: Aviso[]
    abuso?: Abuse | null
    master?: boolean
    ahora?: number
    gente?: Jugador[]
    hecho?: 'dinero' | 'mensaje'
    personas?: number
  }
}

export const BANK_TOPIC = 'juegos-banca'
export const ABUSE_MINUTES = [5, 10, 30, 60] as const

// Una llamada a la banca. Lanza un Error con el mensaje del servidor si algo falla.
export async function bancaCall(msg: Record<string, unknown>): Promise<BancaReply> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const res = await fetch('/api/juegos', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(msg),
  })
  const body = await res.json().catch(() => null)
  if (!res.ok || !body) throw new Error(body?.error?.message ?? 'La banca no responde. Inténtalo de nuevo.')
  return body as BancaReply
}

export const eur = (n: number) => `${n.toLocaleString('es-ES')} €`

// Título grande y explicación de cada Admin Abuse.
export function abuseText(a: Pick<Abuse, 'modo' | 'ambito'>): { big: string; small: string } {
  const where = a.ambito === 'poker' ? 'SOLO EN PÓKER' : 'EN TODOS LOS JUEGOS'
  if (a.modo === 'gratis') {
    return { big: `TODO GRATIS ${where}`, small: 'Perder no cuesta: la banca te devuelve lo que pierdas.' }
  }
  const m = a.modo === 'x3' ? '×3' : '×2'
  return {
    big: `PROBABILIDAD ${m} ${where}`,
    small: a.ambito === 'poker' ? `Lo que ganes en el póker, ${m}.` : `Lo que ganes, ${m}, y suerte ${m} en el gacha.`,
  }
}
