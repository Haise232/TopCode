// Bingo en vivo: una partida para todos cada bingo.ROUND_MS (reglas en packages/web/src/juegos/bingo.js).
// Los cartones de cada uno se guardan en juegos_solo (juego «bingo»): { round, week, cards, paid, last }. El orden de las
// bolas sale de HMAC(secreto, ronda), como la ruleta, y el servidor no lo suelta hasta que se cierra la venta; a partir de
// ahí ya no se puede hacer nada, así que da igual que la pantalla lo conozca antes de que salgan las bolas.
// El bote (la jaula) está en juegos_bingo: lo alimentan el 25 % de los cartones y lo que se pierde en el resto del casino
// (feed), y se lo lleva quien cante bingo antes de la bola bingo.POT_BALL.
// Se paga sin temporizador: la primera petición que llega después de la bola del bingo reparte los premios (settleDue).
//   bingo   cualquiera: a «sync» (ponerse al día) o «buy» (n cartones más para la partida en curso)
import { randomInt } from 'node:crypto'
import * as bingo from '../../packages/web/src/juegos/bingo.js'
import { hmacStream, uniform } from './solo.mjs'
import { weekOf } from './engine/week.mjs'

const GRACE_MS = 600 // compras que salieron del navegador justo antes de cerrar la venta y llegan un poco tarde
const REVEAL_MS = bingo.BUY_MS + GRACE_MS + 400 // el orden de las bolas, ya sin compras posibles
const PAY_PAD_MS = 1200 // el pago, un poco después de que se vea la bola del bingo
const HISTORY = 10

export const BINGO_ERRORS = {
  BINGO_CLOSED: 'La venta de cartones está cerrada: compra para la siguiente partida.',
  BINGO_MAX: `Como mucho ${bingo.MAX_CARDS} cartones por partida.`,
}

const orders = new Map()

