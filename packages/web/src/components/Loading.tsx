import { temaDeTemporada } from '../lib/temporada'
import { Nieve } from './Pattern'

// Se lee la fecha directamente (no el contexto): el loader también se pinta como
// fallback de Suspense y fuera del ThemeProvider.
export default function Loading() {
  if (temaDeTemporada() === 'navidad') return <LoadingNavidad />
  return <LoadingTerminal />
}

/* ── Árbol de carga (Navidad) ───────────────────────────────────────────────
   Tres pisos con borde ondulado, una guirnalda de luces que se encienden en
   cadena (hace de «barra de carga»), estrella con halo, regalos y destellos. */

/** Punto de una curva cuadrática de Bézier. */
const bez = (p0: number, c: number, p1: number, t: number) => (1 - t) ** 2 * p0 + 2 * (1 - t) * t * c + t ** 2 * p1

/** Guirnaldas: [inicio, control, fin] de cada tramo y nº de luces. */
const GUIRNALDAS = [
  { a: [43, 44], c: [60, 54], b: [77, 41.5], n: 5 },
  { a: [33, 70], c: [60, 84], b: [87, 66.5], n: 7 },
  { a: [24, 102], c: [60, 118], b: [96, 97.5], n: 9 },
] as const

const COLORES_LUZ = ['luz-rosa', 'luz-oro', 'luz-azul', 'luz-nieve'] as const
const PASO = 0.11 // s entre luz y luz

const LUCES = GUIRNALDAS.flatMap(g =>
  Array.from({ length: g.n }, (_, i) => {
    const t = (i + 0.5) / g.n
    return { x: bez(g.a[0], g.c[0], g.b[0], t), y: bez(g.a[1], g.c[1], g.b[1], t) }
  }),
).map((l, i) => ({ ...l, i, color: COLORES_LUZ[i % COLORES_LUZ.length] }))

const CICLO = LUCES.length * PASO + 1.2

const DESTELLOS = [
  { x: 14, y: 30, s: 1, d: 0 }, { x: 104, y: 22, s: 0.8, d: 0.9 }, { x: 108, y: 64, s: 0.6, d: 1.7 },
  { x: 10, y: 78, s: 0.7, d: 2.3 }, { x: 96, y: 40, s: 0.5, d: 1.2 },
]

/** Piso del abeto: vértice arriba, laterales curvos y borde inferior ondulado. */
function piso(cima: number, base: number, ancho: number, ondas: number) {
  const l = 60 - ancho, r = 60 + ancho, tramo = (r - l) / ondas, alto = base - cima
  let d = `M60 ${cima} C${60 - ancho * 0.25} ${cima + alto * 0.55} ${l + ancho * 0.35} ${base - 5} ${l} ${base}`
  for (let k = 0; k < ondas; k++) {
    const x0 = l + tramo * k, x1 = x0 + tramo
    d += ` Q${(x0 + x1) / 2} ${base + 4.5} ${x1} ${base}`
  }
  return d + ` C${r - ancho * 0.35} ${base - 5} ${60 + ancho * 0.25} ${cima + alto * 0.55} 60 ${cima} Z`
}

/** De abajo arriba, para que cada piso quede por encima del de debajo. */
const PISOS = [piso(54, 110, 44, 5), piso(34, 80, 34, 4), piso(16, 52, 24, 3)]

