// Decorado de cada despacho de Sobornos (SVG a mano, viewBox 160 × 90): pared, suelo y atrezo propio. Todo genérico:
// sin banderas, escudos ni símbolos de partidos. Los cargos quedan por delante; los huecos entre mesas están en x ≈ 59 y 101.
// Los estilos están en Bribe.css.
const MOTES = Array.from({ length: 10 }, (_, i) => ({
  x: 10 + ((i * 47) % 140),
  y: 16 + ((i * 31) % 52),
  r: 0.35 + (i % 3) * 0.2,
}))

// Suelo en perspectiva: baldosas.
function Floor({ y = 58, a, b, line = 'rgba(0,0,0,0.3)' }) {
  const rows = [y + 7, y + 16, y + 26]
  return (
    <g>
      <rect x="0" y={y} width="160" height={90 - y} fill={a} />
      <path d={`M0 ${y} H160 V${y + 1.6} H0Z`} fill="rgba(0,0,0,0.3)" />
      <g fill="none" stroke={line} strokeWidth="0.4">
        {rows.map((r) => (
          <path key={r} d={`M0 ${r} H160`} />
        ))}
        {Array.from({ length: 15 }, (_, i) => (
          <path key={i} d={`M${80 + (i - 7) * 5} ${y} L${80 + (i - 7) * 17} 90`} />
        ))}
      </g>
      <rect x="0" y={y} width="160" height="9" fill={b} opacity="0.35" />
    </g>
  )
}

function Plant({ x, y, s = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-4 0 H4 L3 -7 H-3Z" fill="#9a5a3a" stroke="#2a150a" strokeWidth="0.4" />
      <path
        d="M0 -7 Q-8 -14 -7 -22 Q-2 -17 0 -9 M0 -7 Q8 -15 7 -23 Q2 -17 0 -9 M0 -7 Q-1 -18 0 -26 Q2 -18 0 -9"
        fill="#3f8a4f"
        stroke="#1d4a28"
        strokeWidth="0.4"
      />
    </g>
  )
}

function Window({ x, y, w = 22, h = 30, sky = '#9ccfe8' }) {
  return (
    <g>
      <rect
        x={x - 1.6}
        y={y - 1.6}
        width={w + 3.2}
        height={h + 3.2}
        rx="1.2"
        fill="#e8dfc8"
        stroke="#3b2a18"
        strokeWidth="0.6"
      />
      <rect x={x} y={y} width={w} height={h} fill={sky} />
      <path d={`M${x} ${y + h * 0.72} H${x + w} V${y + h} H${x}Z`} fill="#6a9a5a" opacity="0.7" />
      <path
        d={`M${x + w * 0.1} ${y + h * 0.72} h${w * 0.2} v-6 h${w * 0.18} v6 h${w * 0.22} v-9 h${w * 0.2} v9Z`}
        fill="#8a7a6a"
        opacity="0.8"
      />
      <path d={`M${x + w / 2} ${y} V${y + h} M${x} ${y + h * 0.45} H${x + w}`} stroke="#e8dfc8" strokeWidth="1.2" />
    </g>
  )
}

function Clock({ x, y }) {
  return (
    <g>
      <circle cx={x} cy={y} r="6.2" fill="#f5efe0" stroke="#3b2a18" strokeWidth="1" />
      <path
        d={`M${x} ${y} V${y - 4} M${x} ${y} L${x + 3} ${y + 1.4}`}
        stroke="#2a1a0c"
        strokeWidth="0.9"
        strokeLinecap="round"
      />
      <circle cx={x} cy={y} r="0.8" fill="#b4232f" />
    </g>
  )
}

