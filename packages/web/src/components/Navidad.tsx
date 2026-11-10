import { useTheme } from '../contexts/ThemeContext'

/** Tira de luces navideñas para el borde superior de un contenedor `relative`. */
export function Guirnalda({ bombillas = 28 }: { bombillas?: number }) {
  const { navidad } = useTheme()
  if (!navidad) return null
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
      <path d="M4 20 C6 9 13 3 22 4 C26 4.5 29 8 30 13 L25 11 C24 15 22 18 20 20 Z" fill="rgb(var(--c-primary))" />
      <path d="M22 4 C26 4.5 29 8 30 13 L25 11 C25 8 24 6 22 4 Z" fill="rgb(var(--c-primary-dark))" />
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
