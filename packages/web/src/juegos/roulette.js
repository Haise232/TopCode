import { STARTING_BANK, loadWallet, saveWallet } from './wallet.js'

// Orden de los números en una rueda europea (un solo cero), en sentido horario.
export const WHEEL = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14,
  31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
]
export const SEGMENT = 360 / WHEEL.length

const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36])

export const colorOf = (n) => (n === 0 ? 'green' : REDS.has(n) ? 'red' : 'black')

export { STARTING_BANK }
export const CHIPS = [5, 25, 100, 500]
const LUCKY_MULTIPLIERS = [50, 50, 75, 75, 100, 150]

// Identificadores de apuesta: n:17, red, black, even, odd, low, high, dozen:1-3, col:1-3
export function wins(id, n) {
  const [kind, arg] = id.split(':')
  if (kind === 'n') return n === Number(arg)
  if (n === 0) return false
  switch (kind) {
    case 'red':
    case 'black':
      return colorOf(n) === kind
    case 'even':
      return n % 2 === 0
    case 'odd':
      return n % 2 === 1
    case 'low':
      return n <= 18
    case 'high':
      return n >= 19
    case 'dozen':
      return Math.ceil(n / 12) === Number(arg)
    case 'col':
      return ((n - 1) % 3) + 1 === Number(arg)
    default:
      return false
  }
}

// Pago por cada unidad apostada, sin contar la apuesta devuelta.
export function multiplier(id) {
  const kind = id.split(':')[0]
  if (kind === 'n') return 35
  if (kind === 'dozen' || kind === 'col') return 2
  return 1
}

// Números relámpago de una tirada: de 1 a 3, cada uno con su pago especial
// para las apuestas a pleno. Devuelve { número: multiplicador }.
export function pickLucky() {
  const lucky = {}
  const count = 1 + Math.floor(Math.random() * 3)
  while (Object.keys(lucky).length < count) {
    const n = Math.floor(Math.random() * WHEEL.length)
    lucky[n] = LUCKY_MULTIPLIERS[Math.floor(Math.random() * LUCKY_MULTIPLIERS.length)]
  }
  return lucky
}

// Extra sobre la ganancia según las victorias seguidas: +10% por cada una
// a partir de la segunda, hasta +50%.
export const streakBonus = (streak) => Math.min(Math.max(streak - 1, 0), 5) * 0.1

export const totalOf = (placed) => placed.reduce((sum, bet) => sum + bet.amount, 0)

export function totalsById(placed) {
  const totals = {}
  for (const { id, amount } of placed) totals[id] = (totals[id] ?? 0) + amount
  return totals
}

export const initialState = {
  bank: STARTING_BANK,
  best: STARTING_BANK,
  chip: 25,
  placed: [], // una entrada por ficha puesta, en orden, para poder deshacer
  lastPlaced: [],
  phase: 'betting', // betting | spinning
  pending: null,
  lucky: {},
  result: null,
  net: 0,
  bonus: 0,
  boosted: null,
  streak: 0,
  spins: 0,
  history: [],
}

export function init() {
  return { ...initialState, ...loadWallet() }
}

export function save({ bank, best, placed }) {
  // Las fichas que siguen en la mesa se devuelven al salir o recargar.
  saveWallet({ bank: bank + totalOf(placed), best })
}

function repeatLast(state) {
  const total = totalOf(state.lastPlaced)
  if (state.placed.length > 0 || total === 0 || total > state.bank) return state
  return { ...state, bank: state.bank - total, placed: state.lastPlaced }
}

export function reducer(state, action) {
  switch (action.type) {
    case 'SELECT_CHIP':
      return { ...state, chip: action.chip }
    case 'PLACE': {
      if (state.phase !== 'betting' || state.bank < state.chip) return state
      return {
        ...state,
        bank: state.bank - state.chip,
        placed: [...state.placed, { id: action.id, amount: state.chip }],
      }
    }
    case 'UNDO': {
      if (state.phase !== 'betting' || state.placed.length === 0) return state
      const last = state.placed[state.placed.length - 1]
      return { ...state, bank: state.bank + last.amount, placed: state.placed.slice(0, -1) }
    }
    case 'CLEAR': {
      if (state.phase !== 'betting') return state
      return { ...state, bank: state.bank + totalOf(state.placed), placed: [] }
    }
    case 'DOUBLE': {
      const total = totalOf(state.placed)
      if (state.phase !== 'betting' || total === 0 || total > state.bank) return state
      return { ...state, bank: state.bank - total, placed: [...state.placed, ...state.placed] }
    }
    case 'REPEAT': {
      if (state.phase !== 'betting') return state
      return repeatLast(state)
    }
    case 'SPIN': {
      if (state.phase !== 'betting') return state
      // Con la mesa vacía, girar repite la última apuesta.
      const next = repeatLast(state)
      if (next.placed.length === 0) return state
      return {
        ...next,
        phase: 'spinning',
        pending: action.number,
        lucky: action.lucky,
        result: null,
      }
    }
    case 'SETTLE': {
      if (state.phase !== 'spinning') return state
      const n = state.pending
      const boost = state.lucky[n]
      let payout = 0
      let boosted = null
      for (const bet of state.placed) {
        if (!wins(bet.id, n)) continue
        const straight = bet.id.startsWith('n:')
        if (straight && boost) boosted = boost
        payout += bet.amount * ((straight && boost ? boost : multiplier(bet.id)) + 1)
      }
      const profit = payout - totalOf(state.placed)
      const streak = profit > 0 ? state.streak + 1 : 0
      const bonus = profit > 0 ? Math.round(profit * streakBonus(streak)) : 0
      const bank = state.bank + payout + bonus
      return {
        ...state,
        phase: 'betting',
        pending: null,
        lucky: {},
        result: n,
        net: profit + bonus,
        bonus,
        boosted,
        streak,
        bank,
        best: Math.max(state.best, bank),
        spins: state.spins + 1,
        history: [n, ...state.history].slice(0, 12),
        lastPlaced: state.placed,
        placed: [],
      }
    }
    case 'RESET':
      return { ...initialState, best: state.best }
    default:
      return state
  }
}
