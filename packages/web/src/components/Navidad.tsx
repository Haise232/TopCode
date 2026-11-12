import { useId, type ReactNode } from 'react'
import { useTheme } from '../contexts/ThemeContext'

/**
 * Decoración del borde superior de un contenedor `relative`:
 * - modo claro («Mañana nevada»): franja de jersey navideño;
 * - modo oscuro («Noche de paz»): tira de luces cálidas.
 */
export function Guirnalda({ bombillas = 28 }: { bombillas?: number }) {
  const { navidad, modo } = useTheme()
  if (!navidad) return null
  if (modo === 'claro') return <FranjaJersey />
  const paso = 1000 / bombillas
  return (
    <div className="guirnalda" aria-hidden="true">
      <svg viewBox="0 0 1000 22" preserveAspectRatio="none">
        <path
          d={Array.from({ length: bombillas }, (_, i) => {
            const x0 = i * paso
            return `${i === 0 ? 'M0,2' : ''} Q${x0 + paso / 2},12 ${x0 + paso},2`
          }).join(' ')}
          fill="none"
          stroke="rgb(var(--c-ov) / 0.2)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
        {Array.from({ length: bombillas }, (_, i) => (
          <ellipse key={i} className="bombilla" cx={i * paso + paso / 2} cy={12} rx={3.2} ry={5} />
        ))}
      </svg>
    </div>
  )
}

/** Gorro de Papá Noel para colocar sobre un avatar o logo (`relative`). */
export function GorroNavidad({ className = '' }: { className?: string }) {
  const { navidad } = useTheme()
  if (!navidad) return null
  return (
    <svg
      viewBox="0 0 32 26"
      aria-hidden="true"
      className={`pointer-events-none absolute ${className}`}
    >
      <path d="M4 20 C6 9 13 3 22 4 C26 4.5 29 8 30 13 L25 11 C24 15 22 18 20 20 Z" fill="#d23b47" />
      <path d="M22 4 C26 4.5 29 8 30 13 L25 11 C25 8 24 6 22 4 Z" fill="#a3262f" />
      <rect x="2" y="18" width="21" height="6" rx="3" fill="#f7f4ee" />
      <circle cx="29.5" cy="14" r="2.6" fill="#f7f4ee" />
    </svg>
  )
}

/** Copo de nieve decorativo en línea (SVG), hereda el color del texto. */
export function Copo({ size = 14, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" className={className}>
      <path d="M12 2v20M4.2 6.5l15.6 11M4.2 17.5l15.6-11" />
      <path d="M9.5 3.5 12 6l2.5-2.5M9.5 20.5 12 18l2.5 2.5M3.4 9.6l3.4.9-.9 3.4M20.6 14.4l-3.4-.9.9-3.4M3.4 14.4l3.4-.9-.9-3.4M20.6 9.6l-3.4.9.9 3.4" />
    </svg>
  )
}

/** Franja con patrón de jersey de punto: arbolitos y copos de «píxel» sobre rojo. */
function FranjaJersey() {
  const id = useId().replace(/:/g, '')
  const lana = '#fbf6ee'
  return (
    <div className="jersey" aria-hidden="true">
      <svg>
        <defs>
          <pattern id={`jersey-${id}`} width="28" height="14" patternUnits="userSpaceOnUse">
            <rect width="28" height="14" fill="rgb(var(--c-primary))" />
            {/* ribetes */}
            <rect y="0" width="28" height="1.5" fill={lana} />
            <rect y="12.5" width="28" height="1.5" fill={lana} />
            {/* arbolito */}
            <rect x="6" y="3" width="2" height="1.5" fill={lana} />
            <rect x="5" y="4.5" width="4" height="1.5" fill={lana} />
            <rect x="4" y="6" width="6" height="1.5" fill={lana} />
            <rect x="3" y="7.5" width="8" height="1.5" fill={lana} />
            <rect x="6" y="9" width="2" height="2" fill={lana} />
            {/* copo */}
            <rect x="20" y="4" width="1.5" height="1.5" fill="rgb(var(--c-gold))" />
            <rect x="18.5" y="5.5" width="1.5" height="1.5" fill={lana} />
            <rect x="21.5" y="5.5" width="1.5" height="1.5" fill={lana} />
            <rect x="20" y="7" width="1.5" height="1.5" fill="rgb(var(--c-gold))" />
            <rect x="18.5" y="8.5" width="1.5" height="1.5" fill={lana} />
            <rect x="21.5" y="8.5" width="1.5" height="1.5" fill={lana} />
            <rect x="20" y="10" width="1.5" height="1.5" fill="rgb(var(--c-gold))" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#jersey-${id})`} shapeRendering="crispEdges" />
      </svg>
    </div>
  )
}

