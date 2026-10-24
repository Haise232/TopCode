// Subasta a ciegas en vivo: una caja para todos cada auction.ROUND_MS (reglas en packages/web/src/juegos/auction.js).
// La caja (tipo y contenido) sale de HMAC(secreto, ronda), como la ruleta: el tipo se enseña desde el principio y el
// contenido no se suelta hasta que se cierran las pujas. Las pujas de cada uno van en juegos_solo (juego «auction»):
// { round, week, bid, at, paid, last }; la puja sale del saldo al hacerla y al cerrar se devuelve a quien no gana.
// Se paga sin temporizador: la primera petición que llega tras el cierre reparte (settleDue). Lo que gana la casa (la puja
// ganadora menos lo que llevaba la caja) va a la jaula del bingo. Las últimas subastas quedan en juegos_rondas.
//   auction   cualquiera: a «sync» o «bid» (amount: tu puja total en la ronda en curso; solo se puede subir)
import * as auction from '../../packages/web/src/juegos/auction.js'
import { hmacStream, uniform } from './solo.mjs'
import { weekOf } from './engine/week.mjs'

const GRACE_MS = 600 // pujas que salieron del navegador justo antes del cierre y llegan un poco tarde
const REVEAL_MS = auction.BID_MS + GRACE_MS
const HISTORY = 6

export const AUCTION_ERRORS = {
  AUCTION_CLOSED: 'Las pujas de esta caja ya están cerradas: puja por la siguiente.',
  AUCTION_LOW: 'Tu puja no llega al mínimo de esta caja (o es más baja que la que ya tenías).',
}

const boxes = new Map()
// La caja de una ronda: { tier, prize } (prize: índice en auction.PRIZES).
export function boxOf(secret, round) {
  const hit = boxes.get(round)
  if (hit) return hit
  const rand = uniform(hmacStream(secret, `subasta:${round}`))
  const box = auction.drawBox(rand(100), rand(1000))
  if (boxes.size > 2000) boxes.clear()
  boxes.set(round, box)
  return box
}

const revealAt = (round) => round * auction.ROUND_MS + REVEAL_MS

