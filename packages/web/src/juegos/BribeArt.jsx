// Dibujos de Sobornos (SVG a mano). Todos los personajes son inventados. Cada cargo se dibuja detrás de su mesa en un
// viewBox de 100 × 150 y cambia de cara y de pose según la reacción: idle, deal, stall, report o wire.
// Los estilos están en Bribe.css.

// Reparto: 3 cargos inventados por despacho. Las reacciones se barajan, así que ningún cargo es mejor que otro.
export const CAST = [
  [
    {
      name: 'Cosme Brillantina',
      role: 'Concejal de Urbanismo',
      skin: '#e9b896',
      hair: 'gomina',
      hairColor: '#15110e',
      suit: '#33466e',
      shirt: '#f5f0e6',
      tie: '#b4232f',
      extras: ['insignia'],
    },
    {
      name: 'Merche Quintanilla',
      role: 'Funcionaria de Registro',
      skin: '#f0c7a6',
      hair: 'bob',
      hairColor: '#5a3b2a',
      suit: '#7a6a8a',
      shirt: '#f2f2f2',
      glasses: 'redondas',
      extras: ['cadenilla'],
    },
    {
      name: 'Gildo Asfalto',
      role: 'Arquitecto municipal',
      skin: '#d8a07c',
      hair: 'canoso',
      hairColor: '#8d8d8d',
      suit: '#5b6b3f',
      shirt: '#e8e4d0',
      tie: '#e0a526',
      bigote: '#8d8d8d',
    },
  ],
  [
    {
      name: 'Anselmo Rotonda',
      role: 'Diputado de Obras',
      skin: '#e7b08c',
      hair: 'cortinilla',
      hairColor: '#3a2a20',
      suit: '#2b2b2f',
      shirt: '#f4efe6',
      tie: '#2e7d5b',
      bigote: '#3a2a20',
      extras: ['insignia'],
    },
    {
      name: 'Pili Cuñadez',
      role: 'Jefa de Contratas',
      skin: '#f2c9aa',
      hair: 'melena',
      hairColor: '#d9ab45',
      suit: '#a33a4d',
      shirt: '#fff6ec',
      extras: ['perlas'],
    },
    {
      name: 'Ulpiano Cemento',
      role: 'Ingeniero de Caminos',
      skin: '#c98d68',
      hair: 'canoso',
      hairColor: '#3a2a20',
      suit: '#4a5568',
      shirt: '#e8e4d0',
      extras: ['chaleco', 'casco'],
    },
  ],
  [
    {
      name: 'Concha Ventanilla',
      role: 'Directora General',
      skin: '#eebf9e',
      hair: 'moño',
      hairColor: '#b8b3ab',
      suit: '#1f6f78',
      shirt: '#f6f1e7',
      glasses: 'rectas',
      extras: ['perlas'],
    },
    {
      name: 'Baldomero Prórroga',
      role: 'Asesor externo',
      skin: '#dba583',
      hair: 'rizos',
      hairColor: '#2a1e18',
      suit: '#3d3d4a',
      shirt: '#e9e2d2',
      glasses: 'redondas',
      barba: '#2a1e18',
      extras: ['jersey'],
    },
    {
      name: 'Yésica Subvención',
      role: 'Consejera delegada',
      skin: '#f3cdb2',
      hair: 'melena',
      hairColor: '#2a1a14',
      suit: '#2b3a67',
      shirt: '#f4efe6',
      extras: ['insignia'],
    },
  ],
  [
    {
      name: 'Aurelio Sumario',
      role: 'Juez de Instrucción',
      skin: '#e6b794',
      hair: 'canoso',
      hairColor: '#c9c9c9',
      suit: '#17151a',
      shirt: '#f4efe6',
      glasses: 'rectas',
      bigote: '#c9c9c9',
      extras: ['toga'],
      prop: 'mazo',
    },
    {
      name: 'Regina Pliego',
      role: 'Letrada de Justicia',
      skin: '#f1c6a6',
      hair: 'moño',
      hairColor: '#3a2a22',
      suit: '#17151a',
      shirt: '#f4efe6',
      glasses: 'rectas',
      extras: ['toga'],
    },
    {
      name: 'Dámaso Alegato',
      role: 'Fiscal Jefe',
      skin: '#d19a74',
      hair: 'gomina',
      hairColor: '#111111',
      suit: '#17151a',
      shirt: '#f4efe6',
      barba: '#111111',
      extras: ['toga', 'insignia'],
    },
  ],
  [
    {
      name: 'Ignacio Protocolo',
      role: 'Secretario de Estado',
      skin: '#eab998',
      hair: 'canoso',
      hairColor: '#d8d8d8',
      suit: '#1d2a3f',
      shirt: '#f4efe6',
      tie: '#7a1f2b',
      extras: ['insignia'],
    },
    {
      name: 'Gloria Memorando',
      role: 'Subsecretaria',
      skin: '#f0c4a2',
      hair: 'bob',
      hairColor: '#cdb98a',
      suit: '#2d6a4f',
      shirt: '#f4efe6',
      glasses: 'redondas',
      extras: ['perlas'],
    },
    {
      name: 'Sebas Escolta',
      role: 'Jefe de Seguridad',
      skin: '#c58b66',
      hair: 'gomina',
      hairColor: '#0d0d0d',
      suit: '#0e0e12',
      shirt: '#e9e9e9',
      tie: '#0e0e12',
      glasses: 'sol',
      extras: ['pinganillo'],
    },
  ],
  [
    {
      name: 'Eutimio Trasfondo',
      role: 'Jefe de Gabinete',
      skin: '#e2ae8a',
      hair: 'cortinilla',
      hairColor: '#555555',
      suit: '#40302a',
      shirt: '#f1ead9',
      tie: '#c9a227',
      glasses: 'rectas',
      bigote: '#555555',
    },
    {
      name: 'Vanesa Titular',
      role: 'Directora de Comunicación',
      skin: '#f3cdb2',
      hair: 'rizos',
      hairColor: '#a5552d',
      suit: '#d8b24a',
      shirt: '#fff6ec',
      extras: ['insignia'],
    },
    {
      name: 'Casimiro Tupé',
      role: 'Presidente',
      skin: '#e5b08a',
      hair: 'tupe',
      hairColor: '#2a2220',
      suit: '#14181f',
      shirt: '#f4efe6',
      tie: '#c9a227',
      extras: ['insignia'],
    },
  ],
]

