import { useId } from 'react'
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
