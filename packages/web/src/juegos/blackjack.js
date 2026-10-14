import { STARTING_BANK, loadWallet } from './wallet.js'
import { DEALER_STANDS, cardValue, createShoe, handValue, isNatural } from './shared/blackjack-core.js'

export { DECKS, DEALER_STANDS, cardValue, handValue, isNatural } from './shared/blackjack-core.js'

export const CHIPS = [10, 50, 100, 500]
// Al bajar de esta cantidad de cartas el zapato se vuelve a barajar antes de repartir.
export const CUT = 78

// Zapato de seis barajas mezclado con Math.random.
export const newShoe = () => createShoe((n) => Math.floor(Math.random() * n))

export function canDouble(state) {
  const hand = state.hands[state.active]
  return state.phase === 'player' && hand.cards.length === 2 && state.bank >= hand.bet
}

// Solo se separa una vez, con dos cartas del mismo valor.
export function canSplit(state) {
  const hand = state.hands[state.active]
  return (
    state.phase === 'player' &&
    state.hands.length === 1 &&
    hand.cards.length === 2 &&
    cardValue(hand.cards[0]) === cardValue(hand.cards[1]) &&
    state.bank >= hand.bet
  )
}

export const initialState = {
  bank: STARTING_BANK,
  best: STARTING_BANK,
  bet: 50,
  shoe: [],
  shuffled: false,
  phase: 'idle', // idle | player | dealer
  dealer: [],
  revealed: false,
  hands: [], // { cards, bet, doubled, done, outcome }
  active: 0,
  payout: 0,
  wagered: 0,
  round: 0,
}

export function init() {
  return { ...initialState, ...loadWallet(), shoe: newShoe() }
}

// Pasa a la siguiente mano sin terminar; si no queda ninguna, juega el crupier.
function advance(state) {
  const hands = state.hands.map((hand) => (!hand.done && handValue(hand.cards).total >= 21 ? { ...hand, done: true } : hand))
  const next = hands.findIndex((hand) => !hand.done)
  if (next === -1) return { ...state, hands, phase: 'dealer' }
  return { ...state, hands, active: next }
}

function drawTo(state, index, extra = {}) {
  const [card, ...shoe] = state.shoe
  const hands = state.hands.with(index, { ...state.hands[index], cards: [...state.hands[index].cards, card], ...extra })
  return { ...state, shoe, hands }
}

function outcomeOf(hand, dealer, single) {
  const player = handValue(hand.cards).total
  const house = handValue(dealer).total
  const natural = single && isNatural(hand.cards)
  if (player > 21) return { outcome: 'bust', paid: 0 }
  if (isNatural(dealer)) return natural ? { outcome: 'push', paid: hand.bet } : { outcome: 'lose', paid: 0 }
  if (natural) return { outcome: 'blackjack', paid: hand.bet * 2.5 }
  if (house > 21 || player > house) return { outcome: 'win', paid: hand.bet * 2 }
  if (player === house) return { outcome: 'push', paid: hand.bet }
  return { outcome: 'lose', paid: 0 }
}

// El crupier solo roba si queda alguna mano viva que no sea blackjack.
function dealerMustDraw(state) {
  const single = state.hands.length === 1
  const live = state.hands.some((hand) => handValue(hand.cards).total <= 21 && !(single && isNatural(hand.cards)))
  return live && !isNatural(state.dealer) && handValue(state.dealer).total < DEALER_STANDS
}

export function reducer(state, action) {
  switch (action.type) {
    case 'ADD_CHIP': {
      if (state.phase !== 'idle' || state.bet + action.value > state.bank) return state
      return { ...state, bet: state.bet + action.value }
    }
    case 'CLEAR_BET': {
      if (state.phase !== 'idle') return state
      return { ...state, bet: 0 }
    }
    case 'DEAL': {
      if (state.phase !== 'idle' || state.bet <= 0 || state.bank < state.bet) return state
      const [p1, d1, p2, d2, ...shoe] = action.shoe ?? state.shoe
      const player = [p1, p2]
      const dealer = [d1, d2]
      const natural = isNatural(player) || isNatural(dealer)
      return {
        ...state,
        bank: state.bank - state.bet,
        shoe,
        shuffled: Boolean(action.shoe),
        phase: natural ? 'dealer' : 'player',
        dealer,
        revealed: false,
        hands: [{ cards: player, bet: state.bet, doubled: false, done: natural, outcome: null }],
        active: 0,
        payout: 0,
        wagered: state.bet,
        round: state.round + 1,
      }
    }
    case 'HIT': {
      if (state.phase !== 'player') return state
      return advance(drawTo(state, state.active))
    }
    case 'STAND': {
      if (state.phase !== 'player') return state
      return advance({ ...state, hands: state.hands.with(state.active, { ...state.hands[state.active], done: true }) })
    }
    case 'DOUBLE': {
      if (!canDouble(state)) return state
      const { bet } = state.hands[state.active]
      const next = drawTo(state, state.active, { bet: bet * 2, doubled: true, done: true })
      return advance({ ...next, bank: state.bank - bet, wagered: state.wagered + bet })
    }
    case 'SPLIT': {
      if (!canSplit(state)) return state
      const [hand] = state.hands
      const [a, b, ...shoe] = state.shoe
      // Con ases separados cada mano recibe una sola carta más.
      const aces = hand.cards[0].rank === 'A'
      const split = (card, extra) => ({ ...hand, cards: [card, extra], done: aces })
      return advance({
        ...state,
        shoe,
        bank: state.bank - hand.bet,
        wagered: state.wagered + hand.bet,
        hands: [split(hand.cards[0], a), split(hand.cards[1], b)],
        active: 0,
      })
    }
    case 'DEALER_STEP': {
      if (state.phase !== 'dealer') return state
      if (!state.revealed) return { ...state, revealed: true }
      if (dealerMustDraw(state)) {
        const [card, ...shoe] = state.shoe
        return { ...state, shoe, dealer: [...state.dealer, card] }
      }
      const single = state.hands.length === 1
      let payout = 0
      const hands = state.hands.map((hand) => {
        const { outcome, paid } = outcomeOf(hand, state.dealer, single)
        payout += paid
        return { ...hand, outcome }
      })
      const bank = state.bank + payout
      // Si no alcanza para repetir la apuesta, se deja la mayor posible.
      const bet = Math.min(state.bet, bank - (bank % CHIPS[0]))
      return { ...state, hands, payout, bank, bet, best: Math.max(state.best, bank), phase: 'idle' }
    }
    case 'RESET':
      return { ...initialState, best: state.best, shoe: action.shoe }
    default:
      return state
  }
}
