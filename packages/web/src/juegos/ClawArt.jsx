// Dibujos de la máquina de gancho (SVG a mano): mueble con letrero y bombillas, cristal, gancho con cable y tres pinzas y
// los premios (uno distinto por cada fila de la tabla, más un peluche para cuando se escapa). Los premios se dibujan
// centrados en (0, 0) dentro de una caja de unos 80 × 80. Los estilos y movimientos están en Claw.css.

// Medidas del mueble (viewBox 800 × 660). Las usa también la pantalla para mover el gancho.
export const W = 800
export const H = 660
export const FLOOR = 470 // suelo del cristal, donde se apoya el montón
export const PIVOT_Y = 126 // de aquí cuelga el cable
export const HOME_Y = 164 // altura del extremo del cable con el gancho arriba
export const GRAB_Y = 330 // y con el gancho abajo, sobre el premio
export const PRIZE_S = 1.2 // tamaño del premio que se pesca (el del montón es algo menor)
export const HELD_DY = 58 // del extremo del cable al centro del premio que sujeta
export const ITEM_Y = GRAB_Y + HELD_DY // centro del premio cuando está en el montón
export const CHUTE_X = 112 // boca del conducto
export const TRAY_Y = 578 // donde reposa el premio en la bandeja
export const AIM_MIN = 214
export const AIM_MAX = 736

// Ruido determinista para repartir el montón sin Math.random al renderizar.
const noise = (i, salt) => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453
  return x - Math.floor(x)
}

const PLUSH = [
  { b: '#f08bb0', l: '#ffd0e1', d: '#b94a76' },
  { b: '#6ec6c9', l: '#c2f0ee', d: '#2f8a91' },
  { b: '#b69cf0', l: '#e3d8ff', d: '#7a5cc4' },
  { b: '#f5a65b', l: '#ffdcae', d: '#c0702a' },
]

// Montón del suelo: peluches casi siempre, con algún premio de adorno. Capas de atrás (arriba) a delante (abajo).
export const PILE = (() => {
  const rows = [
    { y: FLOOR - 108, x0: 236, step: 84, scale: 0.82 },
    { y: FLOOR - 72, x0: 212, step: 66, scale: 0.92 },
    { y: FLOOR - 36, x0: 196, step: 58, scale: 1.02 },
  ]
  const items = []
  rows.forEach((row, r) => {
    for (let x = row.x0, i = 0; x < 722; x += row.step, i++) {
      const n = r * 40 + i
      const roll = noise(n, 3)
      items.push({
        id: `${r}-${i}`,
        x: x + (noise(n, 4) - 0.5) * 16,
        y: row.y + (noise(n, 5) - 0.5) * 8,
        rot: (noise(n, 6) - 0.5) * 34,
        scale: row.scale * (0.92 + noise(n, 7) * 0.16),
        kind: roll < 0.74 ? 'plush' : Math.floor(((roll - 0.74) / 0.26) * 8),
        tone: Math.floor(noise(n, 8) * PLUSH.length),
      })
    }
  })
  return items
})()

