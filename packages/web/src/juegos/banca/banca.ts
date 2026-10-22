// La banca de Juegos (api/_juegos/banca.mjs): avisos de dinero y mensajes del master, y el Admin Abuse.
import { supabase } from '../../lib/supabase'

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

export interface Movimiento {
  id: number
  tipo: 'dinero' | 'mensaje'
  importe: number | null
  texto: string | null
  at: number
  para: string | null // null: para todos
}

export interface BancaReply {
  banca?: {
    avisos?: Aviso[]
    abuso?: Abuse | null
    master?: boolean
    ahora?: number
    gente?: Jugador[]
    historial?: Movimiento[]
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

// 1.000 € con punto de miles también en las cifras de 4 dígitos (como money.js de Juegos).
export const eur = (n: number) => `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}\u00a0€`

// Lo que ofrece cada Admin Abuse, punto por punto (para la presentación a pantalla completa).
export function abusePerks(a: Pick<Abuse, 'modo' | 'ambito'>): string[] {
  const m = a.modo === 'x3' ? '×3' : '×2'
  if (a.modo === 'gratis') {
    return a.ambito === 'poker'
      ? ['Si pierdes una mano de póker, la banca te devuelve lo apostado', 'Lo que ganes, para ti']
      : ['Si pierdes en cualquier juego, la banca te lo devuelve', 'Lo que ganes, para ti', 'Tiradas del gacha gratis']
  }
  if (a.ambito === 'poker') return [`Todo lo que ganes en el póker, ${m}`, 'La banca pone la diferencia']
  return [
    `Premios ${m} en ruleta, cohete, carrera, plinko, rana, laberinto y sobornos`,
    `Blackjack y póker: lo que ganes, ${m}`,
    `Suerte ${m} en las tiradas del gacha`,
  ]
}

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
