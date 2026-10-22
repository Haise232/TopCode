// Reglas puras de Sobornos: las usa la pantalla para pintar y el servidor (api/_juegos) para sortear cada sobre.
// Entras con tu apuesta como maletín. En cada despacho hay 3 cargos (ficticios) y eliges a quién sobornar: uno acepta y
// te adjudica un contrato que multiplica el maletín, otro te da largas (no ganas nada pero sigues) y otro te denuncia y
// lo pierdes todo. Entre despacho y despacho puedes blanquear lo que llevas y salir; si llegas a la presidencia, cobras.
export const MIN_BET = 10
export const MAX_BET = 5000
export const STEP = 10
export const PICKS = 3

// Cada despacho: sus 3 reacciones (se barajan en cada visita) y lo que multiplica el contrato (num/den).
// Cada despacho es justo (de media el maletín no sube ni baja al sobornar), salvo el primero: allí el que da largas
// lleva a veces un micrófono (wirePct %), y eso deja el retorno en el 96 % salgas cuando salgas (por debajo del 100 %
// para que el Score no se pueda «cultivar»). Si aceptan todos: ×2 · ×1,5 · ×2 · ×3 · ×2 · ×3 = ×108.
export const OFFICES = [
  { name: 'El ayuntamiento', role: 'Concejalía de urbanismo', reacts: ['deal', 'stall', 'report'], gain: [2, 1], wirePct: 12 },
  { name: 'La diputación', role: 'Área de obras', reacts: ['deal', 'deal', 'report'], gain: [3, 2] },
  { name: 'La consejería', role: 'Dirección general', reacts: ['deal', 'stall', 'report'], gain: [2, 1] },
  { name: 'El juzgado', role: 'Instrucción', reacts: ['deal', 'report', 'report'], gain: [3, 1] },
  { name: 'El ministerio', role: 'Secretaría de Estado', reacts: ['deal', 'stall', 'report'], gain: [2, 1] },
  { name: 'La presidencia', role: 'Gabinete', reacts: ['deal', 'report', 'report'], gain: [3, 1] },
]
export const DEPTH = OFFICES.length

// deal: acepta el sobre · stall: se lo queda y te da largas · report: te denuncia · wire: llevaba un micrófono.
export const loses = (react) => react === 'report' || react === 'wire'

// Lo que vale el maletín tras el contrato del despacho (en euros enteros; se redondea hacia abajo).
export const grow = (pot, office) => {
  const [num, den] = OFFICES[office].gain
  return Math.floor((pot * num) / den)
}

// Texto del multiplicador del contrato: «×2», «×1,5».
export const gainLabel = (office) => {
  const [num, den] = OFFICES[office].gain
  return `×${String(num / den).replace('.', ',')}`
}

// rand(n): entero de 0 a n-1 (en el servidor, randomInt de node:crypto). Devuelve las 3 reacciones del despacho,
// barajadas.
export function layout(office, rand) {
  const { reacts, wirePct = 0 } = OFFICES[office]
  const list = reacts.map((react) => (react === 'stall' && rand(100) < wirePct ? 'wire' : react))
  for (let i = list.length - 1; i > 0; i--) {
    const j = rand(i + 1)
    ;[list[i], list[j]] = [list[j], list[i]]
  }
  return list
}

// Probabilidad (en %) de no acabar denunciado en el despacho.
export const safeChance = (office) => {
  const { reacts, wirePct = 0 } = OFFICES[office]
  const safe = reacts.filter((r) => !loses(r)).length - (reacts.includes('stall') ? wirePct / 100 : 0)
  return Math.round((safe / PICKS) * 100)
}

export const validBet = (bet) => Number.isInteger(bet) && bet >= MIN_BET && bet <= MAX_BET && bet % STEP === 0
export const validPick = (pick) => Number.isInteger(pick) && pick >= 0 && pick < PICKS

// --- Ayudas de la pantalla (no tocan las reglas de arriba) ---

export const maxBetFor = (balance) => Math.min(MAX_BET, Math.floor(balance / STEP) * STEP)
export const clampBet = (bet, max) => Math.max(MIN_BET, Math.min(Math.max(max, MIN_BET), Math.round(bet / STEP) * STEP))

// Color del historial según cuántas veces la apuesta se cobró (0 = acabó denunciado).
export const toneOf = (ratio) =>
  ratio <= 0 ? 'cold' : ratio < 2 ? 'even' : ratio < 5 ? 'gold' : ratio < 30 ? 'warm' : 'hot'