// Estantería con archivadores.
function Shelves({ x, y, w, h, rows = 4, hue = 0 }) {
  const cols = ['#b4503f', '#3f6fa8', '#c9a227', '#4f8a5a', '#8a5a9a', '#d9d0b8']
  const rh = h / rows
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#2a1a10" stroke="#120a05" strokeWidth="0.6" />
      {Array.from({ length: rows }, (_, r) => (
        <g key={r}>
          {Array.from({ length: Math.floor((w - 2) / 2.6) }, (_, i) => {
            const hh = rh - 2.4 - ((i * 7 + r * 3) % 4) * 0.7
            return (
              <rect
                key={i}
                x={x + 1.2 + i * 2.6}
                y={y + (r + 1) * rh - 1 - hh}
                width="2.2"
                height={hh}
                fill={cols[(i + r * 2 + hue) % cols.length]}
                stroke="rgba(0,0,0,0.4)"
                strokeWidth="0.25"
              />
            )
          })}
          <rect x={x} y={y + (r + 1) * rh - 1} width={w} height="1.2" fill="#5a3a22" />
        </g>
      ))}
    </g>
  )
}

function Chandelier({ x, y, s = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M0 -20 V0" stroke="#c8a24b" strokeWidth="0.8" />
      <path d="M-14 6 Q0 14 14 6 M-9 2 Q0 8 9 2" fill="none" stroke="#c8a24b" strokeWidth="1.2" />
      <path d="M-3 0 H3 L5 6 H-5Z" fill="#c8a24b" />
      {[-14, -7, 0, 7, 14].map((dx) => (
        <g key={dx} className="bb__candle">
          <rect x={dx - 0.8} y={dx === 0 ? -4 : 2} width="1.6" height="4" fill="#f5efe0" />
          <ellipse cx={dx} cy={dx === 0 ? -6 : 0} rx="1.1" ry="1.9" fill="#ffd27a" />
          <circle cx={dx} cy={dx === 0 ? -6 : 0} r="4.5" fill="rgba(255,210,120,0.2)" />
        </g>
      ))}
    </g>
  )
}

function Scales({ x, y, s = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <circle cx="0" cy="0" r="17" fill="rgba(0,0,0,0.25)" stroke="#c8a24b" strokeWidth="1" />
      <path d="M0 -12 V12 M-4 12 H4 M-13 -7 H13" stroke="#e8c46a" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <path
        d="M-13 -7 L-17 3 H-9Z M13 -7 L9 3 H17Z"
        fill="none"
        stroke="#e8c46a"
        strokeWidth="0.9"
        strokeLinejoin="round"
      />
      <path d="M-18 3 Q-13 8 -8 3Z M8 3 Q13 8 18 3Z" fill="#e8c46a" />
      <circle cx="0" cy="-13.4" r="1.6" fill="#e8c46a" />
    </g>
  )
}

function Column({ x, w = 8, wall = '#cfc8b8' }) {
  return (
    <g>
      <rect x={x - w / 2} y="0" width={w} height="62" fill={wall} stroke="rgba(0,0,0,0.35)" strokeWidth="0.4" />
      <path d={`M${x - w / 6} 0 V62 M${x + w / 6} 0 V62`} stroke="rgba(0,0,0,0.12)" strokeWidth="0.5" />
      <rect
        x={x - w / 2 - 1.4}
        y="0"
        width={w + 2.8}
        height="3.4"
        fill="#e6dfce"
        stroke="rgba(0,0,0,0.35)"
        strokeWidth="0.4"
      />
      <rect
        x={x - w / 2 - 1.4}
        y="58.6"
        width={w + 2.8}
        height="3.4"
        fill="#e6dfce"
        stroke="rgba(0,0,0,0.35)"
        strokeWidth="0.4"
      />
    </g>
  )
}

const WALLS = ['#b9a47a', '#5a3d2a', '#8aa4b8', '#3a261a', '#c9c2b0', '#5a1f24']
const FLOORS = [
  ['#6b5b42', '#3a2f20'],
  ['#4a3426', '#241812'],
  ['#8a949c', '#4a545c'],
  ['#2a1c14', '#120a06'],
  ['#d8d2c2', '#8a8472'],
  ['#4a1620', '#1f070c'],
]