export function createAuction({ db, now, secret, move, feed }) {
  let nextCheck = 0

  const bidsOf = async (q, round, lock = false) =>
    (
      await q(
        `select s.usuario_id, s.estado, c.nombre, c.avatar from public.juegos_solo s join public.juegos_cuentas c on c.usuario_id = s.usuario_id
         where s.juego = 'auction' and s.estado->>'round' = $1 order by s.usuario_id${lock ? ' for update of s' : ''}`,
        [String(round)],
      )
    ).rows

  // Paga las rondas ya cerradas. Como mucho una consulta por ronda y por instancia mientras no hay nada que pagar.
  async function settleDue() {
    const t = now()
    if (t < nextCheck) return
    const { rows } = await db.query(
      `select distinct (estado->>'round')::bigint as round from public.juegos_solo where juego = 'auction' and estado->>'paid' = 'false'`,
    )
    for (const r of rows.map((row) => Number(row.round)).sort((a, b) => a - b)) if (t >= revealAt(r)) await pay(r)
    const { round, phase } = auction.phaseAt(t)
    nextCheck = phase === 'bid' ? revealAt(round) : revealAt(round + 1)
  }

  async function pay(round) {
    const week = weekOf(now()).key
    await db.tx(async (q) => {
      const rows = (await bidsOf(q, round, true)).filter((r) => r.estado.paid === false)
      if (!rows.length) return
      // Pujas de otra semana: el saldo ya se reinició, no se devuelve ni se paga nada.
      const stale = rows.some((r) => r.estado.week !== week)
      const box = boxOf(secret, round)
      const bids = rows.map((r) => ({ owner: r.usuario_id, name: r.nombre, avatar: r.avatar, amount: Number(r.estado.bid), at: Number(r.estado.at) }))
      const win = auction.winnerOf(bids)
      const prize = auction.prizeAmount(box.tier, box.prize)
      const deltas = {}
      if (!stale) {
        for (const b of bids) deltas[b.owner] = b === win ? prize : b.amount
        const real = Object.fromEntries(Object.entries(deltas).filter(([, d]) => d > 0))
        if (Object.keys(real).length) await move(q, real)
        if (win.amount > prize) await feed(q, win.amount - prize)
      }
      for (const r of rows) {
        const mine = bids.find((b) => b.owner === r.usuario_id)
        const won = mine === win
        const last = { round, tier: box.tier, prize: box.prize, bid: mine.amount, won, payout: won ? prize : mine.amount, net: won ? prize - mine.amount : 0 }
        await q(`update public.juegos_solo set estado = $3, actualizado = now() where usuario_id = $1 and juego = $2`, [r.usuario_id, 'auction', { ...r.estado, paid: true, last }])
      }
      const entry = {
        tier: box.tier,
        prize: box.prize,
        amount: prize,
        winner: { name: win.name, avatar: win.avatar ?? null, bid: win.amount },
        bids: bids.length,
      }
      await q(
        `insert into public.juegos_rondas (juego, ronda, datos) values ('auction', $1, $2) on conflict (juego, ronda) do nothing`,
        [round, JSON.stringify(entry)],
      )
    })
  }

  async function history() {
    const { rows } = await db.query(`select ronda, datos from public.juegos_rondas where juego = 'auction' order by ronda desc limit ${HISTORY}`)
    return rows.map((r) => ({ round: Number(r.ronda), ...r.datos }))
  }

  async function savedOf(q, userId, lock = false) {
    return (await q(`select estado from public.juegos_solo where usuario_id = $1 and juego = 'auction'${lock ? ' for update' : ''}`, [userId])).rows[0]?.estado ?? null
  }

  // Pujar: amount es tu puja total en la ronda; se cobra la diferencia con la que ya tenías. Devuelve un código de error o null.
  async function bid(user, amount) {
    const t = now()
    const { round, offset } = auction.phaseAt(t)
    if (offset >= auction.BID_MS + GRACE_MS) return 'AUCTION_CLOSED'
    const box = boxOf(secret, round)
    if (!auction.validBid(box.tier, amount)) return Number.isInteger(amount) ? 'AUCTION_LOW' : 'BAD_MESSAGE'
    const week = weekOf(t).key
    return db.tx(async (q) => {
      const saved = await savedOf(q, user.id, true)
      if (saved && saved.paid === false && saved.round !== round) return 'BUSY'
      const before = saved?.round === round ? Number(saved.bid ?? 0) : 0
      if (amount <= before) return 'AUCTION_LOW'
      if (!(await move(q, { [user.id]: -(amount - before) }, true))) return 'INSUFFICIENT_FUNDS'
      await q(
        `insert into public.juegos_solo (usuario_id, juego, estado) values ($1, 'auction', $2)
         on conflict (usuario_id, juego) do update set estado = excluded.estado, actualizado = now()`,
        [user.id, { round, week, bid: amount, at: before ? Number(saved.at) : t, paid: false, last: saved?.last ?? null }],
      )
      return null
    })
  }

  // Lo que ve la pantalla: la caja de la ronda, cuántos pujan, tu puja y, al cerrar, qué llevaba y todas las pujas.
  async function view(userId, saved, balance) {
    const t = now()
    const { round, phase } = auction.phaseAt(t)
    const box = boxOf(secret, round)
    const revealed = t >= revealAt(round)
    const [rows, past] = await Promise.all([bidsOf((sql, params) => db.query(sql, params), round), history()])
    const bids = rows.map((r) => ({ owner: r.usuario_id, name: r.nombre, avatar: r.avatar ?? null, amount: Number(r.estado.bid), at: Number(r.estado.at) }))
    const win = revealed ? auction.winnerOf(bids) : null
    return {
      now: t,
      round,
      phase,
      tier: box.tier,
      min: auction.minBid(box.tier),
      bidders: bids.length,
      bid: saved?.round === round ? Number(saved.bid) : 0,
      result: revealed
        ? {
            prize: box.prize,
            amount: auction.prizeAmount(box.tier, box.prize),
            winner: win ? { name: win.name, avatar: win.avatar, bid: win.amount, me: win.owner === userId } : null,
            bids: bids
              .sort((a, b) => b.amount - a.amount || a.at - b.at)
              .map((b) => ({ name: b.name, avatar: b.avatar, amount: b.amount, me: b.owner === userId })),
          }
        : null,
      history: past,
      last: saved?.last ?? null,
      balance,
    }
  }

  async function handle(user, msg, reply) {
    await settleDue()
    if (msg.a === 'bid') {
      const error = await bid(user, msg.amount)
      if (error) reply.error = { code: error }
    } else if (msg.a !== 'sync') {
      reply.error = { code: 'BAD_MESSAGE' }
    }
    const balance = Number((await db.query(`select saldo from public.juegos_cuentas where usuario_id = $1`, [user.id])).rows[0]?.saldo ?? 0)
    reply.me.balance = balance
    reply.auction = await view(user.id, await savedOf((sql, params) => db.query(sql, params), user.id), balance)
    return reply
  }

  // Reinicio del domingo: se borra el historial de subastas (las pujas se van con juegos_solo).
  const sweep = (q) => q(`delete from public.juegos_rondas where juego = 'auction'`)

  return { handle, settleDue, sweep }
}
