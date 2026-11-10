import { temaDeTemporada } from '../lib/temporada'
import { Nieve } from './Pattern'

// Se lee la fecha directamente (no el contexto): el loader también se pinta como
// fallback de Suspense y fuera del ThemeProvider.
export default function Loading() {
  if (temaDeTemporada() === 'navidad') return <LoadingNavidad />
  return <LoadingTerminal />
}

/* Bolas del árbol: posición y retardo de encendido */
const BOLAS = [
  { x: 50, y: 34, d: 0.0 }, { x: 42, y: 50, d: 0.3 }, { x: 58, y: 56, d: 0.6 },
  { x: 35, y: 70, d: 0.9 }, { x: 52, y: 74, d: 1.2 }, { x: 66, y: 68, d: 1.5 },
  { x: 30, y: 88, d: 1.8 }, { x: 46, y: 92, d: 0.15 }, { x: 62, y: 90, d: 0.45 }, { x: 72, y: 86, d: 0.75 },
]

function LoadingNavidad() {
  return (
    <div className="relative flex items-center justify-center h-full min-h-screen bg-bg overflow-hidden" aria-live="polite" aria-busy="true">
      <div className="absolute inset-0" aria-hidden="true"><Nieve densidad={0.6} /></div>
      <div className="relative flex flex-col items-center gap-5" role="status" aria-label="Cargando">
        <svg viewBox="0 0 100 120" className="arbol-loader w-36 h-44" aria-hidden="true">
          <defs>
            <linearGradient id="abeto" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(var(--c-teal-light))" />
              <stop offset="100%" stopColor="rgb(var(--c-teal-dark))" />
            </linearGradient>
          </defs>
          {/* copa en tres pisos */}
          <path d="M50 18 L70 48 L30 48 Z" fill="url(#abeto)" />
          <path d="M50 32 L78 72 L22 72 Z" fill="url(#abeto)" />
          <path d="M50 50 L86 100 L14 100 Z" fill="url(#abeto)" />
          {/* espumillón */}
          <path d="M33 46 Q50 54 66 44 M27 69 Q50 80 74 66 M20 97 Q50 108 82 94" fill="none" stroke="rgb(var(--c-gold) / 0.7)" strokeWidth="1.6" strokeLinecap="round" className="espumillon" />
          {/* tronco */}
          <rect x="44" y="100" width="12" height="12" rx="2" fill="#6b4a2f" />
          {/* bolas */}
          {BOLAS.map((b, i) => (
            <circle key={i} cx={b.x} cy={b.y} r="3.2" className={`bola bola-${i % 3}`} style={{ animationDelay: `${b.d}s` }} />
          ))}
          {/* estrella */}
          <path className="estrella" d="M50 4 L53.5 11.5 L61.5 12.2 L55.4 17.4 L57.3 25.2 L50 21 L42.7 25.2 L44.6 17.4 L38.5 12.2 L46.5 11.5 Z" fill="rgb(var(--c-gold))" />
        </svg>
        <p className="text-sm font-medium tracking-wide text-text-secondary">
          Cargando<span className="puntos" />
        </p>
      </div>

      <style>{`
        .arbol-loader .bola { opacity: 0.25; animation: encender 1.8s ease-in-out infinite; }
        .arbol-loader .bola-0 { fill: rgb(var(--c-primary)); filter: drop-shadow(0 0 3px rgb(var(--c-primary))); }
        .arbol-loader .bola-1 { fill: rgb(var(--c-gold-light)); filter: drop-shadow(0 0 3px rgb(var(--c-gold))); }
        .arbol-loader .bola-2 { fill: rgb(var(--c-nieve)); filter: drop-shadow(0 0 3px rgb(var(--c-nieve))); }
        .arbol-loader .estrella { transform-box: fill-box; transform-origin: center; animation: brillar 2.4s ease-in-out infinite; filter: drop-shadow(0 0 6px rgb(var(--c-gold))); }
        .arbol-loader .espumillon { stroke-dasharray: 4 3; animation: correr 3s linear infinite; }
        .puntos::after { content: ''; display: inline-block; width: 1.2em; text-align: left; animation: puntos 1.2s steps(4) infinite; }
        @keyframes encender { 0%, 100% { opacity: 0.25; } 40%, 60% { opacity: 1; } }
        @keyframes brillar { 0%, 100% { transform: scale(1) rotate(0deg); } 50% { transform: scale(1.15) rotate(8deg); } }
        @keyframes correr { to { stroke-dashoffset: -14; } }
        @keyframes puntos { 0% { content: ''; } 25% { content: '.'; } 50% { content: '..'; } 75% { content: '...'; } }
        @media (prefers-reduced-motion: reduce) {
          .arbol-loader .bola { animation: none; opacity: 1; }
          .arbol-loader .estrella, .arbol-loader .espumillon, .puntos::after { animation: none; }
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
