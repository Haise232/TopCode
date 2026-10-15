// Función de Vercel de juegos: POST /api/juegos con { t: 'hello' | 'lobby' | 'join_public' | 'bet' | … }.
import { createJuegos, JuegosError } from './_juegos/game.mjs'
import { createDb } from './_juegos/db.mjs'
import { health, ping, verifyUser } from './_juegos/auth.mjs'

const db = createDb()
const juegos = createJuegos({ db, ping })

export default async function handler(req, res) {
  res.setHeader('cache-control', 'no-store')
  if (req.method === 'GET') return res.status(200).json(await health(db, { sendPing: req.query?.ping === '1' }))
  if (req.method !== 'POST') return res.status(405).json({ error: { code: 'BAD_MESSAGE', message: 'Usa POST.' } })
  try {
    const user = await verifyUser(req.headers.authorization, db)
    const msg = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    return res.status(200).json(await juegos.handle(user, msg))
  } catch (error) {
    if (error instanceof JuegosError) {
      // AUTH_DOWN: Supabase Auth no respondió; con 503 el navegador reintenta en vez de pedir que recargues.
      const status = error.code === 'AUTH_DOWN' ? 503 : error.code.startsWith('AUTH_') ? (error.code === 'AUTH_PENDING' ? 403 : 401) : 400
      return res.status(status).json({ error: { code: error.code, message: error.message } })
    }
    // Choque entre dos peticiones a la vez sobre la misma mesa (bloqueo): el cliente reintenta.
    if (error?.code === '40P01' || error?.code === '55P03') {
      return res.status(409).json({ error: { code: 'BUSY', message: 'La mesa está muy concurrida, inténtalo de nuevo.' } })
    }
    console.error('juegos:', error)
    return res.status(500).json({ error: { code: 'SERVER', message: 'Error de juegos. Inténtalo de nuevo.' } })
  }
}