// Atrezo de cada despacho.
function Props({ office }) {
  if (office === 0)
    return (
      <>
        <Window x={14} y={8} />
        <Window x={124} y={8} />
        <Clock x={52} y={26} />
        {/* Plano de urbanismo */}
        <rect x="66" y="22" width="28" height="18" rx="0.8" fill="#efe6c8" stroke="#3b2a18" strokeWidth="0.8" />
        <path d="M68 30 H92 M68 35 H92 M78 24 V38 M86 24 V38" stroke="#9c8c5a" strokeWidth="0.4" />
        <rect x="69" y="25" width="7" height="4" fill="#d9a88a" />
        <rect x="80" y="31" width="5" height="5" fill="#8fc09a" />
        <rect x="87" y="25" width="4" height="4" fill="#9ab4d0" />
        <path d="M70 38 L90 37" stroke="#b4232f" strokeWidth="0.7" strokeDasharray="1.4 1" />
        <Plant x={6} y={60} />
        <Plant x={154} y={60} />
      </>
    )
  if (office === 1)
    return (
      <>
        <Shelves x={4} y={6} w={44} h={46} rows={5} />
        <Shelves x={112} y={6} w={44} h={46} rows={5} hue={2} />
        <path d="M80 0 V8" stroke="#c8a24b" strokeWidth="0.6" />
        <path d="M70 8 H90 L87 16 H73Z" fill="#2f7d58" stroke="#0e2a1c" strokeWidth="0.6" />
        <rect x="68" y="22" width="24" height="16" rx="0.8" fill="#efe6c8" stroke="#3b2a18" strokeWidth="0.8" />
        <path d="M71 27 H89 M71 31 H89 M71 35 H82" stroke="#9c8c5a" strokeWidth="0.7" />
        <circle cx="86" cy="34" r="2.6" fill="#b4232f" opacity="0.8" />
      </>
    )
  if (office === 2)
    return (
      <>
        {[18, 80, 142].map((x) => (
          <rect key={x} x={x - 12} y="2" width="24" height="3" rx="1" fill="#f1f6fa" opacity="0.9" />
        ))}
        <rect x="8" y="9" width="40" height="32" rx="1.4" fill="#f4f8fb" stroke="#4a5864" strokeWidth="0.8" />
        {[0, 1, 2, 3, 4].map((i) => (
          <rect
            key={i}
            x={13 + i * 7}
            y={36 - (6 + i * 5.2)}
            width="4.6"
            height={6 + i * 5.2}
            fill={i === 4 ? '#e2463c' : '#4f87b8'}
          />
        ))}
        <path d="M11 38 H46" stroke="#4a5864" strokeWidth="0.5" />
        <rect x="112" y="9" width="40" height="32" rx="1.4" fill="#16202a" stroke="#4a5864" strokeWidth="0.8" />
        <path
          d="M117 34 L125 28 L133 31 L141 17 L148 14"
          fill="none"
          stroke="#58c47c"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <path d="M117 36 H148" stroke="#3a4c5c" strokeWidth="0.4" />
        <rect
          x="68"
          y="14"
          width="24"
          height="26"
          fill="rgba(255,255,255,0.22)"
          stroke="rgba(255,255,255,0.5)"
          strokeWidth="0.6"
        />
        <path d="M68 24 H92" stroke="rgba(255,255,255,0.6)" strokeWidth="2" />
        <Plant x={55} y={60} s={0.9} />
        <Plant x={105} y={60} s={0.9} />
      </>
    )
  if (office === 3)
    return (
      <>
        <rect x="0" y="0" width="160" height="62" fill="rgba(0,0,0,0.12)" />
        {[0, 1, 2, 3, 4].map((i) => (
          <path key={i} d={`M${6 + i * 36} 0 V62`} stroke="rgba(0,0,0,0.4)" strokeWidth="0.8" />
        ))}
        <Shelves x={6} y={10} w={36} h={34} rows={3} hue={1} />
        <Shelves x={118} y={10} w={36} h={34} rows={3} hue={3} />
        <Scales x={80} y={24} s={1.1} />
        <rect x="64" y="44" width="32" height="3" fill="#5a3a22" stroke="#120a05" strokeWidth="0.5" />
      </>
    )
  if (office === 4)
    return (
      <>
        <Column x={8} w={9} />
        <Column x={152} w={9} />
        <Column x={30} w={7} />
        <Column x={130} w={7} />
        <rect x="46" y="8" width="68" height="46" fill="rgba(0,0,0,0.16)" />
        <Window x={50} y={12} w={20} h={34} sky="#cfe2f0" />
        <Window x={90} y={12} w={20} h={34} sky="#cfe2f0" />
        <path
          d="M44 8 Q50 30 46 54 M116 8 Q110 30 114 54"
          stroke="#7a2a3a"
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
          opacity="0.85"
        />
        <Chandelier x={80} y={20} s={0.9} />
      </>
    )
  return (
    <>
      <path
        d="M0 0 H34 Q30 30 36 62 H0Z M160 0 H126 Q130 30 124 62 H160Z"
        fill="#7a1822"
        stroke="#2a060a"
        strokeWidth="0.6"
      />
      <path
        d="M8 0 Q6 30 9 62 M18 0 Q16 30 19 62 M142 0 Q144 30 141 62 M152 0 Q154 30 151 62"
        stroke="rgba(0,0,0,0.3)"
        strokeWidth="0.8"
        fill="none"
      />
      <path d="M34 28 Q40 30 36 36 M126 28 Q120 30 124 36" stroke="#d9ae48" strokeWidth="1.4" fill="none" />
      <rect x="48" y="9" width="64" height="38" rx="1" fill="#2a160e" stroke="#c8a24b" strokeWidth="1.6" />
      <rect x="52" y="13" width="56" height="30" fill="#7ea7bf" />
      <path d="M52 43 V32 L66 24 L76 32 L90 20 L108 34 V43Z" fill="#4a6a5a" />
      <circle cx="96" cy="22" r="4" fill="#f5e6a0" />
      <Chandelier x={80} y={0} s={0.8} />
      <g transform="translate(142 56)">
        <circle cx="0" cy="-8" r="7" fill="#2f5d8a" stroke="#c8a24b" strokeWidth="0.8" />
        <path d="M-6 -6 Q0 -12 6 -6 M-6 -9 Q0 -4 6 -9" fill="none" stroke="#7ac07a" strokeWidth="1.4" />
        <path d="M-4 0 H4 M0 -1 V-2" stroke="#c8a24b" strokeWidth="1.6" />
      </g>
    </>
  )
}

