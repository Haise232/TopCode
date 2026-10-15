// Orden de los números en una rueda europea (un solo cero), en sentido horario.
export const WHEEL = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14,
  31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
]
export const SEGMENT = 360 / WHEEL.length

const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36])

export const colorOf = (n) => (n === 0 ? 'green' : REDS.has(n) ? 'red' : 'black')

// Reglas puras: las usa la pantalla para pintar y el servidor (api/_juegos) para resolver la tirada con el saldo semanal.
export const CHIPS = [5, 25, 100, 500]
const LUCKY_MULTIPLIERS = [50, 50, 75, 75, 100, 150]
// Pagos ajustados para que la casa conserve un poco de ventaja (retorno < 100 % con relámpagos y rachas): con el
// saldo compartido del Score, una ruleta que devuelva más de lo apostado se podría «cultivar».
export const STRAIGHT_PAYS = 30
const STREAK_STEP = 0.05
const STREAK_STEPS = 3
const BET_ID = /^(n:([0-9]|[12][0-9]|3[0-6])|red|black|even|odd|low|high|dozen:[123]|col:[123])$/
const MAX_CHIPS = 300
const mathInt = (n) => Math.floor(Math.random() * n)

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
  if (kind === 'n') return STRAIGHT_PAYS
  if (kind === 'dozen' || kind === 'col') return 2
  return 1
}

// Números relámpago de una tirada: de 1 a 3, cada uno con su pago especial
// para las apuestas a pleno. Devuelve { número: multiplicador }.
// rand(n): entero de 0 a n-1 (en el servidor, randomInt de node:crypto).
export function pickLucky(rand = mathInt) {
  const lucky = {}
  const count = 1 + rand(3)
  while (Object.keys(lucky).length < count) {
    const n = rand(WHEEL.length)
    lucky[n] = LUCKY_MULTIPLIERS[rand(LUCKY_MULTIPLIERS.length)]
  }
  return lucky
}

// Extra sobre la ganancia según las victorias seguidas (en las que al menos duplicas lo apostado): +5% por
// cada una a partir de la segunda, hasta +15%.
export const streakBonus = (streak) => Math.min(Math.max(streak - 1, 0), STREAK_STEPS) * STREAK_STEP

// Fichas válidas: casillas que existen y cantidades de fichas enteras.
export const validBets = (placed) =>
  Array.isArray(placed) &&
  placed.length > 0 &&
  placed.length <= MAX_CHIPS &&
  placed.every((bet) => typeof bet?.id === 'string' && BET_ID.test(bet.id) && CHIPS.includes(bet.amount))

// Resultado de una tirada con el número n, los relámpago y la racha que traía el jugador.
export function settle(placed, n, lucky, streak) {
  const boost = lucky[n]
  let payout = 0
  let boosted = null
  for (const bet of placed) {
    if (!wins(bet.id, n)) continue
    const straight = bet.id.startsWith('n:')
    if (straight && boost) boosted = boost
    payout += bet.amount * ((straight && boost ? boost : multiplier(bet.id)) + 1)
  }
  const stake = totalOf(placed)
  const profit = payout - stake
  // Solo cuentan para la racha las tiradas en las que al menos duplicas lo apostado: cubrir media mesa para ganar
  // poco y casi siempre no da extra.
  const doubled = profit >= stake
  const nextStreak = doubled ? streak + 1 : 0
  const bonus = doubled ? Math.round(profit * streakBonus(nextStreak)) : 0
  return { payout, bonus, boosted, streak: nextStreak, net: profit + bonus }
}

export const totalOf = (placed) => placed.reduce((sum, bet) => sum + bet.amount, 0)

export function totalsById(placed) {
  const totals = {}
  for (const { id, amount } of placed) totals[id] = (totals[id] ?? 0) + amount
  return totals
}

export const initialState = {
  bank: 0, // saldo semanal que queda fuera de la mesa (el del servidor menos las fichas puestas)
  chip: 25,
  placed: [], // una entrada por ficha puesta, en orden, para poder deshacer
  lastPlaced: [],
  phase: 'betting', // betting | waiting (preguntando al servidor) | spinning
  pending: null, // resultado del servidor mientras gira la rueda
  lucky: {},
  result: null,
  net: 0,
  bonus: 0,
  boosted: null,
  streak: 0,
  spins: 0,
  history: [],
}

function repeatLast(state) {
  const total = totalOf(state.lastPlaced)
  if (state.placed.length > 0 || total === 0 || total > state.bank) return state
  return { ...state, bank: state.bank - total, placed: state.lastPlaced }
}

export function reducer(state, action) {
  switch (action.type) {
    // Saldo y racha del servidor (al entrar y cuando cambian fuera de esta pantalla).
    case 'SYNC': {
      if (state.phase !== 'betting') return state
      return { ...state, bank: Math.max(0, action.balance - totalOf(state.placed)), streak: action.streak ?? state.streak }
    }
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
    // Se pregunta al servidor: con la mesa vacía, girar repite la última apuesta.
    case 'ASK': {
      if (state.phase !== 'betting') return state
      const next = repeatLast(state)
      if (next.placed.length === 0) return state
      return { ...next, phase: 'waiting' }
    }
    // El servidor no aceptó la tirada: las fichas vuelven a estar disponibles.
    case 'REJECTED': {
      if (state.phase !== 'waiting') return state
      return { ...state, phase: 'betting' }
    }
    case 'SPIN': {
      if (state.phase !== 'waiting') return state
      return { ...state, phase: 'spinning', pending: action.result, lucky: action.result.lucky, result: null }
    }
    case 'SETTLE': {
      if (state.phase !== 'spinning') return state
      const { number, net, bonus, boosted, streak, balance } = state.pending
      return {
        ...state,
        phase: 'betting',
        pending: null,
        lucky: {},
        result: number,
        net,
        bonus,
        boosted,
        streak,
        bank: balance,
        spins: state.spins + 1,
        history: [number, ...state.history].slice(0, 12),
        lastPlaced: state.placed,
        placed: [],
      }
    }
    default:
      return state
  }
}
