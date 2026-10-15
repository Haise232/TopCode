// Juegos en solitario (ruleta, tragamonedas y blackjack contra el crupier) con el saldo semanal: el servidor sortea
// con randomInt y aplica las mismas reglas puras que pinta la pantalla (packages/web/src/juegos/*.js), así el
// navegador no puede elegir su resultado. Cada función devuelve { error } o el resultado con `delta`, lo que cambia
// el saldo, y `saved`, lo que hay que guardar para la siguiente jugada (racha y apuesta de la ruleta, mano del blackjack).
import { createHmac } from 'node:crypto'
import * as roulette from '../../packages/web/src/juegos/roulette.js'
import * as slots from '../../packages/web/src/juegos/slots.js'
import * as blackjack from '../../packages/web/src/juegos/blackjack.js'

export const SOLO_GAMES = { solo_roulette: 'roulette', solo_slots: 'slots', solo_blackjack: 'blackjack' }

// --- Ruleta en vivo: una sola rueda para todos que gira cada ROUND_MS, como en un casino en directo. ---
// Cada ronda empieza en un múltiplo de ROUND_MS desde 1970: abre apuestas, «no va más», la bola gira y se ve el número.
// El número y los relámpago de la ronda salen de un HMAC con un secreto del servidor: todos ven el mismo, no hace falta
// guardar cada tirada y nadie puede calcularlo antes de tiempo. El servidor no lo revela hasta REVEAL_MS.
export const { ROUND_MS, BETS_MS, SPIN_MS } = roulette
const GRACE_MS = 600 // apuestas que salieron del navegador justo antes del «no va más» y llegan un poco tarde
const REVEAL_MS = BETS_MS + GRACE_MS
const HISTORY = 100
const draws = new Map()

export const roundOf = (t) => Math.floor(t / ROUND_MS)
const revealAt = (round) => round * ROUND_MS + REVEAL_MS

// Sorteo de una ronda: enteros uniformes (rechazo) a partir de HMAC(secreto, ronda, bloque).
export function drawRound(secret, round) {
  const key = `${round}`
  const hit = draws.get(key)
  if (hit) return hit
  let block = 0
  let bytes = Buffer.alloc(0)
  let pos = 0
  const next32 = () => {
    if (pos + 4 > bytes.length) {
      bytes = createHmac('sha256', secret).update(`ruleta:${round}:${block++}`).digest()
      pos = 0
    }
    const value = bytes.readUInt32BE(pos)
    pos += 4
    return value
  }
  const rand = (n) => {
    const limit = 2 ** 32 - (2 ** 32 % n)
    for (;;) {
      const value = next32()
      if (value < limit) return value % n
    }
  }
  const draw = { number: rand(roulette.WHEEL.length), lucky: roulette.pickLucky(rand) }
  if (draws.size > 5000) draws.clear()
  draws.set(key, draw)
  return draw
}

// Últimas tiradas ya reveladas, de la más reciente a la más antigua.
function history(secret, t) {
  const last = t >= revealAt(roundOf(t)) ? roundOf(t) : roundOf(t) - 1
  return { last, numbers: Array.from({ length: HISTORY }, (_, i) => drawRound(secret, last - i).number) }
}

// ¿Hay una apuesta guardada cuyo número ya se conoce? Entonces hay que pagarla antes de nada.
export const rouletteDue = (saved, t) => Boolean(saved?.bets?.length) && t >= revealAt(saved.round)

// Lo que ve la pantalla: reloj del servidor, ronda actual, tus fichas confirmadas y las últimas tiradas.
export function rouletteView(saved, balance, { now: t, secret }) {
  const round = roundOf(t)
  const revealed = t >= revealAt(round)
  const draw = revealed ? drawRound(secret, round) : null
  return {
    now: t,
    round,
    number: draw?.number ?? null,
    lucky: draw?.lucky ?? null,
    bets: saved?.round === round && !revealed ? (saved.bets ?? []) : [],
    streak: saved?.streak ?? 0,
    last: saved?.last ?? null,
    history: history(secret, t),
    balance,
  }
}