function LoadingNavidad() {
  return (
    <div className="relative flex items-center justify-center h-full min-h-screen bg-bg overflow-hidden" aria-live="polite" aria-busy="true">
      <div className="absolute inset-0" aria-hidden="true"><Nieve densidad={0.6} /></div>
      <div className="relative flex flex-col items-center gap-4" role="status" aria-label="Cargando">
        <svg viewBox="0 0 120 140" className="arbol-loader w-44 h-52" aria-hidden="true">
          <defs>
            <linearGradient id="abeto" x1="0.15" y1="0" x2="0.95" y2="1">
              <stop offset="0%" stopColor="rgb(var(--c-teal-light))" />
              <stop offset="55%" stopColor="rgb(var(--c-teal))" />
              <stop offset="100%" stopColor="rgb(var(--c-teal-dark))" />
            </linearGradient>
            <radialGradient id="halo">
              <stop offset="0%" stopColor="rgb(var(--c-gold-light))" stopOpacity="0.85" />
              <stop offset="100%" stopColor="rgb(var(--c-gold-light))" stopOpacity="0" />
            </radialGradient>
            <clipPath id="mitad"><rect x="0" y="0" width="58" height="140" /></clipPath>
            <linearGradient id="tronco" x1="0" x2="1">
              <stop offset="0%" stopColor="#8a6040" />
              <stop offset="100%" stopColor="#5b3d26" />
            </linearGradient>
          </defs>

          {/* sombra en el suelo */}
          <ellipse cx="60" cy="131" rx="48" ry="4.5" fill="rgb(var(--c-ov) / 0.12)" />

          {/* tronco */}
          <rect x="54" y="110" width="12" height="16" rx="2" fill="url(#tronco)" />

          {/* copa: de abajo arriba para que cada piso pise al de debajo */}
          {PISOS.map((d, i) => <path key={i} d={d} fill="url(#abeto)" />)}
          {/* brillo del lado iluminado */}
          {PISOS.map((d, i) => <path key={`b${i}`} d={d} fill="rgb(255 255 255 / 0.08)" clipPath="url(#mitad)" />)}

          {/* cable de las luces */}
          {GUIRNALDAS.map((g, i) => (
            <path key={i} d={`M${g.a[0]} ${g.a[1]} Q${g.c[0]} ${g.c[1]} ${g.b[0]} ${g.b[1]}`}
              fill="none" stroke="rgb(var(--c-teal-dark))" strokeOpacity="0.9" strokeWidth="0.8" />
          ))}

          {/* luces: se encienden una tras otra, como una barra de carga */}
          {LUCES.map(l => (
            <g key={l.i} className={`luz ${l.color}`} style={{ animationDelay: `${l.i * PASO}s`, animationDuration: `${CICLO}s` }}>
              <circle cx={l.x} cy={l.y} r="5.5" className="luz-brillo" />
              <circle cx={l.x} cy={l.y} r="2.7" className="luz-bombilla" />
            </g>
          ))}

          {/* regalos */}
          <g>
            <rect x="26" y="114" width="20" height="16" rx="2" fill="#f43f5e" />
            <rect x="34" y="114" width="4" height="16" fill="rgb(var(--c-gold-light))" />
            <rect x="26" y="119" width="20" height="3.5" fill="rgb(var(--c-gold-light))" />
            <path d="M36 114 q-6 -6 -8 -1 q2 3 8 1 q6 -6 8 -1 q-2 3 -8 1" fill="none" stroke="rgb(var(--c-gold-light))" strokeWidth="1.6" strokeLinejoin="round" />
          </g>
          <g>
            <rect x="72" y="118" width="22" height="12" rx="2" fill="rgb(var(--c-primary))" />
            <rect x="81" y="118" width="4" height="12" fill="rgb(var(--c-nieve))" />
            <path d="M83 118 q-5 -5 -7 -1 q2 2.5 7 1 q5 -5 7 -1 q-2 2.5 -7 1" fill="none" stroke="rgb(var(--c-nieve))" strokeWidth="1.5" strokeLinejoin="round" />
          </g>
          <g>
            <rect x="50" y="122" width="14" height="9" rx="1.5" fill="rgb(var(--c-gold))" />
            <rect x="55.5" y="122" width="3" height="9" fill="#f43f5e" />
          </g>

          {/* estrella con halo y rayos */}
          <circle cx="60" cy="13" r="15" fill="url(#halo)" className="halo" />
          <g className="rayos" stroke="rgb(var(--c-gold-light))" strokeWidth="1" strokeLinecap="round" opacity="0.7">
            {[0, 45, 90, 135, 180, 225, 270, 315].map(a => (
              <line key={a} x1="60" y1="1" x2="60" y2="-3" transform={`rotate(${a} 60 13)`} />
            ))}
          </g>
          <path className="estrella" d="M60 3 L63 9.6 L70.2 10.3 L64.8 15.1 L66.4 22.2 L60 18.5 L53.6 22.2 L55.2 15.1 L49.8 10.3 L57 9.6 Z"
            fill="rgb(var(--c-gold-light))" stroke="rgb(var(--c-gold))" strokeWidth="0.8" strokeLinejoin="round" />

          {/* destellos alrededor */}
          {DESTELLOS.map((d, i) => (
            <path key={i} className="destello" style={{ animationDelay: `${d.d}s`, transformOrigin: `${d.x}px ${d.y}px` }}
              transform={`translate(${d.x} ${d.y}) scale(${d.s})`}
              d="M0 -4 Q0.6 -0.6 4 0 Q0.6 0.6 0 4 Q-0.6 0.6 -4 0 Q-0.6 -0.6 0 -4 Z" fill="rgb(var(--c-gold-light))" />
          ))}
        </svg>

        <div className="flex flex-col items-center gap-2">
          <p className="text-sm font-semibold tracking-wide text-text-secondary">
            Cargando<span className="puntos" />
          </p>
          <div className="carga-barra" aria-hidden="true"><span /></div>
        </div>
      </div>

      <style>{`
        .arbol-loader .luz { animation-name: encender; animation-timing-function: ease-in-out; animation-iteration-count: infinite; opacity: 0.45; }
        .arbol-loader .luz-brillo { opacity: 0; }
        .arbol-loader .luz-rosa  { --l: 244 63 94; }
        .arbol-loader .luz-oro   { --l: var(--c-gold-light); }
        .arbol-loader .luz-azul  { --l: 96 165 250; }
        .arbol-loader .luz-nieve { --l: 236 246 255; }
        .arbol-loader .luz-bombilla { fill: rgb(var(--l)); }
        .arbol-loader .luz-brillo { fill: rgb(var(--l) / 0.45); filter: blur(1.5px); }
        @keyframes encender {
          0% { opacity: 0.45; }
          8%, 70% { opacity: 1; }
          100% { opacity: 0.45; }
        }
        .arbol-loader .luz .luz-brillo { animation: inherit; animation-name: halo-luz; }
        @keyframes halo-luz { 0% { opacity: 0; } 8%, 70% { opacity: 1; } 100% { opacity: 0; } }

        .arbol-loader .estrella { transform-box: fill-box; transform-origin: center; animation: latir 2.4s ease-in-out infinite; filter: drop-shadow(0 0 4px rgb(var(--c-gold))); }
        .arbol-loader .halo { transform-box: fill-box; transform-origin: center; animation: respirar 2.4s ease-in-out infinite; }
        .arbol-loader .rayos { transform-origin: 60px 13px; animation: girar 12s linear infinite; }
        .arbol-loader .destello { opacity: 0; animation: titilar 2.8s ease-in-out infinite; }
        @keyframes latir { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.12); } }
        @keyframes respirar { 0%, 100% { opacity: 0.55; transform: scale(0.9); } 50% { opacity: 1; transform: scale(1.1); } }
        @keyframes girar { to { transform: rotate(360deg); } }
        @keyframes titilar { 0%, 100% { opacity: 0; transform: scale(0.4); } 50% { opacity: 0.9; transform: scale(1); } }

        .carga-barra { width: 8rem; height: 4px; border-radius: 9999px; background: rgb(var(--c-ov) / 0.08); overflow: hidden; }
        .carga-barra span { display: block; width: 40%; height: 100%; border-radius: inherit;
          background: linear-gradient(90deg, #f43f5e, rgb(var(--c-gold-light)), rgb(var(--c-teal-light)));
          animation: deslizar 1.4s ease-in-out infinite; }
        @keyframes deslizar { 0% { transform: translateX(-100%); } 100% { transform: translateX(250%); } }

        .puntos::after { content: ''; display: inline-block; width: 1.2em; text-align: left; animation: puntos 1.2s steps(4) infinite; }
        @keyframes puntos { 0% { content: ''; } 25% { content: '.'; } 50% { content: '..'; } 75% { content: '...'; } }
        @media (prefers-reduced-motion: reduce) {
          .arbol-loader .luz, .arbol-loader .luz .luz-brillo { animation: none; opacity: 1; }
          .arbol-loader .estrella, .arbol-loader .halo, .arbol-loader .rayos, .carga-barra span, .puntos::after { animation: none; }
          .arbol-loader .destello { animation: none; opacity: 0.6; }
        }
      `}</style>
    </div>
  )
}

