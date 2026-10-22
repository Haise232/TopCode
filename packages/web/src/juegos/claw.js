// Reglas puras de la máquina de gancho: las usa la pantalla para pintar y el servidor (api/_juegos) para sortear cada
// intento con el saldo semanal. Pagas la apuesta, sueltas el gancho y sale uno de los premios de la tabla (o se escapa).
// Dónde sueltes el gancho no cambia nada: el premio lo sortea el servidor y la pantalla lleva el gancho hasta él.
export const MIN_BET = 10
export const MAX_BET = 1000
export const STEP = 10
export const DRAW = 10000

// Del más gordo al más pequeño: lo que paga (veces la apuesta, con la apuesta incluida) y cuántas veces sale de cada
// DRAW intentos. Retorno exacto: Σ mult × odds / DRAW = 96 % (por debajo del 100 % para que el Score no se pueda
// «cultivar»). Se cobra algo en el 34,15 % de los intentos.
export const PRIZES = [
  { id: 'diamond', name: 'Diamante gigante', mult: 200, odds: 5 },
  { id: 'crown', name: 'Corona de oro', mult: 50, odds: 20 },
  { id: 'bars', name: 'Lingotes', mult: 25, odds: 40 },
  { id: 'chest', name: 'Cofre de monedas', mult: 10, odds: 150 },
  { id: 'cash', name: 'Fajo de billetes', mult: 5, odds: 400 },
  { id: 'piggy', name: 'Hucha', mult: 2, odds: 800 },
  { id: 'coin', name: 'Moneda de oro', mult: 1, odds: 1000 },
  { id: 'change', name: 'Calderilla', mult: 0.5, odds: 1000 },
]
export const MISS_ODDS = DRAW - PRIZES.reduce((sum, p) => sum + p.odds, 0)

// rand(n): entero de 0 a n-1 (en el servidor, randomInt de node:crypto). Devuelve el índice en PRIZES o -1 si el
// gancho no agarra nada.
export function drawPrize(rand) {
  let roll = rand(DRAW)
  for (let i = 0; i < PRIZES.length; i++) {
    if (roll < PRIZES[i].odds) return i
    roll -= PRIZES[i].odds
  }
  return -1
}

// Lo que paga un intento (con la apuesta incluida). Con apuestas de 10 en 10 sale siempre entero.
export const payoutOf = (bet, prize) => (prize < 0 ? 0 : Math.round(bet * PRIZES[prize].mult))

export const multLabel = (mult) => `×${String(mult).replace('.', ',')}`
export const chanceLabel = (odds) => {
  const pct = (odds / DRAW) * 100
  return pct >= 1 ? `${String(pct).replace('.', ',')} %` : `1 de cada ${Math.round(DRAW / odds).toLocaleString('es-ES')}`
}

export const validBet = (bet) => Number.isInteger(bet) && bet >= MIN_BET && bet <= MAX_BET && bet % STEP === 0

// --- Ayudas de la pantalla (no tocan las reglas de arriba) ---

export const maxBetFor = (balance) => Math.min(MAX_BET, Math.floor(balance / STEP) * STEP)
export const clampBet = (bet, max) => Math.max(MIN_BET, Math.min(Math.max(max, MIN_BET), Math.round(bet / STEP) * STEP))

// Color del historial según cuántas veces la apuesta se cobró (0 = se escapó).
export const toneOf = (ratio) =>
  ratio <= 0 ? 'cold' : ratio < 2 ? 'even' : ratio < 10 ? 'gold' : ratio < 50 ? 'warm' : 'hot'
