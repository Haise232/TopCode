// Reglas puras de la Rueda de la Fortuna en vivo: las usan la pantalla y el servidor (api/_juegos/solo.mjs). Una rueda
// para todos que gira cada ROUND_MS. Se apuesta a un multiplicador (×2, ×4…) y, si la rueda se para en una casilla de
// ese multiplicador, se cobra lo apostado por él (con la apuesta incluida).
//
// La rueda tiene 50 casillas. Cada multiplicador sale tantas veces como para que su retorno sea exactamente el 96 %
// (multiplicador × casillas = 48): apuestes a lo que apuestes, de media recuperas el 96 % y el Score no se puede «cultivar».
export const ROUND_MS = 25000
export const BETS_MS = 13000 // apuestas abiertas
export const SPIN_MS = 7000 // la rueda gira; después se ve el resultado hasta la siguiente ronda
export const HOUSE = 0.96

export const CHIPS = [10, 50, 100, 500]
export const STEP = CHIPS[0]
export const MAX_TOTAL = 5000 // lo máximo entre todas las apuestas de una ronda

// Multiplicador → casillas y color.
export const SEGMENTS = {
  2: { count: 24, color: '#3d9f89' },
  4: { count: 12, color: '#2f7be0' },
  8: { count: 6, color: '#8a4fd6' },
  12: { count: 4, color: '#e0702b' },
  16: { count: 3, color: '#d93b5c' },
  48: { count: 1, color: '#f2c14e' },
}
export const MULTS = Object.keys(SEGMENTS).map(Number)

// El orden de las casillas en la rueda: repartidas para que los iguales no vayan juntos y el ×48 quede solo.
export const WHEEL = (() => {
  const left = Object.fromEntries(MULTS.map((m) => [m, SEGMENTS[m].count]))
  const total = MULTS.reduce((sum, m) => sum + left[m], 0)
  const out = []
  for (let i = 0; i < total; i++) {
    // En cada hueco, el multiplicador que más «debe» según su proporción y que no repita el de al lado.
    let best = null
    let score = -Infinity
    for (const m of MULTS) {
      if (left[m] === 0 || (out.length && out[out.length - 1] === m && left[m] < total - i)) continue
      const s = left[m] / SEGMENTS[m].count + (SEGMENTS[m].count - left[m]) * 1e-6 - (out[out.length - 1] === m ? 1 : 0)
      if (s > score) {
        score = s
        best = m
      }
    }
    out.push(best)
    left[best]--
  }
  return out
})()

// Una apuesta: { mult, amount }.
export const validBet = (b) => MULTS.includes(b?.mult) && Number.isInteger(b.amount) && b.amount >= STEP && b.amount % STEP === 0
export const totalOf = (bets) => bets.reduce((sum, b) => sum + b.amount, 0)
export const validBets = (bets) =>
  Array.isArray(bets) && bets.length <= MULTS.length && bets.every(validBet) && new Set(bets.map((b) => b.mult)).size === bets.length && totalOf(bets) <= MAX_TOTAL

// Lo que cobra cada apuesta si la rueda se para en la casilla `index` (apuesta incluida).
export const payoutOf = (bets, index) => bets.reduce((sum, b) => sum + (WHEEL[index] === b.mult ? b.amount * b.mult : 0), 0)

// Fase de la ronda según el reloj del servidor.
export function phaseAt(t) {
  const round = Math.floor(t / ROUND_MS)
  const offset = t - round * ROUND_MS
  const phase = offset < BETS_MS ? 'betting' : offset < BETS_MS + SPIN_MS ? 'spin' : 'result'
  return { round, offset, phase }
}

export const fmtMult = (m) => `×${m}`