// Mesa de cada despacho.
const DESKS = [
  { top: '#c28a58', front: '#8a5a33', edge: '#5a371c' },
  { top: '#8a5a3c', front: '#5b3a2a', edge: '#3a2418' },
  { top: '#d4dbe1', front: '#98a4b0', edge: '#6d7884' },
  { top: '#6a4630', front: '#3a2418', edge: '#22140c' },
  { top: '#f1ece0', front: '#d8d1c0', edge: '#a79f8b' },
  { top: '#7a3a32', front: '#4a1f1c', edge: '#2a100e' },
]

const INK = '#241812'
const SHADE = 'rgba(0,0,0,0.2)'

function HairBack({ style, color }) {
  if (style === 'melena')
    return (
      <path
        d="M32 40 Q29 17 50 16 Q71 17 68 40 L71 76 Q60 71 50 73 Q40 71 29 76 Z"
        fill={color}
        stroke={INK}
        strokeWidth="0.8"
      />
    )
  if (style === 'bob')
    return (
      <path
        d="M32.5 42 Q30 17 50 17 Q70 17 67.5 42 L68 58 Q58 55 50 55 Q42 55 32 58 Z"
        fill={color}
        stroke={INK}
        strokeWidth="0.8"
      />
    )
  if (style === 'rizos')
    return (
      <g fill={color} stroke={INK} strokeWidth="0.8">
        {[
          [34, 34],
          [31, 44],
          [36, 22],
          [44, 16],
          [56, 16],
          [64, 22],
          [69, 34],
          [66, 44],
          [50, 14],
        ].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="7" />
        ))}
      </g>
    )
  return null
}

function HairFront({ style, color }) {
  const line = { fill: color, stroke: INK, strokeWidth: 0.8, strokeLinejoin: 'round' }
  if (style === 'gomina')
    return (
      <>
        <path d="M35 37 Q33 19 50 19.5 Q67 19 65 37 Q63 27.5 50 27 Q37 27.5 35 37Z" {...line} />
        <path
          d="M40 23.5 Q50 20.5 58 23.5"
          fill="none"
          stroke="rgba(255,255,255,0.5)"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </>
    )
  if (style === 'tupe')
    return (
      <>
        <path d="M34 38 Q27 11 48 10 Q73 9 66 38 Q64 26 50 24 Q38 26 34 38Z" {...line} />
        <path
          d="M38 17 Q50 11 62 17"
          fill="none"
          stroke="rgba(255,255,255,0.45)"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </>
    )
  if (style === 'cortinilla')
    return (
      <>
        <path d="M35.5 38 Q34 30 37 26.5 L39.5 38Z" {...line} />
        <path d="M64.5 38 Q66 30 63 26.5 L60.5 38Z" {...line} />
        <path
          d="M37 27.5 Q50 15.5 63 27 M37.6 31 Q50 20.5 62.4 30.5"
          fill="none"
          stroke={color}
          strokeWidth="1"
          strokeLinecap="round"
        />
        <ellipse cx="45" cy="25" rx="4" ry="1.5" fill="rgba(255,255,255,0.4)" />
      </>
    )
  if (style === 'canoso') return <path d="M35 38 Q33 21 50 21 Q67 21 65 38 Q63 29 50 28.5 Q37 29 35 38Z" {...line} />
  if (style === 'melena')
    return (
      <>
        <path d="M34 38 Q36 19 50 19.5 Q64 19 66 38 Q60 28 52 27.5 Q44 28 34 38Z" {...line} />
        <path d="M50 20 Q47 26 42 29" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="0.8" />
      </>
    )
  if (style === 'bob') return <path d="M34 34 Q50 10 66 34 L66 37 Q50 25 34 37Z" {...line} />
  if (style === 'moño')
    return (
      <>
        <circle cx="50" cy="14.5" r="6.5" {...line} />
        <path d="M35 37 Q33 20 50 20 Q67 20 65 37 Q62 28 50 27.5 Q38 28 35 37Z" {...line} />
      </>
    )
  if (style === 'rizos') return <path d="M36 35 Q50 21 64 35 Q58 28 50 28 Q42 28 36 35Z" {...line} />
  return null
}

function Glasses({ kind }) {
  if (kind === 'sol')
    return (
      <g>
        <rect x="37.5" y="38.5" width="11.5" height="7.5" rx="3" fill="#0b0b0e" stroke="#000" strokeWidth="0.6" />
        <rect x="51" y="38.5" width="11.5" height="7.5" rx="3" fill="#0b0b0e" stroke="#000" strokeWidth="0.6" />
        <path d="M49 41 H51 M37.5 40.5 L35 39 M62.5 40.5 L65 39" stroke="#000" strokeWidth="1" fill="none" />
        <path d="M39.5 40 L42 40 M53 40 L55.5 40" stroke="rgba(255,255,255,0.4)" strokeWidth="0.9" />
      </g>
    )
  if (kind === 'rectas')
    return (
      <g fill="rgba(200,230,255,0.18)" stroke="#2a2430" strokeWidth="1.1">
        <rect x="37.5" y="38" width="11.5" height="7.6" rx="1.8" />
        <rect x="51" y="38" width="11.5" height="7.6" rx="1.8" />
        <path d="M49 41 H51 M37.5 40 L35 39 M62.5 40 L65 39" fill="none" />
      </g>
    )
  if (kind === 'redondas')
    return (
      <g fill="rgba(200,230,255,0.18)" stroke="#2a2430" strokeWidth="1.1">
        <circle cx="43.5" cy="41.5" r="5.6" />
        <circle cx="56.5" cy="41.5" r="5.6" />
        <path d="M49 41 H51 M38 40.5 L35 39 M62 40.5 L65 39" fill="none" />
      </g>
    )
  return null
}