/**
 * Colinas nevadas con abetos para el pie de un contenedor `relative`.
 * Hereda los colores del tema: nieve blanca en claro, azul hielo en oscuro.
 */
export function PaisajeNevado({ className = '' }: { className?: string }) {
  const { navidad } = useTheme()
  if (!navidad) return null
  // Abeto de tres pisos con la base en (x, y) y altura h
  const abeto = (x: number, y: number, h: number) => {
    const a = h * 0.36
    return `M${x},${y - h} L${x + a * 0.55},${y - h * 0.62} L${x + a * 0.3},${y - h * 0.62} L${x + a * 0.8},${y - h * 0.3} L${x + a * 0.45},${y - h * 0.3} L${x + a},${y} L${x - a},${y} L${x - a * 0.45},${y - h * 0.3} L${x - a * 0.8},${y - h * 0.3} L${x - a * 0.3},${y - h * 0.62} L${x - a * 0.55},${y - h * 0.62} Z`
  }
  // Las colinas se estiran a lo ancho; los abetos conservan su forma y quedan centrados
  const capa = (ajuste: 'none' | 'xMidYMax meet', hijos: ReactNode) => (
    <svg viewBox="0 0 460 120" preserveAspectRatio={ajuste} className="absolute inset-0 w-full h-full">{hijos}</svg>
  )
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-x-0 bottom-0 ${className}`}>
      {capa('none', <path d="M0,70 C80,46 150,58 230,64 C320,70 390,44 460,56 L460,120 L0,120 Z" className="fill-ov/[0.05] dark:fill-primary-light/[0.07]" />)}
      {capa('xMidYMax meet', (
        <g className="fill-secondary/25 dark:fill-secondary/20">
          <path d={abeto(60, 70, 34)} />
          <path d={abeto(84, 70, 24)} />
          <path d={abeto(352, 70, 30)} />
          <path d={abeto(398, 66, 40)} />
        </g>
      ))}
      {capa('none', <path d="M0,96 C70,78 140,84 210,92 C300,102 380,80 460,86 L460,120 L0,120 Z" className="fill-white dark:fill-primary-light/[0.13]" />)}
      {capa('xMidYMax meet', (
        <>
          <g className="fill-secondary/60 dark:fill-secondary/45">
            <path d={abeto(150, 104, 52)} />
            <path d={abeto(184, 106, 34)} />
            <path d={abeto(300, 108, 42)} />
          </g>
          {/* nieve sobre las puntas */}
          <g className="fill-white/90 dark:fill-white/70">
            <circle cx="150" cy="53" r="2.2" />
            <circle cx="300" cy="67" r="1.8" />
            <circle cx="398" cy="26.5" r="1.8" />
          </g>
        </>
      ))}
    </div>
  )
}

/** Montoncitos de nieve sobre el borde superior de una tarjeta `relative`. */
export function CapaNieve() {
  const { navidad } = useTheme()
  if (!navidad) return null
  return (
    <svg
      viewBox="0 0 400 18"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="pointer-events-none absolute -top-[9px] inset-x-3 h-[18px] w-[calc(100%-1.5rem)] drop-shadow-[0_1px_1px_rgba(30,45,70,0.12)]"
    >
      <path
        className="fill-white dark:fill-[#e8eefb]"
        d="M0,12 C10,4 26,3 40,8 C52,1 74,0 90,7 C104,3 118,4 128,9 C144,2 170,1 186,8 C200,4 214,5 224,10 C240,3 262,2 280,8 C292,4 306,4 318,9 C332,1 356,1 372,8 C384,4 394,6 400,10 L400,13 C396,16 388,14 380,15 C370,18 362,13 352,15 C330,17 300,13 280,15 C262,18 250,13 236,15 C210,17 180,13 160,15 C146,18 132,13 118,15 C96,17 70,13 52,15 C38,18 24,13 12,15 C6,16 2,14 0,13 Z"
      />
    </svg>
  )
}
