// Reglas puras de los Duelos 1 contra 1: las usan la pantalla y el servidor (api/_juegos/duelos.mjs). Quien reta pone
// la apuesta y elige el tipo de duelo; quien acepta pone la misma cantidad. El servidor sortea y el ganador se lleva lo
// del otro. Es 50 % contra 50 %: la banca no se queda nada.
export const KINDS = {
  moneda: { name: 'Cara o cruz', text: 'Una moneda al aire: tú eres cara, el rival cruz.' },
  dados: { name: 'Dados', text: 'Dos dados cada uno: gana la suma más alta.' },
  carta: { name: 'Carta alta', text: 'Una carta cada uno: gana la más alta (del 2 al as).' },
}
export const KIND_IDS = Object.keys(KINDS)
export const BETS = [100, 500, 1000, 2500, 5000]
export const MIN_BET = 50
export const MAX_BET = 50000
export const OPEN_MAX = 3 // retos abiertos a la vez por persona
export const EXPIRE_MS = 10 * 60000 // un reto sin aceptar se cancela solo y se devuelve el dinero

export const validBet = (n) => Number.isInteger(n) && n >= MIN_BET && n <= MAX_BET && n % 50 === 0

const SUITS = ['♠', '♥', '♦', '♣']
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']

// Sorteo: rand(n) da un entero de 0 a n-1. Devuelve { winner: 'reta' | 'acepta', detail } (detail lo anima la pantalla).
// Los empates de dados y cartas se repiten hasta que alguien gana (se guardan todas las tiradas).
export function play(kind, rand) {
  if (kind === 'moneda') {
    const side = rand(2) === 0 ? 'cara' : 'cruz'
    return { winner: side === 'cara' ? 'reta' : 'acepta', detail: { side } }
  }
  const rounds = []
  for (;;) {
    if (kind === 'dados') {
      const a = [1 + rand(6), 1 + rand(6)]
      const b = [1 + rand(6), 1 + rand(6)]
      rounds.push({ a, b })
      const sa = a[0] + a[1]
      const sb = b[0] + b[1]
      if (sa !== sb) return { winner: sa > sb ? 'reta' : 'acepta', detail: { rounds } }
    } else {
      const a = { rank: rand(13), suit: rand(4) }
      const b = { rank: rand(13), suit: rand(4) }
      rounds.push({ a, b })
      if (a.rank !== b.rank) return { winner: a.rank > b.rank ? 'reta' : 'acepta', detail: { rounds } }
    }
  }
}

export const cardLabel = (c) => `${RANKS[c.rank]}${SUITS[c.suit]}`
export const isRed = (c) => c.suit === 1 || c.suit === 2