// Degradados y filtros que comparten todos los dibujos. Va una sola vez dentro de cada <svg>.
export function ClawDefs() {
  const stops = (list) => list.map(([o, c]) => <stop key={o} offset={o} stopColor={c} />)
  const lin = (id, list, x2 = 0, y2 = 1) => (
    <linearGradient id={id} x1="0" y1="0" x2={x2} y2={y2}>
      {stops(list)}
    </linearGradient>
  )
  return (
    <defs>
      {lin('cw-gold', [
        [0, '#fff3b8'],
        [0.45, '#f0c75a'],
        [1, '#a8761d'],
      ])}
      {lin('cw-gold-d', [
        [0, '#e9bb45'],
        [1, '#7c5a14'],
      ])}
      {lin(
        'cw-gem',
        [
          [0, '#f2ffff'],
          [0.5, '#7fe3f2'],
          [1, '#2b8fd0'],
        ],
        1,
        1,
      )}
      {lin('cw-green', [
        [0, '#a9e6a2'],
        [1, '#3f8f4c'],
      ])}
      {lin('cw-wood', [
        [0, '#a8672f'],
        [1, '#5e3216'],
      ])}
      {lin(
        'cw-silver',
        [
          [0, '#fbfbff'],
          [0.5, '#c4ccd8'],
          [1, '#7c8696'],
        ],
        1,
        1,
      )}
      {lin(
        'cw-copper',
        [
          [0, '#ffc89a'],
          [0.5, '#d9833f'],
          [1, '#8a4a1c'],
        ],
        1,
        1,
      )}
      {lin('cw-pink', [
        [0, '#ffc4d6'],
        [1, '#e97fa3'],
      ])}
      {lin('cw-metal', [
        [0, '#e9edf3'],
        [0.45, '#aab3c2'],
        [1, '#5d6678'],
      ])}
      {lin('cw-casing', [
        [0, '#7a2748'],
        [0.55, '#52183a'],
        [1, '#2f0e24'],
      ])}
      {lin('cw-wall', [
        [0, '#3a2b78'],
        [0.6, '#2b4f8f'],
        [1, '#1d7c95'],
      ])}
      {lin('cw-base', [
        [0, '#5a1c3c'],
        [1, '#2a0c20'],
      ])}
      {lin(
        'cw-tube',
        [
          [0, 'rgba(180,235,255,0.5)'],
          [0.5, 'rgba(180,235,255,0.08)'],
          [1, 'rgba(180,235,255,0.4)'],
        ],
        1,
        0,
      )}
      <radialGradient id="cw-bulb" cx="0.4" cy="0.35" r="0.7">
        <stop offset="0" stopColor="#fffbe0" />
        <stop offset="0.5" stopColor="#ffd45a" />
        <stop offset="1" stopColor="#d28a12" />
      </radialGradient>
      <radialGradient id="cw-halo" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#fff3b8" stopOpacity="0.85" />
        <stop offset="1" stopColor="#fff3b8" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="cw-spot" cx="0.5" cy="0.1" r="0.8">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
        <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
      </radialGradient>
    </defs>
  )
}

// ---------- Premios ----------
const Shine = ({ x = -14, y = -14, r = 5 }) => <ellipse cx={x} cy={y} rx={r} ry={r * 0.6} fill="#fff" opacity="0.7" />

function Diamond() {
  return (
    <g>
      <polygon
        points="-36,-10 -20,-32 20,-32 36,-10 0,38"
        fill="url(#cw-gem)"
        stroke="#e9fdff"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <polygon points="-36,-10 -20,-32 -8,-10" fill="#fff" opacity="0.5" />
      <polygon points="-8,-10 -20,-32 0,-32" fill="#b9f3ff" opacity="0.55" />
      <polygon points="8,-10 0,-32 20,-32" fill="#9fe6f7" opacity="0.35" />
      <polygon points="36,-10 20,-32 8,-10" fill="#1a6db4" opacity="0.35" />
      <polygon points="-36,-10 -8,-10 0,38" fill="#6fd0ea" opacity="0.35" />
      <polygon points="36,-10 8,-10 0,38" fill="#1b78c0" opacity="0.45" />
      <path
        d="M-36 -10 H36 M-8 -10 L0 38 L8 -10 M-20 -32 L-8 -10 M20 -32 L8 -10"
        fill="none"
        stroke="#e9fdff"
        strokeWidth="1.6"
        opacity="0.85"
      />
      <path d="M26 -34 l3 -9 l3 9 l9 3 l-9 3 l-3 9 l-3 -9 l-9 -3 Z" fill="#fff" opacity="0.95" />
    </g>
  )
}