// Cara según la reacción: ojos, cejas y boca.
function Face({ mood, glasses }) {
  const eyeWhite = { fill: '#fff', stroke: INK, strokeWidth: 0.6 }
  const brow = { fill: 'none', stroke: INK, strokeWidth: 1.5, strokeLinecap: 'round' }
  const sun = glasses === 'sol'
  let eyes
  let brows
  let mouth
  if (mood === 'deal') {
    eyes = (
      <g fill="none" stroke={INK} strokeWidth="1.5" strokeLinecap="round">
        <path d="M40.5 42 Q43.5 38.4 46.5 42" />
        <path d="M53.5 42 Q56.5 38.4 59.5 42" />
      </g>
    )
    brows = (
      <g {...brow}>
        <path d="M40 36 Q43.5 34.4 47 35.5" />
        <path d="M53 34.2 Q57 32 60.5 33.5" />
      </g>
    )
    mouth = (
      <g>
        <path
          d="M42.5 49.5 Q50 59 57.5 49.5 Q50 52.4 42.5 49.5Z"
          fill="#fff"
          stroke={INK}
          strokeWidth="0.9"
          strokeLinejoin="round"
        />
        <rect x="53.6" y="50.6" width="2.2" height="2.2" rx="0.6" fill="#f2c94c" />
        <path d="M58.5 50 Q60 49 60.5 47.5" fill="none" stroke={INK} strokeWidth="0.8" strokeLinecap="round" />
      </g>
    )
  } else if (mood === 'stall') {
    eyes = (
      <g>
        <ellipse cx="43.5" cy="41.5" rx="2.8" ry="2.6" {...eyeWhite} />
        <ellipse cx="56.5" cy="41.5" rx="2.8" ry="2.6" {...eyeWhite} />
        <circle cx="44.6" cy="40.4" r="1.3" fill={INK} />
        <circle cx="57.6" cy="40.4" r="1.3" fill={INK} />
      </g>
    )
    brows = (
      <g {...brow}>
        <path d="M39.5 35.5 L47 33.5" />
        <path d="M60.5 35.5 L53 33.5" />
      </g>
    )
    mouth = <path d="M44.5 54 Q50 49.5 55.5 54" fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
  } else if (mood === 'report') {
    eyes = (
      <g>
        <ellipse cx="43.5" cy="42" rx="2.8" ry="2" {...eyeWhite} />
        <ellipse cx="56.5" cy="42" rx="2.8" ry="2" {...eyeWhite} />
        <circle cx="43.5" cy="42.2" r="1.2" fill={INK} />
        <circle cx="56.5" cy="42.2" r="1.2" fill={INK} />
      </g>
    )
    brows = (
      <g {...brow} strokeWidth="2">
        <path d="M38.5 35 L47.5 39" />
        <path d="M61.5 35 L52.5 39" />
      </g>
    )
    mouth = (
      <g>
        <path d="M42.5 50 Q50 63 57.5 50 Z" fill="#4a0f12" stroke={INK} strokeWidth="1" strokeLinejoin="round" />
        <path d="M44 50.4 H56 V52.6 H44Z" fill="#fff" />
        <ellipse cx="50" cy="57.6" rx="3.4" ry="2" fill="#d9565a" />
      </g>
    )
  } else if (mood === 'wire') {
    eyes = (
      <g>
        <path d="M40.5 42 Q43.5 39 46.5 42" fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
        <ellipse cx="56.5" cy="41.5" rx="2.8" ry="2.6" {...eyeWhite} />
        <circle cx="57" cy="41.6" r="1.3" fill={INK} />
      </g>
    )
    brows = (
      <g {...brow}>
        <path d="M40 36.6 Q43.5 35 47 36.2" />
        <path d="M53 33.8 Q57 31.6 60.5 33.2" />
      </g>
    )
    mouth = <path d="M44 52 Q52 57.5 58.5 48.6" fill="none" stroke={INK} strokeWidth="1.7" strokeLinecap="round" />
  } else {
    eyes = (
      <g className="bb__blink">
        <ellipse cx="43.5" cy="41.5" rx="2.7" ry="2.3" {...eyeWhite} />
        <ellipse cx="56.5" cy="41.5" rx="2.7" ry="2.3" {...eyeWhite} />
        <circle cx="43.9" cy="41.8" r="1.25" fill={INK} />
        <circle cx="56.9" cy="41.8" r="1.25" fill={INK} />
      </g>
    )
    brows = (
      <g {...brow}>
        <path d="M40 36.4 L47 36" />
        <path d="M60 36.4 L53 36" />
      </g>
    )
    mouth = <path d="M45.5 52 Q50 53.6 54.5 52" fill="none" stroke={INK} strokeWidth="1.4" strokeLinecap="round" />
  }
  return (
    <g>
      {!sun && eyes}
      {brows}
      {mouth}
      <ellipse cx="38.5" cy="48" rx="2.6" ry="1.7" fill="rgba(220,90,80,0.28)" />
      <ellipse cx="61.5" cy="48" rx="2.6" ry="1.7" fill="rgba(220,90,80,0.28)" />
    </g>
  )
}