function LoadingTerminal() {
  return (
    <div className="flex items-center justify-center h-full min-h-screen bg-bg" aria-live="polite" aria-busy="true">
      <div className="terminal-loader" role="status" aria-label="Cargando">
        <div className="terminal-header">
          <div className="terminal-title">Status</div>
          <div className="terminal-controls" aria-hidden="true">
            <div className="control close" />
            <div className="control minimize" />
            <div className="control maximize" />
          </div>
        </div>
        <div className="terminal-text">Loading...</div>
      </div>

      <style>{`
        @keyframes blinkCursor {
          50% { border-right-color: transparent; }
        }
        @keyframes typeAndDelete {
          0%, 10% { width: 0; }
          45%, 55% { width: 5.8em; }
          90%, 100% { width: 0; }
        }
        .terminal-loader {
          border: 0.1em solid #333;
          background-color: #1a1a1a;
          color: var(--color-primary);
          font-family: "Courier New", Courier, monospace;
          font-size: 1em;
          padding: 1.5em 1em;
          width: 12em;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
          border-radius: 4px;
          position: relative;
          overflow: hidden;
          box-sizing: border-box;
        }
        .terminal-header {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1.5em;
          background-color: #333;
          padding: 0 0.4em;
          box-sizing: border-box;
        }
        .terminal-controls { float: right; }
        .control {
          display: inline-block;
          width: 0.6em;
          height: 0.6em;
          margin-left: 0.4em;
          border-radius: 50%;
          background-color: #777;
        }
        .control.close { background-color: #b84d4d; }
        .control.minimize { background-color: #b09b3f; }
        .control.maximize { background-color: var(--color-primary); }
        .terminal-title {
          float: left;
          line-height: 1.5em;
          color: #eee;
        }
        .terminal-text {
          display: inline-block;
          white-space: nowrap;
          overflow: hidden;
          border-right: 0.2em solid var(--color-primary);
          animation: typeAndDelete 4s steps(11) infinite, blinkCursor 0.5s step-end infinite alternate;
          margin-top: 1.5em;
        }
      `}</style>
    </div>
  )
}
