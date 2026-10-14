import { STARTING_BANK, loadWallet } from './wallet.js'

// Pago por 3, 4 y 5 iguales seguidos desde la izquierda, en veces la apuesta de esa línea.
export const PAYS = {
  cherry: [1, 5, 20],
  lemon: [2, 8, 35],
  bell: [4, 16, 70],
  star: [8, 35, 160],
  diamond: [20, 80, 400],
  seven: [40, 200, 1000],
}
export const WILD = 'wild'
export const MIN_RUN = 3

// Símbolos que cuentan para cada rodillo. El comodín solo sale en los tres centrales.
const BASE = [
  'cherry', 'lemon', 'bell', 'cherry', 'star', 'lemon', 'diamond', 'cherry', 'bell', 'lemon',
  'star', 'cherry', 'bell', 'lemon', 'seven', 'cherry', 'star', 'lemon', 'bell', 'diamond',
]
const withWild = (strip, at) => strip.map((name, i) => (at.includes(i) ? WILD : name))
const shuffle = (strip, step) => strip.map((_, i) => strip[(i * step) % strip.length])
export const REELS = [
  BASE,
  withWild(shuffle(BASE, 3), [4, 15]),
  withWild([...BASE].reverse(), [2, 9, 16]),
  withWild(shuffle(BASE, 7), [6, 13]),
  shuffle([...BASE].reverse(), 9),
]

// Fila que cruza cada línea en cada rodillo: 0 arriba, 1 centro, 2 abajo.
export const LINES = [
  [1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0],
  [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0],
  [2, 1, 0, 1, 2],
  [0, 0, 1, 2, 2],
  [2, 2, 1, 0, 0],
  [1, 0, 0, 0, 1],
  [1, 2, 2, 2, 1],
  [1, 0, 1, 2, 1],
]

export const BETS = [10, 20, 50, 100, 250]

// Los tres símbolos visibles de un rodillo detenido en `stop` (fila central).
export function windowOf(reel, stop) {
  const strip = REELS[reel]
  const at = (i) => strip[(i + strip.length) % strip.length]
  return [at(stop - 1), at(stop), at(stop + 1)]
}

// Racha de iguales desde la izquierda; el comodín sustituye a cualquier símbolo.
export function lineRun(symbols) {
  let symbol = null
  let count = 0
  for (const name of symbols) {
    if (name !== WILD) {
      if (symbol && name !== symbol) break
      symbol = name
    }
    count++
  }
  return { symbol: symbol ?? 'seven', count }
}

// La apuesta se reparte a partes iguales entre las líneas.
export function evaluate(stops, bet) {
  const lineBet = bet / LINES.length
  const grid = stops.map((stop, reel) => windowOf(reel, stop))
  const wins = []
  LINES.forEach((rows, line) => {
    const { symbol, count } = lineRun(rows.map((row, reel) => grid[reel][row]))
    if (count >= MIN_RUN) wins.push({ line, symbol, count, amount: lineBet * PAYS[symbol][count - MIN_RUN] })
  })
  return { wins, payout: wins.reduce((sum, win) => sum + win.amount, 0) }
}

export const initialState = {
  bank: STARTING_BANK,
  best: STARTING_BANK,
  bet: 20,
  stops: [2, 9, 5, 11, 7],
  pending: null,
  landed: REELS.length, // rodillos ya detenidos en la tirada en curso
  phase: 'idle', // idle | spinning
  wins: [],
  payout: 0,
  paidBet: 0,
  tier: 'none', // none | small | win | big
  spins: 0,
}

export function init() {
  return { ...initialState, ...loadWallet() }
}

export function reducer(state, action) {
  switch (action.type) {
    case 'SET_BET': {
      if (state.phase !== 'idle') return state
      return { ...state, bet: action.bet }
    }
    case 'SPIN': {
      if (state.phase !== 'idle' || state.bank < state.bet) return state
      return {
        ...state,
        bank: state.bank - state.bet,
        phase: 'spinning',
        pending: action.stops,
        landed: 0,
        wins: [],
        payout: 0,
        tier: 'none',
      }
    }
    case 'LAND': {
      if (state.phase !== 'spinning') return state
      const stops = state.stops.with(state.landed, state.pending[state.landed])
      const landed = state.landed + 1
      if (landed < REELS.length) return { ...state, stops, landed }

      const { wins, payout } = evaluate(stops, state.bet)
      const bank = state.bank + payout
      let tier = 'none'
      if (payout >= state.bet * 15) tier = 'big'
      else if (payout > state.bet) tier = 'win'
      else if (payout > 0) tier = 'small'
      return {
        ...state,
        stops,
        landed,
        phase: 'idle',
        pending: null,
        wins,
        payout,
        paidBet: state.bet,
        tier,
        bank,
        best: Math.max(state.best, bank),
        spins: state.spins + 1,
      }
    }
    case 'RESET':
      return { ...initialState, best: state.best }
    default:
      return state
  }
}
