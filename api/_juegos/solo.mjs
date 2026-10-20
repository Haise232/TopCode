// Juegos en solitario (ruleta, cohete, tragamonedas y Plinko) con el saldo semanal: el servidor sortea
// con randomInt y aplica las mismas reglas puras que pinta la pantalla (packages/web/src/juegos/*.js), así el
// navegador no puede elegir su resultado. Cada función devuelve { error } o el resultado con `delta`, lo que cambia
// el saldo, y `saved`, lo que hay que guardar para la siguiente jugada (racha y apuesta de la ruleta y del cohete).
import { createHmac } from 'node:crypto'
import * as roulette from '../../packages/web/src/juegos/roulette.js'
import * as slots from '../../packages/web/src/juegos/slots.js'
import * as plinko from '../../packages/web/src/juegos/plinko.js'
import * as crash from '../../packages/web/src/juegos/crash.js'

export const SOLO_GAMES = { solo_roulette: 'roulette', solo_slots: 'slots', solo_plinko: 'plinko', solo_crash: 'crash' }

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

// Enteros de 32 bits uniformes a partir de HMAC(secreto, etiqueta, bloque): nadie sin el secreto puede adelantarlos.
function hmacStream(secret, label) {
  let block = 0
  let bytes = Buffer.alloc(0)
  let pos = 0
  return () => {
    if (pos + 4 > bytes.length) {
      bytes = createHmac('sha256', secret).update(`${label}:${block++}`).digest()
      pos = 0
    }
    const value = bytes.readUInt32BE(pos)
    pos += 4
    return value
  }
}