function Crown() {
  return (
    <g>
      <path
        d="M-34 12 L-38 -26 L-17 -8 L0 -32 L17 -8 L38 -26 L34 12 Z"
        fill="url(#cw-gold)"
        stroke="#7c5a14"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <rect x="-35" y="10" width="70" height="17" rx="4" fill="url(#cw-gold-d)" stroke="#7c5a14" strokeWidth="2.4" />
      {[-38, 0, 38].map((x, i) => (
        <circle key={x} cx={x} cy={i === 1 ? -34 : -28} r="5" fill="url(#cw-gold)" stroke="#7c5a14" strokeWidth="1.8" />
      ))}
      <circle cx="-20" cy="18.5" r="4.4" fill="#e2463c" stroke="#5a0f0a" strokeWidth="1.2" />
      <circle cx="0" cy="18.5" r="5.4" fill="#3aa0ff" stroke="#0b3a66" strokeWidth="1.2" />
      <circle cx="20" cy="18.5" r="4.4" fill="#41c27d" stroke="#0e4a2a" strokeWidth="1.2" />
      <path d="M-22 4 L-24 -10 M22 4 L24 -10" stroke="#fff3b8" strokeWidth="2.2" strokeLinecap="round" opacity="0.7" />
    </g>
  )
}

function GoldBar({ x, y, s = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path
        d="M-26 11 L-18 -9 H18 L26 11 Z"
        fill="url(#cw-gold)"
        stroke="#7c5a14"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path d="M-18 -9 H18 L14 -3 H-14 Z" fill="#fff6c8" opacity="0.8" />
      <path d="M-6 3 h12" stroke="#8a6212" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
    </g>
  )
}
function Bars() {
  return (
    <g>
      <GoldBar x={-23} y={22} />
      <GoldBar x={23} y={22} />
      <GoldBar x={0} y={0} />
      <Shine x={-8} y={-5} r={4} />
    </g>
  )
}

function Chest() {
  return (
    <g>
      {/* Monedas que asoman por la rendija */}
      <ellipse cx="0" cy="-6" rx="30" ry="9" fill="url(#cw-gold)" stroke="#7c5a14" strokeWidth="2" />
      {[-18, -4, 10, 22].map((x, i) => (
        <ellipse
          key={x}
          cx={x}
          cy={-11 - (i % 2) * 3}
          rx="8"
          ry="5"
          fill="url(#cw-gold)"
          stroke="#7c5a14"
          strokeWidth="1.5"
        />
      ))}
      <path
        d="M-34 -8 Q-34 -34 0 -34 Q34 -34 34 -8 Z"
        fill="url(#cw-wood)"
        stroke="#3a1c0a"
        strokeWidth="2.4"
        transform="translate(0 -6) rotate(-3)"
      />
      <rect x="-34" y="-4" width="68" height="34" rx="4" fill="url(#cw-wood)" stroke="#3a1c0a" strokeWidth="2.4" />
      <path d="M-34 8 H34" stroke="#3a1c0a" strokeWidth="2" opacity="0.6" />
      <rect x="-26" y="-4" width="8" height="34" fill="url(#cw-gold-d)" />
      <rect x="18" y="-4" width="8" height="34" fill="url(#cw-gold-d)" />
      <rect x="-8" y="2" width="16" height="16" rx="3" fill="url(#cw-gold)" stroke="#7c5a14" strokeWidth="2" />
      <circle cx="0" cy="9" r="2.6" fill="#5a3a08" />
      <circle cx="30" cy="30" r="7" fill="url(#cw-gold)" stroke="#7c5a14" strokeWidth="1.6" />
      <circle cx="-31" cy="31" r="5.5" fill="url(#cw-gold)" stroke="#7c5a14" strokeWidth="1.6" />
    </g>
  )
}