// Un puño o una mano abierta.
const Hand = ({ x, y, skin, r = 4.2 }) => <circle cx={x} cy={y} r={r} fill={skin} stroke={INK} strokeWidth="0.8" />

// Sobre pequeño en el bolsillo interior.
const PocketEnvelope = () => (
  <g transform="translate(60 88) rotate(14)">
    <rect x="0" y="0" width="12" height="8" rx="1" fill="#f3e6c4" stroke="#7a5a22" strokeWidth="0.7" />
    <path d="M0 0 L6 4.6 L12 0" fill="none" stroke="#7a5a22" strokeWidth="0.6" />
    <rect x="3" y="-3" width="6" height="4" fill="#5aa468" stroke="#245a30" strokeWidth="0.5" />
  </g>
)

function Prop({ kind, color }) {
  if (kind === 'mazo')
    return (
      <g>
        <rect x="76" y="98" width="14" height="6" rx="1.5" fill="#7a4a24" stroke={INK} strokeWidth="0.8" />
        <rect
          x="80"
          y="92"
          width="14"
          height="6.4"
          rx="1.6"
          fill="#a8743c"
          stroke={INK}
          strokeWidth="0.8"
          transform="rotate(-18 86 96)"
        />
        <path d="M82 104 L74 96" stroke="#7a4a24" strokeWidth="2.4" strokeLinecap="round" />
      </g>
    )
  if (kind === 'carpetas')
    return (
      <g stroke={INK} strokeWidth="0.8">
        <rect x="76" y="99" width="18" height="5" rx="1" fill="#d9c27a" />
        <rect x="78" y="94.5" width="16" height="5" rx="1" fill="#b7473b" />
        <rect x="77" y="90" width="17" height="5" rx="1" fill="#4f7fa8" />
      </g>
    )
  if (kind === 'telefono')
    return (
      <g stroke={INK} strokeWidth="0.8">
        <rect x="76" y="98" width="17" height="6" rx="1.6" fill="#2d2d33" />
        <path d="M77 98 Q84 92 92 98" fill="none" stroke="#2d2d33" strokeWidth="3" strokeLinecap="round" />
        <circle cx="84" cy="101" r="1.4" fill="#aaa" />
      </g>
    )
  return (
    <g stroke={INK} strokeWidth="0.8">
      <rect x="80" y="99" width="12" height="5" rx="1" fill={color} />
      <path d="M86 99 L86 90 L80 86" fill="none" strokeWidth="2" stroke="#3a3a3a" strokeLinecap="round" />
      <path d="M75 87 H85 L82 83 H78Z" fill="#2f7d58" />
      <path d="M77 88 L69 100 H85Z" fill="rgba(255,226,140,0.25)" stroke="none" />
    </g>
  )
}

