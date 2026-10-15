// Juegos en solitario (ruleta, tragamonedas y blackjack contra el crupier) con el saldo semanal: el servidor sortea
// con randomInt y aplica las mismas reglas puras que pinta la pantalla (packages/web/src/juegos/*.js), así el
// navegador no puede elegir su resultado. Cada función devuelve { error } o el resultado con `delta`, lo que cambia
// el saldo, y `saved`, lo que hay que guardar para la siguiente jugada (racha de la ruleta, mano del blackjack).
import * as roulette from '../../packages/web/src/juegos/roulette.js'
import * as slots from '../../packages/web/src/juegos/slots.js'
import * as blackjack from '../../packages/web/src/juegos/blackjack.js'

export const SOLO_GAMES = { solo_roulette: 'roulette', solo_slots: 'slots', solo_blackjack: 'blackjack' }

export function rouletteSpin(msg, balance, saved, rand) {
  const placed = msg.bets
  if (!roulette.validBets(placed)) return { error: 'BAD_MESSAGE' }
  const stake = roulette.totalOf(placed)
  if (stake > balance) return { error: 'INSUFFICIENT_FUNDS' }
  const number = rand(roulette.WHEEL.length)
  const lucky = roulette.pickLucky(rand)
  const result = roulette.settle(placed, number, lucky, saved?.streak ?? 0)
  const delta = result.payout + result.bonus - stake
  return { delta, saved: { streak: result.streak }, result: { number, lucky, ...result, balance: balance + delta } }
}

export function slotsSpin(msg, balance, _saved, rand) {
  if (!slots.validBet(msg.bet)) return { error: 'BAD_MESSAGE' }
  if (msg.bet > balance) return { error: 'INSUFFICIENT_FUNDS' }
  const stops = slots.spinStops(rand)
  const { payout } = slots.evaluate(stops, msg.bet)
  const delta = payout - msg.bet
  return { delta, saved: null, result: { stops, payout, balance: balance + delta } }
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
  return { delta, saved: next, result: blackjack.viewOf(next) }
}

export const SOLO_PLAY = { roulette: rouletteSpin, slots: slotsSpin, blackjack: blackjackPlay }