function Bill({ rot, x, y }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <rect x="-32" y="-16" width="64" height="32" rx="3.5" fill="url(#cw-green)" stroke="#1f5a2c" strokeWidth="2.2" />
      <rect
        x="-27"
        y="-11.5"
        width="54"
        height="23"
        rx="2"
        fill="none"
        stroke="#1f5a2c"
        strokeWidth="1.2"
        opacity="0.6"
      />
      <circle cx="0" cy="0" r="8.5" fill="#e4f7d6" stroke="#1f5a2c" strokeWidth="1.4" />
      <text x="0" y="4.6" textAnchor="middle" fontSize="12" fontWeight="800" fill="#1f5a2c" fontFamily="sans-serif">
        €
      </text>
    </g>
  )
}
function Cash() {
  return (
    <g>
      <Bill rot={-14} x={-4} y={4} />
      <Bill rot={8} x={4} y={0} />
      <Bill rot={-2} x={0} y={-4} />
      <rect x="-10" y="-24" width="20" height="40" rx="2" fill="#f3e6bd" stroke="#8a6a2a" strokeWidth="2" />
      <path d="M-6 -12 h12 M-6 -4 h12 M-6 4 h12" stroke="#b08a3a" strokeWidth="1.6" strokeLinecap="round" />
    </g>
  )
}

function Piggy() {
  return (
    <g>
      <path d="M-33 6 q-10 -6 -6 -14 q4 -6 8 0" fill="none" stroke="#c4577f" strokeWidth="3.6" strokeLinecap="round" />
      <rect x="-24" y="20" width="12" height="15" rx="4" fill="#e97fa3" stroke="#8a2f52" strokeWidth="2" />
      <rect x="8" y="20" width="12" height="15" rx="4" fill="#e97fa3" stroke="#8a2f52" strokeWidth="2" />
      <ellipse cx="0" cy="4" rx="34" ry="27" fill="url(#cw-pink)" stroke="#8a2f52" strokeWidth="2.4" />
      <path d="M12 -20 L20 -34 L28 -16 Z" fill="#e97fa3" stroke="#8a2f52" strokeWidth="2.2" strokeLinejoin="round" />
      <ellipse cx="32" cy="8" rx="9" ry="12" fill="#f7a3bf" stroke="#8a2f52" strokeWidth="2.2" />
      <ellipse cx="34" cy="5" rx="1.8" ry="3" fill="#8a2f52" />
      <ellipse cx="34" cy="12" rx="1.8" ry="3" fill="#8a2f52" />
      <circle cx="18" cy="-4" r="3.4" fill="#2a0c20" />
      <circle cx="19" cy="-5" r="1.1" fill="#fff" />
      <ellipse cx="14" cy="8" rx="5" ry="3.2" fill="#ff8fb0" opacity="0.7" />
      <rect x="-14" y="-23" width="22" height="5" rx="2.5" fill="#6a1f3c" />
      <ellipse cx="-3" cy="-30" rx="7" ry="3.4" fill="url(#cw-gold)" stroke="#7c5a14" strokeWidth="1.4" />
      <Shine x={-16} y={-8} r={6} />
    </g>
  )
}

function Coin() {
  return (
    <g>
      <circle r="34" fill="url(#cw-gold)" stroke="#7c5a14" strokeWidth="2.6" />
      <circle r="27" fill="none" stroke="#a8761d" strokeWidth="2.6" />
      <circle r="24" fill="url(#cw-gold-d)" opacity="0.25" />
      <text x="0" y="10" textAnchor="middle" fontSize="30" fontWeight="800" fill="#7c5a14" fontFamily="sans-serif">
        €
      </text>
      <path
        d="M-22 -14 A26 26 0 0 1 8 -26"
        fill="none"
        stroke="#fff"
        strokeWidth="3.4"
        strokeLinecap="round"
        opacity="0.8"
      />
    </g>
  )
}

function SmallCoin({ x, y, r, fill, edge }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={r} fill={fill} stroke={edge} strokeWidth="2" />
      <circle r={r * 0.68} fill="none" stroke={edge} strokeWidth="1.3" opacity="0.7" />
      <path
        d={`M${-r * 0.55} ${-r * 0.35} A${r * 0.65} ${r * 0.65} 0 0 1 ${r * 0.1} ${-r * 0.7}`}
        fill="none"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.7"
      />
    </g>
  )
}
function Change() {
  return (
    <g>
      <SmallCoin x={-16} y={16} r={15} fill="url(#cw-copper)" edge="#6b3410" />
      <SmallCoin x={14} y={20} r={14} fill="url(#cw-silver)" edge="#566074" />
      <SmallCoin x={-4} y={-6} r={16} fill="url(#cw-silver)" edge="#566074" />
      <SmallCoin x={22} y={-8} r={11} fill="url(#cw-copper)" edge="#6b3410" />
      <SmallCoin x={-28} y={-8} r={9} fill="url(#cw-silver)" edge="#566074" />
    </g>
  )
}