// Un cargo detrás de su mesa. mood: idle | deal | stall | report | wire.
export function Official({ spec, office, slot, mood = 'idle' }) {
  const { skin, hair, hairColor, suit, shirt, tie, glasses, bigote, barba, extras = [] } = spec
  const desk = DESKS[office]
  const toga = extras.includes('toga')
  const prop = spec.prop ?? ['lampara', 'carpetas', 'telefono'][slot]
  const shrug = mood === 'stall'
  return (
    <svg className={`bb__official is-${mood}`} viewBox="0 0 100 150" aria-hidden="true" style={{ '--i': slot }}>
      <g className="bb__bust">
        <g className="bb__head-move" transform={shrug ? 'translate(0 3)' : undefined}>
          <HairBack style={hair} color={hairColor} />
          {/* Cuello y cabeza */}
          <rect x="44" y="52" width="12" height="18" fill={skin} stroke={INK} strokeWidth="0.8" />
          <path d="M44 62 Q50 67 56 62 V70 H44Z" fill={SHADE} />
          <circle cx="36" cy="43" r="3" fill={skin} stroke={INK} strokeWidth="0.8" />
          <circle cx="64" cy="43" r="3" fill={skin} stroke={INK} strokeWidth="0.8" />
        </g>
        {/* Torso */}
        <path
          d="M17 108 Q16 76 38 68.5 L62 68.5 Q84 76 83 108 Z"
          fill={suit}
          stroke={INK}
          strokeWidth="1"
          strokeLinejoin="round"
        />
        {toga ? (
          <>
            <path d="M40 68.5 L50 96 L60 68.5 Z" fill="#fff" stroke={INK} strokeWidth="0.8" />
            {[74, 80, 86, 92].map((y, i) => (
              <path
                key={y}
                d={`M${45 + i * 1.2} ${y} Q50 ${y + 3} ${55 - i * 1.2} ${y}`}
                fill="none"
                stroke="#b9b2a0"
                strokeWidth="0.8"
              />
            ))}
            <path
              d="M24 100 Q22 80 36 71 M76 100 Q78 80 64 71"
              fill="none"
              stroke="rgba(255,255,255,0.14)"
              strokeWidth="2"
            />
          </>
        ) : (
          <>
            <path d="M40 68.5 L50 90 L60 68.5 Z" fill={shirt} stroke={INK} strokeWidth="0.8" />
            {tie ? (
              <g>
                <path d="M47 71 L53 71 L52.4 75.5 L47.6 75.5Z" fill={tie} stroke={INK} strokeWidth="0.7" />
                <path d="M47.6 75.5 L52.4 75.5 L54.4 98 L50 102 L45.6 98Z" fill={tie} stroke={INK} strokeWidth="0.7" />
                <path d="M48.4 80 L51.6 84" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
              </g>
            ) : (
              <path d="M44 69 L50 80 L56 69" fill="none" stroke="rgba(0,0,0,0.18)" strokeWidth="1" />
            )}
            <path
              d="M38 68.5 L48.5 92 L38 108 L27 101 Z"
              fill="rgba(0,0,0,0.2)"
              stroke={INK}
              strokeWidth="0.8"
              strokeLinejoin="round"
            />
            <path
              d="M62 68.5 L51.5 92 L62 108 L73 101 Z"
              fill="rgba(0,0,0,0.2)"
              stroke={INK}
              strokeWidth="0.8"
              strokeLinejoin="round"
            />
          </>
        )}
        {extras.includes('chaleco') && (
          <g>
            <path
              d="M28 103 Q26 78 40 70 L47 72 L47 108 Z M72 103 Q74 78 60 70 L53 72 L53 108 Z"
              fill="#f08a24"
              stroke={INK}
              strokeWidth="0.8"
            />
            <path d="M28 96 L47 96 M53 96 L72 96 M28 86 L47 86 M53 86 L72 86" stroke="#f1f1c8" strokeWidth="2.2" />
          </g>
        )}
        {extras.includes('jersey') && (
          <g>
            <path d="M32 71 Q50 80 68 71 L66 77 Q50 86 34 77Z" fill="#e8c14d" stroke={INK} strokeWidth="0.8" />
            <ellipse cx="44" cy="82" rx="4.4" ry="3.2" fill="#e8c14d" stroke={INK} strokeWidth="0.8" />
            <ellipse cx="56" cy="82" rx="4.4" ry="3.2" fill="#e8c14d" stroke={INK} strokeWidth="0.8" />
          </g>
        )}
        {extras.includes('perlas') && (
          <g fill="#fbf6ea" stroke="#9c9484" strokeWidth="0.4">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => {
              const t = (i - 3) / 3
              return <circle key={i} cx={50 + t * 8.4} cy={67.4 + (1 - t * t) * 4.4} r="1.5" />
            })}
          </g>
        )}
        {extras.includes('insignia') && (
          <g>
            <circle cx="35" cy="84" r="2.6" fill="#f2c94c" stroke={INK} strokeWidth="0.6" />
            <circle cx="35" cy="84" r="1" fill="#b4232f" />
          </g>
        )}
        {extras.includes('cadenilla') && (
          <path d="M37 41.5 Q36 52 39 56 M63 41.5 Q64 52 61 56" fill="none" stroke="#c8a24b" strokeWidth="0.8" />
        )}
        {extras.includes('pinganillo') && (
          <path d="M65 44 Q69 50 63 58 Q58 66 62 69" fill="none" stroke="#e4e0d8" strokeWidth="1.1" />
        )}

        {/* Cabeza por delante del torso */}
        <g className="bb__head-move" transform={shrug ? 'translate(0 3)' : undefined}>
          <ellipse cx="50" cy="40" rx="14" ry="16.5" fill={skin} stroke={INK} strokeWidth="0.9" />
          <path d="M36.5 46 Q38 58 50 58.4 Q62 58 63.5 46 Q60 56 50 56 Q40 56 36.5 46Z" fill={SHADE} />
          <path
            d="M50 42 Q48.6 46 50.6 47.6"
            fill="none"
            stroke="rgba(0,0,0,0.3)"
            strokeWidth="0.9"
            strokeLinecap="round"
          />
          {barba && (
            <path
              d="M36 44 Q37 61 50 62 Q63 61 64 44 Q61 54 50 54.5 Q39 54 36 44Z"
              fill={barba}
              stroke={INK}
              strokeWidth="0.7"
            />
          )}
          <Face mood={mood} glasses={glasses} />
          {bigote && (
            <path
              d="M42.5 49.4 Q46 47 50 48.8 Q54 47 57.5 49.4 Q54 52.4 50 50.6 Q46 52.4 42.5 49.4Z"
              fill={bigote}
              stroke={INK}
              strokeWidth="0.6"
            />
          )}
          <Glasses kind={glasses} />
          <HairFront style={hair} color={hairColor} />
          {extras.includes('casco') && (
            <g>
              <path d="M34 31 Q34 13 50 13 Q66 13 66 31Z" fill="#f2c230" stroke={INK} strokeWidth="0.9" />
              <rect x="31" y="29.5" width="38" height="4.4" rx="2" fill="#f2c230" stroke={INK} strokeWidth="0.9" />
              <path d="M50 13 V30" stroke="rgba(0,0,0,0.25)" strokeWidth="1.6" />
            </g>
          )}
        </g>

        {/* Manos sobre la mesa en reposo; en cada reacción hacen otra cosa */}
        {mood === 'idle' && (
          <g className="bb__rest">
            <rect x="32" y="100" width="9" height="5" rx="1.4" fill={shirt} stroke={INK} strokeWidth="0.6" />
            <rect x="59" y="100" width="9" height="5" rx="1.4" fill={shirt} stroke={INK} strokeWidth="0.6" />
            <ellipse cx="37" cy="106.5" rx="5.4" ry="3" fill={skin} stroke={INK} strokeWidth="0.7" />
            <ellipse cx="63" cy="106.5" rx="5.4" ry="3" fill={skin} stroke={INK} strokeWidth="0.7" />
          </g>
        )}
        {mood === 'wire' && (
          <g>
            <path d="M44 69 L50 76 L56 69" fill="#0e0e12" stroke="none" />
            <g className="bb__mic">
              <rect
                x="47.4"
                y="73.4"
                width="5.2"
                height="9.6"
                rx="2.6"
                fill="#16161a"
                stroke="#000"
                strokeWidth="0.6"
              />
              <path d="M48.2 76 H51.8 M48.2 78 H51.8 M48.2 80 H51.8" stroke="#6c6c78" strokeWidth="0.5" />
              <path d="M50 83 Q52 90 60 92" fill="none" stroke="#111" strokeWidth="1" />
              <rect x="59" y="90" width="12" height="8" rx="1.4" fill="#1b1b20" stroke="#000" strokeWidth="0.6" />
              <circle className="bb__rec" cx="62.6" cy="92.8" r="1.5" fill="#ff3b30" />
              <rect x="65" y="92" width="4.4" height="1" fill="#6c6c78" />
              <rect x="65" y="94.4" width="4.4" height="1" fill="#6c6c78" />
            </g>
            <g className="bb__rec-tag">
              <rect x="66" y="11" width="29" height="12" rx="3" fill="#1b1b20" stroke="#ff3b30" strokeWidth="1" />
              <circle className="bb__rec" cx="72.6" cy="17" r="2.2" fill="#ff3b30" />
              <text
                x="77"
                y="20.4"
                fontSize="8.4"
                fontWeight="800"
                fill="#fff"
                fontFamily="Instrument Sans Variable, sans-serif"
              >
                REC
              </text>
            </g>
            <ellipse cx="37" cy="106.5" rx="5.4" ry="3" fill={skin} stroke={INK} strokeWidth="0.7" />
            <ellipse cx="63" cy="106.5" rx="5.4" ry="3" fill={skin} stroke={INK} strokeWidth="0.7" />
          </g>
        )}
        {shrug && (
          <g className="bb__shrug">
            <g className="bb__arm bb__arm--l">
              <path
                d="M24 80 L11 94 L9 78"
                fill="none"
                stroke={INK}
                strokeWidth="10.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M24 80 L11 94 L9 78"
                fill="none"
                stroke={suit}
                strokeWidth="8.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <ellipse cx="8.6" cy="72.4" rx="4.6" ry="5" fill={skin} stroke={INK} strokeWidth="0.8" />
              <path
                d="M5 69 Q5.5 66 6.6 68 M8 67.6 Q8.4 64.6 9.6 67 M11 69 Q12 66.6 12.6 69.6"
                fill="none"
                stroke={INK}
                strokeWidth="0.8"
              />
            </g>
            <g className="bb__arm bb__arm--r">
              <path
                d="M76 80 L89 94 L91 78"
                fill="none"
                stroke={INK}
                strokeWidth="10.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M76 80 L89 94 L91 78"
                fill="none"
                stroke={suit}
                strokeWidth="8.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <ellipse cx="91.4" cy="72.4" rx="4.6" ry="5" fill={skin} stroke={INK} strokeWidth="0.8" />
              <path
                d="M95 69 Q94.5 66 93.4 68 M92 67.6 Q91.6 64.6 90.4 67 M89 69 Q88 66.6 87.4 69.6"
                fill="none"
                stroke={INK}
                strokeWidth="0.8"
              />
            </g>
            <PocketEnvelope />
            <g className="bb__dots" fill="#f1e9d6" stroke={INK} strokeWidth="0.6">
              <circle cx="70" cy="22" r="2" />
              <circle cx="77" cy="17" r="2" />
              <circle cx="85" cy="13" r="2" />
            </g>
          </g>
        )}
        {mood === 'report' && (
          <g className="bb__rage">
            <g className="bb__phone-arm">
              <path
                d="M27 80 L14 72 L28 54"
                fill="none"
                stroke={INK}
                strokeWidth="10.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M27 80 L14 72 L28 54"
                fill="none"
                stroke={suit}
                strokeWidth="8.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <rect
                x="24.4"
                y="40"
                width="6.4"
                height="15"
                rx="2"
                fill="#1b1b20"
                stroke="#000"
                strokeWidth="0.6"
                transform="rotate(-8 27 47)"
              />
              <rect x="25.6" y="43" width="3.4" height="7" rx="0.8" fill="#6cc4ff" transform="rotate(-8 27 47)" />
              <Hand x="28.6" y="54.6" skin={skin} r="3.8" />
            </g>
            <g className="bb__point-arm">
              <path
                d="M74 80 L90 74 L90 52"
                fill="none"
                stroke={INK}
                strokeWidth="10.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M74 80 L90 74 L90 52"
                fill="none"
                stroke={suit}
                strokeWidth="8.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Hand x="90" y="48" skin={skin} r="4.6" />
              <rect x="88.6" y="34" width="3.2" height="14" rx="1.6" fill={skin} stroke={INK} strokeWidth="0.8" />
            </g>
            <g className="bb__bang" fill="none" stroke="#ff4a3d" strokeWidth="2.2" strokeLinecap="round">
              <path d="M14 20 L20 26 M28 10 L31 18 M72 10 L69 18 M86 22 L80 27" />
            </g>
            <g className="bb__bang-mark">
              <path d="M47.4 2 H52.6 L51.6 13 H48.4Z" fill="#ff4a3d" stroke={INK} strokeWidth="0.8" />
              <circle cx="50" cy="17" r="2" fill="#ff4a3d" stroke={INK} strokeWidth="0.6" />
            </g>
            <path d="M58 28 L61 31 M61 28 L58 31" stroke="#c4302b" strokeWidth="1.6" strokeLinecap="round" />
          </g>
        )}
      </g>

      {/* Mesa */}
      <g>
        <Prop kind={prop} color={desk.front} />
        <path d="M5 104 H95 L100 113 H0 Z" fill={desk.top} stroke={desk.edge} strokeWidth="1" strokeLinejoin="round" />
        <path d="M12 107 H88" stroke="rgba(255,255,255,0.28)" strokeWidth="1" strokeLinecap="round" />
        <rect x="0" y="113" width="100" height="37" fill={desk.front} stroke={desk.edge} strokeWidth="1" />
        <rect x="6" y="119" width="88" height="27" rx="2" fill="none" stroke="rgba(0,0,0,0.28)" strokeWidth="1.2" />
        <rect x="0" y="113" width="100" height="3" fill="rgba(255,255,255,0.14)" />
        {office === 5 && <rect x="0" y="113" width="100" height="2" fill="#d9ae48" />}
      </g>

      {/* Apretón de manos y contrato */}
      {mood === 'deal' && (
        <g className="bb__deal">
          <g className="bb__contract" transform="translate(5 91) rotate(-6)">
            <rect x="0" y="0" width="24" height="17" rx="1" fill="#fbf6e6" stroke={INK} strokeWidth="0.8" />
            <path d="M3 4 H21 M3 7.4 H21 M3 10.8 H15" stroke="#9c9484" strokeWidth="0.9" />
            <path d="M16 14.4 q2 -2.6 3.6 0 q1.4 1.6 2.4 -0.4" fill="none" stroke="#2a3f7a" strokeWidth="0.8" />
            <circle cx="20" cy="4" r="3" fill="#d9a82b" stroke="#7a5510" strokeWidth="0.6" />
            <path d="M18.4 6.4 L17.4 11 L20 9.4 L22.6 11 L21.6 6.4" fill="#b4232f" />
          </g>
          {/* Brazo del cargo */}
          <path
            d="M72 76 L80 90 L58 104"
            fill="none"
            stroke={INK}
            strokeWidth="11.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M72 76 L80 90 L58 104"
            fill="none"
            stroke={suit}
            strokeWidth="9.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect
            x="52"
            y="101.4"
            width="6.4"
            height="9"
            rx="1.4"
            fill={shirt}
            stroke={INK}
            strokeWidth="0.6"
            transform="rotate(-62 55 106)"
          />
          {/* Brazo del jugador, con su gabardina */}
          <path
            d="M16 144 L26 122 L44 108"
            fill="none"
            stroke="#6b5a3c"
            strokeWidth="14"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M16 144 L26 122 L44 108"
            fill="none"
            stroke="#b79a6b"
            strokeWidth="12"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M20 134 L32 140" stroke="#8f7648" strokeWidth="1.4" />
          <rect
            x="40"
            y="103.6"
            width="6.4"
            height="9"
            rx="1.4"
            fill="#e9e2d0"
            stroke={INK}
            strokeWidth="0.6"
            transform="rotate(-48 43 108)"
          />
          <ellipse cx="50.4" cy="106.4" rx="7.6" ry="4.6" fill="#d9a888" stroke={INK} strokeWidth="0.8" />
          <ellipse cx="54.6" cy="105.2" rx="5.6" ry="4" fill={skin} stroke={INK} strokeWidth="0.8" />
          <path d="M49 104 Q52 102 55 103.4 M49.6 107 Q53 105 56.6 106.4" fill="none" stroke={INK} strokeWidth="0.6" />
          <g className="bb__shine" fill="#fff6c8">
            <path d="M52 94 l1.2 3 l3 1.2 l-3 1.2 l-1.2 3 l-1.2 -3 l-3 -1.2 l3 -1.2Z" />
          </g>
        </g>
      )}
    </svg>
  )
}