// msg.a: «sync» (ponerse al día) o «bet» (tus fichas de esta ronda; una lista vacía las retira).
export function rouletteLive(msg, balance, saved, _rand, ctx) {
  const t = ctx.now
  let state = { streak: 0, ...(saved ?? {}) }
  let delta = 0
  let changed = false
  // 1. Se paga la apuesta de una ronda que ya tiene número (si es de otra semana, el saldo ya se reinició: se descarta).
  if (rouletteDue(state, t)) {
    const placed = state.bets
    if (state.week === ctx.week) {
      const { number, lucky } = drawRound(ctx.secret, state.round)
      const result = roulette.settle(placed, number, lucky, state.streak)
      const stake = roulette.totalOf(placed)
      delta += result.payout + result.bonus
      state = { ...state, streak: result.streak, last: { round: state.round, number, stake, ...result } }
    }
    state = { ...state, bets: [] }
    changed = true
  }
  // 2. Fichas nuevas para la ronda en curso.
  if (msg.a === 'bet') {
    const round = roundOf(t)
    if (msg.round !== round || t >= round * ROUND_MS + BETS_MS + GRACE_MS) return { error: 'BETS_CLOSED' }
    const placed = Array.isArray(msg.bets) ? msg.bets : null
    if (!placed || (placed.length > 0 && !roulette.validBets(placed))) return { error: 'BAD_MESSAGE' }
    // Lo que ya tenías en esta ronda vuelve al saldo y se cobra la apuesta nueva entera.
    const before = state.round === round ? roulette.totalOf(state.bets ?? []) : 0
    const stake = roulette.totalOf(placed)
    if (stake - before > balance + delta) return { error: 'INSUFFICIENT_FUNDS' }
    delta += before - stake
    state = { ...state, round, week: ctx.week, bets: placed }
    changed = true
  } else if (msg.a !== 'sync') {
    return { error: 'BAD_MESSAGE' }
  }
  return {
    delta,
    played: changed,
    saved: changed ? state : null,
    result: rouletteView(state, balance + delta, ctx),
  }
}

export function slotsSpin(msg, balance, _saved, rand) {
  if (!slots.validBet(msg.bet)) return { error: 'BAD_MESSAGE' }
  if (msg.bet > balance) return { error: 'INSUFFICIENT_FUNDS' }
  const stops = slots.spinStops(rand)
  const { payout } = slots.evaluate(stops, msg.bet)
  const delta = payout - msg.bet
  return { delta, played: true, saved: null, result: { stops, payout, balance: balance + delta } }
}

const BJ_ACTIONS = { hit: 'HIT', stand: 'STAND', double: 'DOUBLE', split: 'SPLIT' }

export function blackjackPlay(msg, balance, saved, rand) {
  // El saldo de la partida es siempre el de la cuenta (puede haber cambiado jugando en otra mesa).
  const state = { ...(saved ?? { ...blackjack.initialState, shoe: [] }), bank: balance }
  let next = state
  if (msg.a === 'deal') {
    if (state.phase !== 'idle') return { error: 'BAD_PHASE' }
    if (!blackjack.validBet(msg.bet, balance)) return { error: msg.bet > balance ? 'INSUFFICIENT_FUNDS' : 'BAD_MESSAGE' }
    next = blackjack.reducer({ ...state, bet: msg.bet }, { type: 'DEAL', shoe: state.shoe.length < blackjack.CUT ? blackjack.newShoe(rand) : undefined })
  } else if (Object.hasOwn(BJ_ACTIONS, msg.a)) {
    next = blackjack.reducer(state, { type: BJ_ACTIONS[msg.a] })
    if (next === state) return { error: 'BAD_PHASE' }
  } else if (msg.a !== 'view') {
    return { error: 'BAD_MESSAGE' }
  }
  // El crupier juega de una vez; la pantalla lo anima carta a carta.
  for (let i = 0; next.phase === 'dealer' && i < 30; i++) next = blackjack.reducer(next, { type: 'DEALER_STEP' })
  const delta = next.bank - balance
  return { delta, played: msg.a !== 'view', saved: next, result: blackjack.viewOf(next) }
}

export const SOLO_PLAY = { roulette: rouletteLive, slots: slotsSpin, blackjack: blackjackPlay }
