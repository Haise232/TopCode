// Quién llama: el access token de Supabase de la sesión de TopCode (cabecera Authorization).
// Supabase Auth valida el token y la tabla usuarios dice si la cuenta está aprobada.
import { safeAvatar, shortName } from './engine/names.mjs'
import { JuegosError } from './game.mjs'

const TTL_MS = 60000
const STALE_MS = 10 * 60000 // si Supabase Auth no responde, se acepta un token comprobado en estos últimos minutos
const cache = new Map()

export function supabaseEnv() {
  return {
    url: (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/+$/, ''),
    anonKey: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '',
  }
}

export async function verifyUser(authorization, db) {
  const token = /^Bearer (.{20,4096})$/.exec(authorization ?? '')?.[1]
  if (!token) throw new JuegosError('AUTH_REQUIRED')
  const hit = cache.get(token)
  if (hit && hit.until > Date.now()) return hit.user

  const { url, anonKey } = supabaseEnv()
  let res
  try {
    res = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: anonKey, authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    })
  } catch (error) {
    // Supabase Auth tarda o no responde: si este token ya se comprobó hace poco, se sigue con él.
    if (hit && hit.until + STALE_MS > Date.now()) return hit.user
    throw error
  }
  if (res.status >= 500 && hit && hit.until + STALE_MS > Date.now()) return hit.user
  if (!res.ok) throw new JuegosError(res.status >= 500 ? 'AUTH_DOWN' : 'AUTH_INVALID')
  const { id } = await res.json()
  const perfil = (await db.query(`select nombre, avatar_url, estado_acceso from public.usuarios where id = $1`, [id])).rows[0]
  if (!perfil) throw new JuegosError('AUTH_INVALID')
  if (perfil.estado_acceso !== 'aprobado') throw new JuegosError('AUTH_PENDING')
  const user = { id, name: shortName(perfil.nombre) || 'Jugador', avatar: safeAvatar(perfil.avatar_url) }

  if (cache.size > 2000) cache.clear()
  cache.set(token, { user, until: Date.now() + TTL_MS })
  return user
}

// Aviso por Supabase Realtime (broadcast): solo dice «algo cambió»; cada cliente pide su propia vista.
// Canal público y sin datos, así que basta la clave pública de TopCode. event: «cambio» (la mesa) o «chat».
export async function ping(topic, event = 'cambio') {
  const { url, anonKey } = supabaseEnv()
  if (!url || !anonKey) return 0
  try {
    const res = await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { apikey: anonKey, authorization: `Bearer ${anonKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [{ topic, event, payload: { at: Date.now() } }] }),
      signal: AbortSignal.timeout(3000),
    })
    return res.status
  } catch {
    // Si el aviso falla, los clientes se ponen al día con su latido periódico.
    return 0
  }
}

// Comprobación de la configuración, sin datos ni secretos: ¿la base de datos es del mismo proyecto de Supabase que
// usa TopCode? ¿existen las tablas? ¿sale el aviso de Realtime?
export async function health(db, { sendPing = false } = {}) {
  const { url, anonKey } = supabaseEnv()
  const ref = /^https:\/\/([a-z0-9]+)\.supabase\.co$/.exec(url)?.[1] ?? null
  const pgUrl = process.env.JUEGOS_DATABASE_URL ?? ''
  const out = {
    supabaseUrl: Boolean(url && anonKey),
    databaseUrl: Boolean(pgUrl),
    sameProjectDb: Boolean(ref && pgUrl.includes(ref)),
  }
  try {
    const { rows } = await db.query(
      `select to_regclass('public.usuarios') is not null as usuarios, to_regclass('public.juegos_mesas') is not null as juegos`,
    )
    out.db = 'ok'
    out.tablaUsuarios = rows[0].usuarios
    out.tablasJuegos = rows[0].juegos
  } catch (error) {
    out.db = `error: ${error.code ?? error.message?.slice(0, 60)}`
  }
  if (sendPing) out.realtime = await ping('juegos-health')
  return out
}