// Sobre con un billete asomando.
export function Envelope() {
  return (
    <svg className="bb__envelope" viewBox="0 0 64 44" aria-hidden="true">
      <rect
        x="14"
        y="2"
        width="30"
        height="16"
        rx="2"
        fill="#5aa468"
        stroke="#245a30"
        strokeWidth="1.2"
        transform="rotate(-8 29 10)"
      />
      <circle cx="29" cy="9" r="4" fill="none" stroke="#c8efc9" strokeWidth="1.1" transform="rotate(-8 29 10)" />
      <rect x="4" y="12" width="56" height="30" rx="3" fill="#f3e6c4" stroke="#7a5a22" strokeWidth="1.5" />
      <path d="M4 14 L32 32 L60 14" fill="none" stroke="#7a5a22" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M4 41 L24 26 M60 41 L40 26" fill="none" stroke="#b99a58" strokeWidth="1" />
      <circle cx="32" cy="30" r="4.6" fill="#b4232f" stroke="#6b1018" strokeWidth="1" />
      <path d="M30.2 30 H33.8 M30.6 28.4 H33.4 M30.6 31.6 H33.4" stroke="#fbd5d0" strokeWidth="0.8" />
    </svg>
  )
}

// Un taco de billetes.
function Stack({ x, y, w = 26, h = 26, tone = 0 }) {
  const greens = ['#4f9a5b', '#5b8fb8', '#b8923a']
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="2" fill={greens[tone]} stroke="#1f3a28" strokeWidth="1.2" />
      {[0.25, 0.5, 0.75].map((t) => (
        <path key={t} d={`M${x + 1} ${y + h * t} H${x + w - 1}`} stroke="rgba(255,255,255,0.28)" strokeWidth="1" />
      ))}
      <rect
        x={x + w * 0.36}
        y={y - 1}
        width={w * 0.28}
        height={h + 2}
        fill="#e8d9a0"
        stroke="#7a6a30"
        strokeWidth="0.8"
      />
      <circle cx={x + w / 2} cy={y + h * 0.5} r="3.4" fill="none" stroke="#7a6a30" strokeWidth="0.8" />
      <rect x={x} y={y} width={w} height="4.6" rx="2" fill="rgba(255,255,255,0.26)" />
    </g>
  )
}

