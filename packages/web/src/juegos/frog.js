// Reglas puras de la Rana: las usa la pantalla para pintar y el servidor (api/_juegos) para sortear cada salto.
// La rana empieza en el nenúfar ×1 con tu apuesta. En cada salto decides: saltar al siguiente nenúfar (×2, ×3…) o cobrar.
// Si falla, cae al agua y pierdes la apuesta.
export const MIN_BET = 10
export const MAX_BET = 5000
export const STEP = 10
export const MAX_MULT = 10 // último nenúfar: al llegar se cobra solo
export const HOUSE = 0.96 // retorno esperado, retires cuando retires

// Probabilidad (num/den) de que el salto desde ×mult al siguiente salga bien. Está hecha para que llegar a ×m tenga
// probabilidad HOUSE/m: así, retirándote en cualquier nenúfar, de media recuperas el 96 % (por debajo del 100 %
// para que el Score no se pueda «cultivar»). El primer salto: 48/100; el resto, mult/(mult+1).
export const odds = (mult) => (mult === 1 ? [48, 100] : [mult, mult + 1])

// Porcentaje que ve la pantalla (48, 67, 75…).
export const chance = (mult) => {
  const [num, den] = odds(mult)
  return Math.round((num / den) * 100)
}

// rand(n): entero de 0 a n-1 (en el servidor, randomInt de node:crypto).
export const survives = (mult, rand) => {
  const [num, den] = odds(mult)
  return rand(den) < num
}

export const payout = (bet, mult) => bet * mult

export const validBet = (bet) => Number.isInteger(bet) && bet >= MIN_BET && bet <= MAX_BET && bet % STEP === 0

// Apuesta más alta que te deja el saldo (0 si no llegas a la mínima).
export const maxBetFor = (balance) => Math.min(MAX_BET, Math.floor(balance / STEP) * STEP)