function Plush({ tone = 0 }) {
  const c = PLUSH[tone % PLUSH.length]
  return (
    <g>
      <circle cx="-22" cy="-26" r="10" fill={c.b} stroke={c.d} strokeWidth="2.2" />
      <circle cx="22" cy="-26" r="10" fill={c.b} stroke={c.d} strokeWidth="2.2" />
      <circle cx="-22" cy="-26" r="5" fill={c.l} />
      <circle cx="22" cy="-26" r="5" fill={c.l} />
      <ellipse cx="0" cy="26" rx="24" ry="19" fill={c.b} stroke={c.d} strokeWidth="2.4" />
      <ellipse cx="0" cy="28" rx="13" ry="11" fill={c.l} opacity="0.75" />
      <ellipse
        cx="-24"
        cy="20"
        rx="8"
        ry="12"
        fill={c.b}
        stroke={c.d}
        strokeWidth="2.2"
        transform="rotate(18 -24 20)"
      />
      <ellipse cx="24" cy="20" rx="8" ry="12" fill={c.b} stroke={c.d} strokeWidth="2.2" transform="rotate(-18 24 20)" />
      <circle cx="0" cy="-8" r="26" fill={c.b} stroke={c.d} strokeWidth="2.4" />
      <ellipse cx="0" cy="-1" rx="12" ry="9" fill={c.l} stroke={c.d} strokeWidth="1.6" />
      <ellipse cx="0" cy="-5" rx="4.6" ry="3.2" fill="#2a0c20" />
      <path d="M0 -2 v4 M-5 4 q5 4 10 0" fill="none" stroke="#2a0c20" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="-11" cy="-15" r="3.2" fill="#2a0c20" />
      <circle cx="11" cy="-15" r="3.2" fill="#2a0c20" />
      <circle cx="-10" cy="-16" r="1" fill="#fff" />
      <circle cx="12" cy="-16" r="1" fill="#fff" />
      <path d="M-5 14 L0 20 L5 14 L5 22 L-5 22 Z" fill={c.d} opacity="0.85" />
    </g>
  )
}

// Un premio de la tabla (id: diamond, crown, bars…) o el peluche de adorno ('plush').
export function PrizeItem({ id, tone = 0 }) {
  switch (id) {
    case 'diamond':
      return <Diamond />
    case 'crown':
      return <Crown />
    case 'bars':
      return <Bars />
    case 'chest':
      return <Chest />
    case 'cash':
      return <Cash />
    case 'piggy':
      return <Piggy />
    case 'coin':
      return <Coin />
    case 'change':
      return <Change />
    default:
      return <Plush tone={tone} />
  }
}

// ---------- Gancho ----------
// Pinza derecha (la izquierda es su reflejo). Gira alrededor de su articulación, en (0, 0).
const PRONG = 'M-5.5 0 L5.5 0 L9.5 30 Q12 52 -9 67 L-12.5 58.5 Q1.5 47 0 30 Z'

function Prong({ side }) {
  return (
    <g transform={`translate(${side * 19} 6) scale(${side} 1)`}>
      <g className="claw__prong">
        <path d={PRONG} fill="url(#cw-metal)" stroke="#2f3646" strokeWidth="2.2" strokeLinejoin="round" />
        <path d="M-1 4 L3 30" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity="0.6" />
        <path
          d="M-9 67 L-12.5 58.5 L-4 56 Z"
          fill="#e2463c"
          stroke="#2f3646"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </g>
    </g>
  )
}