// Las 90 bolas de una partida en el orden en que salen (todos los órdenes igual de probables).
export function orderOf(secret, round) {
  const hit = orders.get(round)
  if (hit) return hit
  const rand = uniform(hmacStream(secret, `bingo:${round}`))
  const order = Array.from({ length: bingo.BALLS }, (_, i) => i + 1)
  for (let i = order.length - 1; i > 0; i--) {
    const j = rand(i + 1)
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  if (orders.size > 2000) orders.clear()
  orders.set(round, order)
  return order
}

const revealAt = (round) => bingo.startOf(round) + REVEAL_MS

export function createBingo({ db, now, secret, move }) {
  // Partidas ya cerradas (sus cartones no cambian): cartones, reparto y nombres, para no volver a calcularlo en cada vista.
  const rounds = new Map()
  let nextCheck = 0 // antes de esta hora no hay nada que pagar (en esta instancia)

  // Todos los cartones de una partida, en un orden fijo: [{ owner, name, cells }].
  async function cardsOf(q, round, lock = false) {
    const { rows } = await q(
      `select s.usuario_id, s.estado, c.nombre from public.juegos_solo s join public.juegos_cuentas c on c.usuario_id = s.usuario_id
       where s.juego = 'bingo' and s.estado->>'round' = $1 order by s.usuario_id${lock ? ' for update of s' : ''}`,
      [String(round)],
    )
    const cards = rows.flatMap((r) => (r.estado.cards ?? []).map((cells) => ({ owner: r.usuario_id, name: r.nombre, cells })))
    return { rows, cards }
  }

  // Reparto de una partida cerrada (sin el bote, que se mira al pagar): bolas de la línea y del bingo y quién gana.
  async function outcomeOf(round) {
    const hit = rounds.get(round)
    if (hit) return hit
    const { cards } = await cardsOf((sql, params) => db.query(sql, params), round)
    const result = bingo.settle(cards, orderOf(secret, round), 0)
    const winners = (list, key) =>
      list.map((i) => ({ name: cards[i].name, owner: cards[i].owner, amount: result.prizes[i][key] }))
    const outcome = {
      sold: result.sold,
      cards: cards.length,
      players: new Set(cards.map((c) => c.owner)).size,
      lineBall: result.lineBall,
      bingoBall: result.bingoBall,
      line: winners(result.line, 'line'),
      bingo: winners(result.bingo, 'bingo'),
      jackpot: result.bingoBall !== null && result.bingoBall <= bingo.POT_BALL, // con la jaula vacía no hay bote que dar
    }
    if (rounds.size > 50) rounds.clear()
    rounds.set(round, outcome)
    return outcome
  }

  // Lo que el resto del casino pierde va a la jaula (dentro de la transacción de esa jugada).
  async function feed(q, amount) {
    if (amount > 0) await q(`update public.juegos_bingo set bote = bote + $1 where id = 1`, [Math.round(amount)])
  }

  async function potRow() {
    const { rows } = await db.query(`select bote, historial from public.juegos_bingo where id = 1`)
    return { pot: Number(rows[0]?.bote ?? 0), history: rows[0]?.historial ?? [] }
  }

  // Paga las partidas cuya bola del bingo ya salió. Barato: en cada instancia mira la base de datos como mucho una vez
  // por partida (al cerrarse la venta) y cuando toca pagar.
  async function settleDue() {
    const t = now()
    if (t < nextCheck) return
    const { round, phase } = bingo.phaseAt(t)
    let next = phase === 'buy' ? revealAt(round) : revealAt(round + 1)
    const { rows } = await db.query(
      `select distinct (estado->>'round')::bigint as round from public.juegos_solo where juego = 'bingo' and estado->>'paid' = 'false'`,
    )
    for (const r of rows.map((row) => Number(row.round)).sort((a, b) => a - b)) {
      if (t < revealAt(r)) continue
      const outcome = await outcomeOf(r)
      const due = outcome.bingoBall === null ? revealAt(r) : bingo.ballAt(r, outcome.bingoBall) + PAY_PAD_MS
      if (t >= due) await pay(r)
      else next = Math.min(next, due)
    }
    nextCheck = next
  }

  async function pay(round) {
    const week = weekOf(now()).key
    await db.tx(async (q) => {
      const pot = Number((await q(`select bote from public.juegos_bingo where id = 1 for update`)).rows[0]?.bote ?? 0)
      const { rows, cards } = await cardsOf(q, round, true)
      const open = rows.filter((r) => r.estado.paid === false)
      if (!open.length) return
      // Cartones de otra semana: el saldo ya se reinició, no se paga nada.
      const stale = open.some((r) => r.estado.week !== week)
      const result = bingo.settle(stale ? [] : cards, orderOf(secret, round), pot)
      const won = new Map()
      cards.forEach((c, i) => {
        const p = result.prizes[i]
        if (!p) return
        const mine = won.get(c.owner) ?? { line: 0, bingo: 0, pot: 0 }
        mine.line += p.line
        mine.bingo += p.bingo
        mine.pot += p.pot
        won.set(c.owner, mine)
      })
      const deltas = {}
      for (const [owner, p] of won) if (p.line + p.bingo + p.pot > 0) deltas[owner] = p.line + p.bingo + p.pot
      if (Object.keys(deltas).length) await move(q, deltas)
      for (const r of open) {
        const p = won.get(r.usuario_id) ?? { line: 0, bingo: 0, pot: 0 }
        const stake = (r.estado.cards?.length ?? 0) * bingo.PRICE
        const payout = p.line + p.bingo + p.pot
        const last = { round, cards: r.estado.cards?.length ?? 0, stake, ...p, payout, net: payout - stake, lineBall: result.lineBall, bingoBall: result.bingoBall }
        await q(`update public.juegos_solo set estado = $3, actualizado = now() where usuario_id = $1 and juego = $2`, [
          r.usuario_id,
          'bingo',
          { ...r.estado, paid: true, last },
        ])
      }
      const names = (list) => [...new Set(list.map((i) => cards[i].name))]
      const entry = {
        round,
        sold: result.sold,
        lineBall: result.lineBall,
        bingoBall: result.bingoBall,
        line: names(result.line),
        bingo: names(result.bingo),
        jackpot: result.jackpot ? pot : 0,
      }
      await q(
        `update public.juegos_bingo set bote = $1, historial = (jsonb_build_array($2::jsonb) || historial) - ${HISTORY} where id = 1`,
        [result.potAfter, JSON.stringify(entry)],
      )
    })
  }

  // Lo que ve la pantalla del bingo.
  async function view(userId, saved, balance) {
    const t = now()
    const { round, phase, drawn } = bingo.phaseAt(t)
    const [{ pot, history }, counts] = await Promise.all([
      potRow(),
      t < revealAt(round)
        ? db.query(
            `select count(*)::int as players, coalesce(sum(jsonb_array_length(estado->'cards')), 0)::int as cards
             from public.juegos_solo where juego = 'bingo' and estado->>'round' = $1`,
            [String(round)],
          )
        : null,
    ])
    const outcome = t >= revealAt(round) ? await outcomeOf(round) : null
    const mine = saved?.round === round ? (saved.cards ?? []) : []
    return {
      now: t,
      round,
      phase,
      drawn: drawn ?? 0,
      pot,
      cards: mine,
      players: outcome ? outcome.players : counts.rows[0].players,
      sold: outcome ? outcome.cards : counts.rows[0].cards,
      draw: outcome
        ? {
            order: orderOf(secret, round),
            lineBall: outcome.lineBall,
            bingoBall: outcome.bingoBall,
            line: outcome.line.map(({ name, amount, owner }) => ({ name, amount, me: owner === userId })),
            bingo: outcome.bingo.map(({ name, amount, owner }) => ({ name, amount, me: owner === userId })),
            jackpot: outcome.jackpot,
          }
        : null,
      last: saved?.last ?? null,
      history,
      balance,
    }
  }

  async function savedOf(q, userId, lock = false) {
    return (await q(`select estado from public.juegos_solo where usuario_id = $1 and juego = 'bingo'${lock ? ' for update' : ''}`, [userId])).rows[0]?.estado ?? null
  }

  async function balanceOf(userId) {
    return Number((await db.query(`select saldo from public.juegos_cuentas where usuario_id = $1`, [userId])).rows[0]?.saldo ?? 0)
  }

  // Compra de n cartones más para la partida en curso. Devuelve un código de error o null.
  async function buy(user, n) {
    if (!Number.isInteger(n) || n < 1 || n > bingo.MAX_CARDS) return 'BAD_MESSAGE'
    const t = now()
    const { round, offset } = bingo.phaseAt(t)
    if (offset >= bingo.BUY_MS + GRACE_MS) return 'BINGO_CLOSED'
    const week = weekOf(t).key
    return db.tx(async (q) => {
      const saved = await savedOf(q, user.id, true)
      // Unos cartones de una partida anterior sin pagar no se pisan (settleDue los paga antes de llegar aquí).
      if (saved && saved.paid === false && saved.round !== round) return 'BUSY'
      const have = saved?.round === round ? (saved.cards ?? []) : []
      if (have.length + n > bingo.MAX_CARDS) return 'BINGO_MAX'
      const cost = n * bingo.PRICE
      if (!(await move(q, { [user.id]: -cost }, true))) return 'INSUFFICIENT_FUNDS'
      const cards = [...have, ...Array.from({ length: n }, () => bingo.makeCard(randomInt))]
      await feed(q, (cost * bingo.POT_PCT) / 100)
      await q(
        `insert into public.juegos_solo (usuario_id, juego, estado) values ($1, 'bingo', $2)
         on conflict (usuario_id, juego) do update set estado = excluded.estado, actualizado = now()`,
        [user.id, { round, week, cards, paid: false, last: saved?.last ?? null }],
      )
      return null
    })
  }

  async function handle(user, msg, reply) {
    await settleDue()
    if (msg.a === 'buy') {
      const error = await buy(user, msg.n)
      if (error) reply.error = { code: error }
    } else if (msg.a !== 'sync') {
      reply.error = { code: 'BAD_MESSAGE' }
    }
    const balance = await balanceOf(user.id)
    reply.me.balance = balance
    const saved = await savedOf((sql, params) => db.query(sql, params), user.id)
    reply.bingo = await view(user.id, saved, balance)
    return reply
  }

  // Para el menú: lo que hay en la jaula y el último bote que salió.
  async function summary() {
    const { pot, history } = await potRow()
    const t = now()
    const { round, phase } = bingo.phaseAt(t)
    return { pot, round, phase, next: phase === 'buy' ? bingo.drawStart(round) : bingo.startOf(round + 1), lastJackpot: history.find((h) => h.jackpot > 0) ?? null }
  }

  // Reinicio del domingo: los saldos vuelven a 15.000 € y la jaula se vacía con ellos.
  const sweep = (q) => q(`update public.juegos_bingo set bote = 0`)

  return { handle, feed, settleDue, summary, sweep }
}