// Sorteo de una ronda: enteros uniformes (rechazo) a partir de HMAC(secreto, ronda, bloque).
export function drawRound(secret, round) {
  const key = `${round}`
  const hit = draws.get(key)
  if (hit) return hit
  const next32 = hmacStream(secret, `ruleta:${round}`)
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
      const result = roulette.settle(placed, number, lucky, state.streak, state.floor)
      const stake = roulette.totalOf(placed)
      delta += result.payout + result.bonus
      state = { ...state, streak: result.streak, floor: result.floor, last: { round: state.round, number, stake, ...result } }
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

// Plinko: una bola por petición; el servidor sortea el recorrido entero y la pantalla solo lo anima.
export function plinkoDrop(msg, balance, _saved, rand) {
  if (!plinko.validBet(msg.bet) || !plinko.validRisk(msg.risk)) return { error: 'BAD_MESSAGE' }
  if (msg.bet > balance) return { error: 'INSUFFICIENT_FUNDS' }
  const path = plinko.dropPath(rand)
  const slot = plinko.slotOf(path)
  const payout = plinko.payoutOf(msg.bet, msg.risk, slot)
  const delta = payout - msg.bet
  return { delta, played: true, saved: null, result: { path, slot, payout, balance: balance + delta } }
}

// --- Cohete en vivo: un multiplicador que sube para todos a la vez; quien retira antes de que explote, cobra. ---
// Como la ruleta: rondas fijas de crash.ROUND_MS y el punto de explosión sale de HMAC(secreto, ronda). El servidor no lo
// revela hasta que el cohete ha explotado, y para retirar usa su propio reloj.
const CRASH_HISTORY = 30
const crashDraws = new Map()

// Dónde explota la ronda y a qué hora (ms del reloj del servidor).
export function crashDraw(secret, round) {
  const hit = crashDraws.get(round)
  if (hit) return hit
  const mult = crash.crashFromUniform(hmacStream(secret, `cohete:${round}`)() / 2 ** 32)
  const draw = { crash: mult, at: round * crash.ROUND_MS + crash.BETS_MS + crash.msFor(mult) }
  if (crashDraws.size > 5000) crashDraws.clear()
  crashDraws.set(round, draw)
  return draw
}

// ¿Hay una apuesta guardada de una ronda que ya explotó? Entonces se liquida antes de nada (retiro automático o perdida).
export const crashDue = (saved, t, secret) => saved?.bet > 0 && t >= crashDraw(secret, saved.round).at

// Cuánto esperar desde `t` hasta la explosión de la ronda en curso (0 si ya explotó o aún no ha despegado).
export function crashWaitMs(secret, t) {
  const round = crash.phaseAt(t).round
  const flightStart = round * crash.ROUND_MS + crash.BETS_MS
  if (t < flightStart) return 0
  return Math.max(0, crashDraw(secret, round).at - t)
}

export function crashView(saved, balance, { now: t, secret }) {
  const round = crash.phaseAt(t).round
  const draw = crashDraw(secret, round)
  const exploded = t >= draw.at
  const mine = saved?.round === round
  const newest = exploded ? round : round - 1
  return {
    now: t,
    round,
    crash: exploded ? draw.crash : null,
    bet: mine ? (saved.bet ?? 0) : 0,
    auto: mine ? (saved.auto ?? null) : null,
    last: saved?.last ?? null,
    history: { last: newest, crashes: Array.from({ length: CRASH_HISTORY }, (_, i) => crashDraw(secret, newest - i).crash) },
    balance,
  }
}

// msg.a: «sync» (ponerse al día), «bet» (bet y auto de esta ronda; bet 0 la retira) o «cashout» (retirar ya).
export function crashLive(msg, balance, saved, _rand, ctx) {
  const t = ctx.now
  let state = { ...(saved ?? {}) }
  let delta = 0
  let changed = false
  // 1. La apuesta de una ronda que ya explotó: cobra si tenía retiro automático por debajo de la explosión.
  if (crashDue(state, t, ctx.secret)) {
    if (state.week === ctx.week) {
      const { crash: at } = crashDraw(ctx.secret, state.round)
      const won = state.auto !== null && state.auto < at
      const paid = won ? crash.payout(state.bet, state.auto) : 0
      delta += paid
      state.last = { round: state.round, stake: state.bet, mult: won ? state.auto : null, auto: won, payout: paid, net: paid - state.bet }
    }
    state = { ...state, bet: 0, auto: null }
    changed = true
  }
  const { round, offset } = crash.phaseAt(t)
  if (msg.a === 'bet') {
    if (msg.round !== round || offset >= crash.BETS_MS + GRACE_MS) return { error: 'LAUNCHED' }
    const auto = msg.auto ?? null
    if (!crash.validBet(msg.bet) || !crash.validAuto(auto)) return { error: 'BAD_MESSAGE' }
    // Lo que ya tenías en esta ronda vuelve al saldo y se cobra la apuesta nueva entera.
    const before = state.round === round ? (state.bet ?? 0) : 0
    if (msg.bet === 0 && before === 0) return { delta, played: changed, saved: changed ? state : null, result: crashView(state, balance + delta, ctx) }
    if (msg.bet - before > balance + delta) return { error: 'INSUFFICIENT_FUNDS' }
    delta += before - msg.bet
    state = { ...state, round, week: ctx.week, bet: msg.bet, auto: msg.bet > 0 ? auto : null }
    changed = true
  } else if (msg.a === 'cashout') {
    // Llegó tarde: la apuesta de esta ronda ya se liquidó arriba porque el cohete explotó.
    if (changed && state.last?.round === round && msg.round === round) return { error: 'CRASHED' }
    if (msg.round !== round || state.round !== round || !(state.bet > 0) || state.week !== ctx.week) return { error: 'BAD_PHASE' }
    const flown = offset - crash.BETS_MS
    if (flown < 0) return { error: 'BAD_PHASE' }
    const draw = crashDraw(ctx.secret, round)
    if (t >= draw.at) return { error: 'CRASHED' }
    // Si el retiro automático ya se había alcanzado, manda él (se habría retirado antes).
    let mult = Math.min(crash.multiplierAt(flown), draw.crash - 1)
    if (state.auto !== null && state.auto <= mult) mult = state.auto
    const paid = crash.payout(state.bet, mult)
    delta += paid
    state = { ...state, bet: 0, auto: null, last: { round, stake: state.bet, mult, auto: false, payout: paid, net: paid - state.bet } }
    changed = true
  } else if (msg.a !== 'sync') {
    return { error: 'BAD_MESSAGE' }
  }
  return {
    delta,
    played: changed,
    saved: changed ? state : null,
    result: crashView(state, balance + delta, ctx),
  }
}

export const SOLO_PLAY = { roulette: rouletteLive, slots: slotsSpin, plinko: plinkoDrop, crash: crashLive }