// Cable: mide 1 de alto y la pantalla lo estira hasta el gancho (escala en y). Cuelga del punto (0, 0).
export function Cable() {
  return (
    <g>
      <rect x="-1.9" y="0" width="3.8" height="1" fill="#2b303c" />
      <rect x="-0.6" y="0" width="1.3" height="1" fill="#9aa4b8" opacity="0.7" />
    </g>
  )
}

// Pinzas y cuerpo del gancho. El origen (0, 0) es el extremo del cable. children: lo que sujeta (va entre las pinzas).
export function ClawHead({ children }) {
  return (
    <g>
      <g className="claw__rear" transform="translate(0 8)">
        <path
          d="M-4.5 0 H4.5 L6 34 Q7 52 -4 60 L-7 54 Q0 46 -1.5 34 Z"
          fill="#6c7688"
          stroke="#2f3646"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </g>
      {children}
      <Prong side={-1} />
      <Prong side={1} />
      <path
        d="M-24 -16 H24 Q28 -16 28 -10 V6 Q28 12 22 12 H-22 Q-28 12 -28 6 V-10 Q-28 -16 -24 -16 Z"
        fill="url(#cw-metal)"
        stroke="#2f3646"
        strokeWidth="2.6"
      />
      <rect x="-28" y="-4" width="56" height="7" fill="#e2463c" stroke="#2f3646" strokeWidth="1.6" />
      <rect x="-14" y="-26" width="28" height="11" rx="3" fill="url(#cw-metal)" stroke="#2f3646" strokeWidth="2.2" />
      <circle className="claw__led" cx="0" cy="7" r="2.6" fill="#7fffa0" />
      <circle cx="-19" cy="6" r="5.5" fill="url(#cw-gold)" stroke="#7c5a14" strokeWidth="1.6" />
      <circle cx="19" cy="6" r="5.5" fill="url(#cw-gold)" stroke="#7c5a14" strokeWidth="1.6" />
    </g>
  )
}

// Carro que corre por el riel (se mueve con el gancho en x).
export function Carriage() {
  return (
    <g>
      <rect x="-30" y="98" width="60" height="30" rx="7" fill="url(#cw-metal)" stroke="#2f3646" strokeWidth="2.4" />
      <rect x="-30" y="108" width="60" height="6" fill="#e2463c" opacity="0.9" />
      <circle cx="-16" cy="100" r="5" fill="#2f3646" />
      <circle cx="16" cy="100" r="5" fill="#2f3646" />
      <circle cx="0" cy="126" r="5" fill="#2f3646" />
    </g>
  )
}

