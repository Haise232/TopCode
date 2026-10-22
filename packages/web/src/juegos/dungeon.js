// Reglas puras del Laberinto de las Puertas: las usa la pantalla para pintar y el servidor (api/_juegos) para sortear
// cada puerta. Entras con tu apuesta como botín. En cada sala hay 3 puertas y eliges una: un cofre multiplica el botín,
// un pasillo vacío te deja pasar sin premio y un monstruo o una trampa te quitan el botín entero. Entre sala y sala
// puedes salir con lo que llevas; si cruzas todas, llegas a la sala del tesoro y cobras solo.
export const MIN_BET = 10
export const MAX_BET = 5000
export const STEP = 10
export const DOORS = 3

// Cada sala: sus 3 puertas (se barajan en cada visita) y lo que multiplica el cofre (num/den).
// Cada sala es justa (de media el botín no sube ni baja al abrir una puerta), salvo el vestíbulo: allí el pasillo es a
// veces otra trampa (trapPct %), y eso deja el retorno en el 96 % retires cuando retires (por debajo del 100 % para que
// el Score no se pueda «cultivar»). Con todo cofres: ×2 · ×1,5 · ×2 · ×1,5 · ×2 · ×3 = ×54.
export const ROOMS = [
  { name: 'El vestíbulo', doors: ['chest', 'empty', 'monster'], gain: [2, 1], trapPct: 12 },
  { name: 'La cripta', doors: ['chest', 'chest', 'monster'], gain: [3, 2] },
  { name: 'La galería de los ecos', doors: ['chest', 'empty', 'monster'], gain: [2, 1] },
  { name: 'La biblioteca maldita', doors: ['chest', 'chest', 'trap'], gain: [3, 2] },
  { name: 'El pozo de las arañas', doors: ['chest', 'empty', 'monster'], gain: [2, 1] },
  { name: 'La guarida del dragón', doors: ['chest', 'monster', 'trap'], gain: [3, 1] },
]
export const DEPTH = ROOMS.length

export const loses = (kind) => kind === 'monster' || kind === 'trap'

// Lo que vale el botín tras el cofre de la sala (en euros enteros; se redondea hacia abajo).
export const grow = (pot, room) => {
  const [num, den] = ROOMS[room].gain
  return Math.floor((pot * num) / den)
}

// Texto del multiplicador del cofre: «×2», «×1,5».
export const gainLabel = (room) => {
  const [num, den] = ROOMS[room].gain
  return `×${String(num / den).replace('.', ',')}`
}

// rand(n): entero de 0 a n-1 (en el servidor, randomInt de node:crypto). Devuelve las 3 puertas de la sala, barajadas.
export function layout(room, rand) {
  const { doors, trapPct = 0 } = ROOMS[room]
  const list = doors.map((kind) => (kind === 'empty' && rand(100) < trapPct ? 'trap' : kind))
  for (let i = list.length - 1; i > 0; i--) {
    const j = rand(i + 1)
    ;[list[i], list[j]] = [list[j], list[i]]
  }
  return list
}

// Probabilidad (en %) de no perder en la sala.
export const safeChance = (room) => {
  const { doors, trapPct = 0 } = ROOMS[room]
  const safe = doors.filter((k) => !loses(k)).length - (doors.includes('empty') ? trapPct / 100 : 0)
  return Math.round((safe / DOORS) * 100)
}

export const validBet = (bet) => Number.isInteger(bet) && bet >= MIN_BET && bet <= MAX_BET && bet % STEP === 0
export const validDoor = (door) => Number.isInteger(door) && door >= 0 && door < DOORS

// Apuesta más alta que te deja el saldo (0 si no llegas a la mínima).
export const maxBetFor = (balance) => Math.min(MAX_BET, Math.floor(balance / STEP) * STEP)

// --- Ayudas de la pantalla (no tocan las reglas de arriba) ---

export const clampBet = (bet, max) => Math.max(MIN_BET, Math.min(Math.max(max, MIN_BET), Math.round(bet / STEP) * STEP))

// Color del historial según cuántas veces la apuesta se cobró (0 = no salió del laberinto).
export const toneOf = (ratio) =>
  ratio <= 0 ? 'cold' : ratio < 2 ? 'even' : ratio < 5 ? 'gold' : ratio < 15 ? 'warm' : 'hot'
