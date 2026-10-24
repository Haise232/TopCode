// Reglas puras de la Subasta a ciegas (en vivo): las usan la pantalla y el servidor (api/_juegos/subasta.mjs).
// Cada ROUND_MS sale una caja para todos. Se sabe de qué tipo es (madera, plata, oro o diamante), pero no lo que lleva.
// Durante BID_MS cada uno puja en secreto (solo se puede subir la puja); al cerrar, el que más ha pujado se la lleva y
// paga su puja, y a los demás se les devuelve. Empate: gana quien pujó antes.
export const ROUND_MS = 60000
export const BID_MS = 40000
export const BID_STEP = 100
export const MAX_BID = 500000

// Cajas: valor medio de lo que llevan (E) y cuántas de cada 100 salen.
export const TIERS = {
  madera: { name: 'Caja de madera', value: 500, weight: 40 },
  plata: { name: 'Caja de plata', value: 1500, weight: 30 },
  oro: { name: 'Caja de oro', value: 4000, weight: 20 },
  diamante: { name: 'Caja de diamante', value: 10000, weight: 10 },
}
export const TIER_ORDER = ['madera', 'plata', 'oro', 'diamante']

// Lo que puede haber dentro, en veces el valor de la caja, y cuántas de cada 1000. De media, 0,97 veces el valor.
export const PRIZES = [
  { mult: 0, weight: 360, name: 'Una piedra', icon: '🪨' },
  { mult: 0.25, weight: 150, name: 'Calderilla', icon: '🪙' },
  { mult: 0.5, weight: 150, name: 'Un fajo de billetes', icon: '💵' },
  { mult: 1, weight: 120, name: 'Un maletín', icon: '💼' },
  { mult: 2, weight: 120, name: 'Lingotes de oro', icon: '🧈' },
  { mult: 4, weight: 75, name: 'El cofre del tesoro', icon: '👑' },
  { mult: 8, weight: 25, name: '¡El diamante!', icon: '💎' },
]

// Puja mínima: el valor medio entre 0,96, redondeado a BID_STEP hacia arriba. Así, aunque nadie más puje, de media se
// recupera menos de lo pujado y la subasta no sirve para inflar el Score.
export const minBid = (tier) => Math.ceil(TIERS[tier].value / 0.96 / BID_STEP) * BID_STEP

export const prizeAmount = (tier, prize) => Math.round(TIERS[tier].value * PRIZES[prize].mult)

// Sorteo de la caja con dos enteros uniformes: r100 (0-99) para el tipo y r1000 (0-999) para lo que lleva.
export function drawBox(r100, r1000) {
  let left = r100
  const tier = TIER_ORDER.find((t) => (left -= TIERS[t].weight) < 0)
  let rest = r1000
  const prize = PRIZES.findIndex((p) => (rest -= p.weight) < 0)
  return { tier, prize }
}

export const validBid = (tier, amount) => Number.isInteger(amount) && amount % BID_STEP === 0 && amount >= minBid(tier) && amount <= MAX_BID

// Ganador entre las pujas [{ owner, amount, at }]: la más alta y, si empatan, la más antigua. null si no hay ninguna.
export function winnerOf(bids) {
  let best = null
  for (const b of bids) if (!best || b.amount > best.amount || (b.amount === best.amount && b.at < best.at)) best = b
  return best
}

// Fase en el instante t: «bid» (se puja) o «reveal» (se abre la caja y se ve quién ganó).
export function phaseAt(t) {
  const round = Math.floor(t / ROUND_MS)
  const offset = t - round * ROUND_MS
  return { round, offset, phase: offset < BID_MS ? 'bid' : 'reveal' }
}