// ---------- Mueble ----------
// Letrero con bombillas, cristal con fondo, suelo con boca del conducto, base con pantalla, palanca y botón.
export function Cabinet({ marquee = 'GANCHO', bet = 0 }) {
  const top = Array.from({ length: 17 }, (_, i) => 36 + i * 46)
  const side = Array.from({ length: 7 }, (_, i) => 128 + i * 52)
  return (
    <g>
      <rect x="0" y="0" width={W} height={H} rx="30" fill="url(#cw-casing)" />
      <rect
        x="6"
        y="6"
        width={W - 12}
        height={H - 12}
        rx="25"
        fill="none"
        stroke="#e6c35c"
        strokeWidth="3"
        opacity="0.85"
      />

      {/* Letrero */}
      <rect x="22" y="14" width="756" height="64" rx="16" fill="#1c0a1c" stroke="#e6c35c" strokeWidth="3" />
      <text x="400" y="62" textAnchor="middle" className="claw__marquee" fontSize="50" letterSpacing="9">
        {marquee}
      </text>
      {top.map((x, i) => (
        <g key={x}>
          <circle
            className={`claw__bulb claw__bulb--${i % 2 ? 'b' : 'a'}`}
            cx={x}
            cy="24"
            r="4.6"
            fill="url(#cw-bulb)"
          />
          <circle
            className={`claw__bulb claw__bulb--${i % 2 ? 'a' : 'b'}`}
            cx={x}
            cy="68"
            r="4.6"
            fill="url(#cw-bulb)"
          />
        </g>
      ))}

      {/* Cristal: pared del fondo, rayas y suelo */}
      <rect x="44" y="92" width="712" height="390" rx="8" fill="url(#cw-wall)" />
      {Array.from({ length: 12 }, (_, i) => (
        <rect key={i} x={44 + i * 59.4 + 16} y="92" width="28" height="390" fill="#fff" opacity="0.04" />
      ))}
      {Array.from({ length: 16 }, (_, i) => (
        <circle
          key={i}
          cx={64 + noise(i, 1) * 670}
          cy={106 + noise(i, 2) * 170}
          r={1 + noise(i, 9) * 1.6}
          fill="#fff"
          opacity={0.25 + noise(i, 10) * 0.4}
        />
      ))}
      <rect x="44" y="92" width="712" height="390" rx="8" fill="url(#cw-spot)" />

      {/* Riel del carro */}
      <rect x="52" y="97" width="696" height="9" rx="4" fill="url(#cw-metal)" stroke="#2f3646" strokeWidth="2" />
      <rect x="52" y="112" width="696" height="4" rx="2" fill="#000" opacity="0.25" />

      {/* Suelo y boca del conducto */}
      <rect x="44" y={FLOOR} width="712" height="14" fill="#3a1c3e" />
      <rect x="44" y={FLOOR} width="712" height="4" fill="#e6c35c" opacity="0.55" />
      <rect x="58" y={FLOOR - 2} width="108" height="16" rx="4" fill="#0e0510" stroke="#e6c35c" strokeWidth="2.4" />
      {Array.from({ length: 6 }, (_, i) => (
        <path key={i} d={`M${64 + i * 18} ${FLOOR + 14} l9 -14 h9 l-9 14 Z`} fill="#f2c94c" opacity="0.9" />
      ))}
      <rect x="170" y={FLOOR - 40} width="6" height="40" rx="2" fill="#bfeaff" opacity="0.4" />

      {/* Base */}
      <rect x="22" y="482" width="756" height="158" rx="14" fill="url(#cw-base)" stroke="#e6c35c" strokeWidth="2.4" />

      {/* Pantalla de la apuesta */}
      <rect x="262" y="514" width="214" height="84" rx="10" fill="#07140d" stroke="#e6c35c" strokeWidth="2.6" />
      <text
        x="369"
        y="540"
        textAnchor="middle"
        fontSize="15"
        fontWeight="700"
        letterSpacing="3"
        fill="#47c06a"
        opacity="0.75"
        fontFamily="var(--font-body, sans-serif)"
      >
        APUESTA
      </text>
      <text
        x="369"
        y="581"
        textAnchor="middle"
        fontSize="36"
        fontWeight="800"
        fill="#7fffa0"
        className="claw__lcd"
        fontFamily="var(--font-body, sans-serif)"
      >
        {bet.toLocaleString('es-ES')} €
      </text>
      <rect x="318" y="610" width="102" height="9" rx="4.5" fill="#0e0510" stroke="#e6c35c" strokeWidth="1.8" />

      {/* Palanca y botón */}
      <g transform="translate(560 586)">
        <ellipse cx="0" cy="8" rx="34" ry="12" fill="#0e0510" stroke="#e6c35c" strokeWidth="2" />
        <g className="claw__stick">
          <rect x="-5" y="-42" width="10" height="52" rx="4" fill="url(#cw-metal)" stroke="#2f3646" strokeWidth="2" />
          <circle cx="0" cy="-48" r="17" fill="#e2463c" stroke="#5a0f0a" strokeWidth="2.4" />
          <ellipse cx="-5" cy="-54" rx="6" ry="4" fill="#fff" opacity="0.55" />
        </g>
      </g>
      <g transform="translate(690 586)">
        <ellipse cx="0" cy="8" rx="34" ry="13" fill="#0e0510" stroke="#e6c35c" strokeWidth="2" />
        <g className="claw__button">
          <rect x="-28" y="-12" width="56" height="22" rx="10" fill="#9c1f2a" />
          <ellipse cx="0" cy="-12" rx="28" ry="12" fill="#ff5a4a" stroke="#5a0f0a" strokeWidth="2.4" />
          <ellipse cx="-6" cy="-16" rx="10" ry="4" fill="#fff" opacity="0.5" />
        </g>
      </g>

      {/* Bandeja de premios */}
      <rect x="34" y="510" width="150" height="118" rx="12" fill="#0e0510" stroke="#e6c35c" strokeWidth="2.6" />
      <rect x="44" y="520" width="130" height="100" rx="8" fill="#1d0b1c" />
      <text
        x="109"
        y="538"
        textAnchor="middle"
        fontSize="11"
        fontWeight="800"
        letterSpacing="4"
        fill="#e6c35c"
        fontFamily="var(--font-body, sans-serif)"
      >
        PREMIO
      </text>

      {/* Bombillas de los lados */}
      {side.map((y, i) => (
        <g key={y}>
          <circle
            className={`claw__bulb claw__bulb--${i % 2 ? 'a' : 'b'}`}
            cx="26"
            cy={y}
            r="4.4"
            fill="url(#cw-bulb)"
          />
          <circle
            className={`claw__bulb claw__bulb--${i % 2 ? 'b' : 'a'}`}
            cx="774"
            cy={y}
            r="4.4"
            fill="url(#cw-bulb)"
          />
        </g>
      ))}
    </g>
  )
}