// Maletín abierto con fajos. level: 0 (casi vacío) a 3 (rebosa).
export function Briefcase({ level = 1, shut = false }) {
  const stacks = level >= 2 ? [0, 1, 2] : level === 1 ? [0, 2] : [1]
  return (
    <svg className={`bb__case ${shut ? 'is-shut' : ''}`} viewBox="0 0 140 104" aria-hidden="true">
      <g className="bb__case-lid" style={shut ? undefined : { transformOrigin: '70px 52px' }}>
        <path
          d="M18 8 H122 Q128 8 127 14 L120 52 H20 L13 14 Q12 8 18 8Z"
          fill="#6e3f20"
          stroke="#2a150a"
          strokeWidth="2"
        />
        <path d="M24 14 H116 L111 46 H29Z" fill="#3a2010" />
        <path d="M24 14 H116 L111 46 H29Z" fill="none" stroke="#c8a24b" strokeWidth="0.8" strokeDasharray="3 2.4" />
      </g>
      {!shut &&
        stacks.map((i) => (
          <Stack key={i} x={22 + i * 38} y={level >= 3 ? 16 + (i % 2) * 4 : 24 + (i % 2) * 3} tone={i} />
        ))}
      {!shut && level >= 3 && (
        <g>
          <rect
            x="30"
            y="8"
            width="24"
            height="12"
            rx="1.5"
            fill="#6aae76"
            stroke="#245a30"
            strokeWidth="1"
            transform="rotate(-14 42 14)"
          />
          <rect
            x="82"
            y="6"
            width="24"
            height="12"
            rx="1.5"
            fill="#6aae76"
            stroke="#245a30"
            strokeWidth="1"
            transform="rotate(12 94 12)"
          />
          <rect
            x="56"
            y="2"
            width="24"
            height="12"
            rx="1.5"
            fill="#7bbd86"
            stroke="#245a30"
            strokeWidth="1"
            transform="rotate(-3 68 8)"
          />
        </g>
      )}
      <path d="M8 52 H132 V94 Q132 100 126 100 H14 Q8 100 8 94Z" fill="#8a5028" stroke="#2a150a" strokeWidth="2" />
      <rect x="8" y="52" width="124" height="6" fill="#3a2010" />
      <path d="M14 66 H126 M14 92 H126" stroke="#c8a24b" strokeWidth="0.8" strokeDasharray="3 2.4" fill="none" />
      <path d="M52 70 Q70 58 88 70" fill="none" stroke="#2a150a" strokeWidth="6" strokeLinecap="round" />
      <path d="M52 70 Q70 58 88 70" fill="none" stroke="#c8a24b" strokeWidth="3" strokeLinecap="round" />
      {[28, 112].map((x) => (
        <g key={x}>
          <rect x={x - 8} y="60" width="16" height="16" rx="2.4" fill="#d9ae48" stroke="#5a3d0a" strokeWidth="1.2" />
          <circle cx={x} cy="66.6" r="2" fill="#5a3d0a" />
          <rect x={x - 1} y="67" width="2" height="5" fill="#5a3d0a" />
        </g>
      ))}
      <path d="M12 56 H128" stroke="rgba(255,255,255,0.16)" strokeWidth="1.2" />
    </svg>
  )
}