export default function OfficeScene({ office, top }) {
  const [a, b] = FLOORS[office]
  return (
    <svg className="bb__scene" viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="160" height="90" fill={WALLS[office]} />
      {office === 1 || office === 3 ? (
        <g stroke="rgba(0,0,0,0.25)" strokeWidth="0.5">
          {Array.from({ length: 27 }, (_, i) => (
            <path key={i} d={`M${i * 6} 0 V62`} />
          ))}
        </g>
      ) : (
        <rect width="160" height="62" fill="url(#bb-s-wall)" />
      )}
      <defs>
        <linearGradient id="bb-s-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgba(255,255,255,0.18)" />
          <stop offset="1" stopColor="rgba(0,0,0,0.25)" />
        </linearGradient>
        <radialGradient id="bb-s-lamp" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="rgba(255,226,150,0.55)" />
          <stop offset="1" stopColor="rgba(255,226,150,0)" />
        </radialGradient>
      </defs>
      <rect y="56" width="160" height="3" fill="rgba(0,0,0,0.3)" />
      <Props office={office} />
      <Floor y={59} a={a} b={b} />
      {office === 5 && <path d="M58 59 H102 L130 90 H30Z" fill="#8a1d2a" stroke="#d9ae48" strokeWidth="1" />}
      {office === 4 && (
        <g fill="rgba(0,0,0,0.1)">
          {Array.from({ length: 8 }, (_, i) => (
            <rect key={i} x={i * 20} y={i % 2 ? 59 : 68} width="20" height="9" />
          ))}
        </g>
      )}
      <ellipse cx="80" cy="30" rx="70" ry="30" fill="url(#bb-s-lamp)" />
      {MOTES.map((m, i) => (
        <circle key={i} className="bb__mote" cx={m.x} cy={m.y} r={m.r} style={{ '--i': i }} />
      ))}
      {top && <rect width="160" height="90" fill="rgba(255,214,100,0.12)" />}
    </svg>
  )
}