// Lo que va por delante de todo: reflejos del cristal, tubo del conducto y la tapa de la bandeja.
export function GlassFront() {
  return (
    <g pointerEvents="none">
      <path d="M44 92 H330 L190 482 H44 Z" fill="#fff" opacity="0.05" />
      <path d="M380 92 H430 L290 482 H240 Z" fill="#fff" opacity="0.035" />
      <rect x="44" y="92" width="712" height="390" rx="8" fill="none" stroke="#e6c35c" strokeWidth="5" opacity="0.9" />
      <rect x="50" y="98" width="700" height="378" rx="5" fill="none" stroke="#000" strokeWidth="3" opacity="0.25" />
      {/* Tubo del conducto */}
      <rect x="62" y={FLOOR + 14} width="100" height="40" fill="url(#cw-tube)" />
      <path d="M62 484 V524 M162 484 V524" stroke="#bfeaff" strokeWidth="2.2" opacity="0.55" />
      {/* Tapa transparente de la bandeja */}
      <rect x="44" y="566" width="130" height="54" rx="6" fill="#bfeaff" opacity="0.14" />
      <path d="M44 566 H174" stroke="#e6c35c" strokeWidth="3" />
      <path d="M52 574 L90 574 L72 612 L52 612 Z" fill="#fff" opacity="0.12" />
    </g>
  )
}

// ---------- Icono del vestíbulo ----------
export function ClawIcon() {
  return (
    <svg className="game__claw" viewBox="0 0 40 40" aria-hidden="true">
      <rect x="19" y="0" width="2" height="12" className="game__claw-cable" />
      <rect x="13" y="9" width="14" height="6" rx="2" className="game__claw-metal" />
      <rect x="13" y="11" width="14" height="1.6" className="game__claw-red" />
      <path d="M14 14 Q9 20 13 26 L15 24 Q13 20 16 16 Z" className="game__claw-metal" />
      <path d="M26 14 Q31 20 27 26 L25 24 Q27 20 24 16 Z" className="game__claw-metal" />
      <path d="M20 14 V23" className="game__claw-prong" />
      <path d="M20 21 L25 26 L20 33 L15 26 Z" className="game__claw-gem" />
      <path d="M15 26 H25 M20 21 L18 26 L20 33 L22 26 Z" className="game__claw-facet" />
      <circle cx="7" cy="35" r="4.4" className="game__claw-plush" />
      <circle cx="33" cy="35" r="4.4" className="game__claw-gold" />
      <circle cx="20" cy="37" r="3.4" className="game__claw-plush2" />
    </svg>
  )
}