// Sello dorado de contrato adjudicado, con el multiplicador en el centro.
export function ContractStamp({ label }) {
  return (
    <svg className="bb__stamp-svg" viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <path id="bb-arc-top" d="M16 60 A44 44 0 0 1 104 60" />
        <path id="bb-arc-bot" d="M10 60 A50 50 0 0 0 110 60" />
      </defs>
      <circle cx="60" cy="60" r="56" fill="none" stroke="currentColor" strokeWidth="4" />
      <circle cx="60" cy="60" r="50" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="60" cy="60" r="31" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <text
        fontSize="11.4"
        fontWeight="800"
        letterSpacing="1.2"
        fill="currentColor"
        fontFamily="Instrument Sans Variable, sans-serif"
      >
        <textPath href="#bb-arc-top" startOffset="50%" textAnchor="middle">
          CONTRATO ADJUDICADO
        </textPath>
      </text>
      <text
        fontSize="9.4"
        fontWeight="800"
        letterSpacing="1.6"
        fill="currentColor"
        fontFamily="Instrument Sans Variable, sans-serif"
      >
        <textPath href="#bb-arc-bot" startOffset="50%" textAnchor="middle">
          ★ SIN CONCURSO ★
        </textPath>
      </text>
      <text x="60" y="71" textAnchor="middle" fontSize="30" fill="currentColor" fontFamily="Abril Fatface, serif">
        {label}
      </text>
    </svg>
  )
}

// Rotativo de policía (rojo o azul).
export function Siren({ tone }) {
  return (
    <svg className={`bb__siren bb__siren--${tone}`} viewBox="0 0 40 52" aria-hidden="true">
      <path d="M8 48 H32 V42 H8Z" fill="#2b2b30" stroke="#000" strokeWidth="1" />
      <path d="M10 42 V26 Q10 10 20 10 Q30 10 30 26 V42Z" className="bb__siren-dome" stroke="#000" strokeWidth="1" />
      <path
        d="M14 38 V26 Q14 16 19 14"
        fill="none"
        stroke="rgba(255,255,255,0.65)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path d="M20 4 V0 M8 8 L5 4 M32 8 L35 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

// Icono del lobby: un maletín con un billete asomando y un sobre por delante.
export function BribeIcon() {
  return (
    <svg className="game__bribe" viewBox="0 0 40 40" aria-hidden="true">
      <rect x="14" y="5" width="16" height="12" rx="1.5" className="game__bribe-bill" transform="rotate(10 22 11)" />
      <circle cx="22" cy="11" r="2.6" className="game__bribe-coin" transform="rotate(10 22 11)" />
      <path d="M4 18 Q4 15 7 15 H33 Q36 15 36 18 V33 Q36 36 33 36 H7 Q4 36 4 33Z" className="game__bribe-case" />
      <path d="M15 15 V12.5 Q15 11 16.5 11 H23.5 Q25 11 25 12.5 V15" className="game__bribe-handle" />
      <rect x="17" y="20" width="6" height="6" rx="1" className="game__bribe-latch" />
      <rect x="5" y="23" width="17" height="12" rx="1.6" className="game__bribe-env" transform="rotate(-8 13 29)" />
      <path d="M5.4 23.6 L13.5 30 L21.6 23.6" className="game__bribe-flap" transform="rotate(-8 13 29)" />
    </svg>
  )
}
