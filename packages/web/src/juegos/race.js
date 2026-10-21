// Reglas puras de la Carrera de coches (en vivo): las usan la pantalla para pintar y el servidor (api/_juegos/solo.mjs)
// para sortear y pagar con el saldo semanal. Una carrera cada ROUND_MS para todos, como la ruleta y el cohete: se apuesta
// a un coche y cobra según el puesto en que acaba (1.º, 2.º o 3.º). Los seis coches son igual de rápidos: la llegada es un
// orden al azar, así que apostar a cualquiera vale lo mismo. Los importes van en euros enteros y los premios en centésimas
// (340 = ×3,40).
export const ROUND_MS = 55000
export const BETS_MS = 20000 // apuestas abiertas
export const GRID_MS = 6000 // parrilla de salida y semáforo (las apuestas ya están cerradas y se conoce la carrera)
export const RACE_MAX_MS = 24000 // la carrera más larga: el último coche cruza la meta antes de esto
export const CARS = 6
export const LAPS = 3
export const HOUSE = 0.96 // retorno esperado de cualquier forma de apostar: por debajo del 100 % el Score no se puede «cultivar»

export const CHIPS = [10, 50, 100, 500]
export const STEP = CHIPS[0]
export const MAX_TOTAL = 5000 // lo máximo que se juega entre todos los coches de una carrera

// Premio por puesto de llegada (1.º, 2.º, 3.º), en centésimas de lo apostado, con la apuesta incluida. Mantienen la proporción
// 10 : 5 : 2 de la idea original, escalados para que el retorno sea HOUSE: (340 + 170 + 66) / 6 coches = 96 %.
export const PODIUM = [340, 170, 66]

// Los coches: nombre, color de la carrocería y del dorsal.
export const CAR_INFO = [
  { name: 'Rayo', color: '#e2463c', accent: '#ffd9d4' },
  { name: 'Cobalto', color: '#2f7be0', accent: '#d4e6ff' },
  { name: 'Esmeralda', color: '#1fa463', accent: '#d2f5e1' },
  { name: 'Solar', color: '#f0b429', accent: '#fff2c4' },
  { name: 'Violeta', color: '#8a4fd6', accent: '#ecdcff' },
  { name: 'Ártico', color: '#37c6d6', accent: '#d6f8fc' },
]

// Lo que cobras por `amount` a un coche que acaba en el puesto `place` (0 = 1.º). Del 4.º en adelante, nada.
export const payout = (amount, place) => (place < PODIUM.length ? Math.floor((amount * PODIUM[place]) / 100) : 0)

// Apuestas: [{ car, amount }], un máximo de una por coche.
export const validBets = (bets) =>
  Array.isArray(bets) &&
  bets.length <= CARS &&
  new Set(bets.map((b) => b?.car)).size === bets.length &&
  bets.every((b) => Number.isInteger(b?.car) && b.car >= 0 && b.car < CARS && Number.isInteger(b.amount) && b.amount >= STEP && b.amount % STEP === 0) &&
  totalOf(bets) <= MAX_TOTAL

export const totalOf = (bets) => bets.reduce((sum, b) => sum + b.amount, 0)

// «×3,4», «×0,66»
export const fmtOdds = (odds) => `×${(odds / 100).toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}`

// Fase de la ronda según el reloj del servidor. La carrera dura hasta RACE_MAX_MS; cuándo acaba de verdad lo dicen los tiempos.
export function phaseAt(t) {
  const round = Math.floor(t / ROUND_MS)
  const offset = t - round * ROUND_MS
  const phase = offset < BETS_MS ? 'betting' : offset < BETS_MS + GRID_MS ? 'grid' : 'race'
  return { round, offset, phase, raced: offset - BETS_MS - GRID_MS }
}

// Instante de la salida de una ronda (ms del reloj del servidor).
export const startOf = (round) => round * ROUND_MS + BETS_MS + GRID_MS

// Cuánto ha avanzado un coche a los `ms` desde la salida, como fracción de la distancia total (1 = meta, tras LAPS vueltas).
// `finish` es el tiempo en que cruza la meta y `wobble` = [a1, a2, a3] los altibajos de su ritmo: así adelanta y es adelantado
// pero siempre llega a la meta justo en `finish`. Es monótona (nunca marcha atrás). Pasada la meta sigue rodando, sin parar de golpe.
export function progress(finish, wobble, ms) {
  if (ms <= 0) return 0
  if (ms >= finish) return 1 + ((ms - finish) / finish) * 0.4
  const tau = ms / finish
  return tau + wobble[0] * Math.sin(Math.PI * tau) + wobble[1] * Math.sin(2 * Math.PI * tau) + wobble[2] * Math.sin(3 * Math.PI * tau)
}

// Posiciones (0 = líder) de todos los coches a los `ms` de la salida.
export function standings(race, ms) {
  const pos = race.finish.map((f, i) => ({ car: i, at: progress(f, race.wobble[i], ms) }))
  pos.sort((a, b) => b.at - a.at)
  return pos.map((p) => p.car)
}
