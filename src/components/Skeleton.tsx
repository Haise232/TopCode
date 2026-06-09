interface SkeletonBoxProps {
  className?: string
  style?: React.CSSProperties
}

export function SkeletonBox({ className = '', style }: SkeletonBoxProps) {
  return (
    <div
      className={`shimmer rounded-lg ${className}`}
      style={style}
    />
  )
}

export function SkeletonCard({ children, className = '', style }: { children?: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`p-4 rounded-2xl bg-surface border border-overlay-6 ${className}`} style={style}>
      {children}
    </div>
  )
}

export function SkeletonLine({ className = '' }: { className?: string }) {
  return (
    <div
      className={`shimmer rounded-md ${className}`}
    />
  )
}

export function SkeletonCircle({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <div
      className={`shimmer rounded-full shrink-0 ${className}`}
      style={{ width: size, height: size }}
    />
  )
}

// Tipo paleta cálida opcional para skeletons de Home
type HomePalette = {
  gradientCard: string
  overlay04: string
  overlay06: string
  shimmer1: string
  shimmer2: string
} | undefined

function shimmerBg(p: HomePalette) {
  if (!p) return undefined
  return `linear-gradient(90deg, ${p.shimmer1}, ${p.shimmer2}, ${p.shimmer1})`
}

/** Skeleton para el widget de horario diario en Home */
export function SkeletonSchedule({ rows = 6, palette }: { rows?: number; palette?: HomePalette }) {
  const cardBg = palette?.gradientCard ?? 'var(--gradient-card)'
  const border = palette?.overlay06 ?? 'var(--overlay-06)'
  const sep = palette?.overlay04 ?? 'var(--overlay-04)'
  const shimmer = shimmerBg(palette)

  return (
    <div className="flex flex-col gap-3">
      {/* Cabecera de sección */}
      <div className="flex items-center justify-between">
        <SkeletonBox className="h-2.5 w-28 shimmer" style={shimmer ? { background: shimmer } : undefined} />
        <SkeletonBox className="h-2.5 w-12 shimmer" style={shimmer ? { background: shimmer } : undefined} />
      </div>
      {/* Tabla de clases */}
      <div
        className="rounded-2xl overflow-hidden bg-gradient-card border border-overlay-6"
      >
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-overlay-4' : ''}`}
          >
            {/* Hora inicio */}
            <SkeletonBox className="h-3 w-10 shimmer shrink-0" style={shimmer ? { background: shimmer } : undefined} />
            {/* Dot indicador */}
            <div className="shimmer shrink-0 rounded-full w-1.5 h-1.5" style={{ background: shimmer }} />
            {/* Nombre materia */}
            <SkeletonBox className={`h-3 shimmer flex-1 ${i % 2 === 0 ? 'max-w-[60%]' : 'max-w-[45%]'}`} style={shimmer ? { background: shimmer } : undefined} />
            {/* Badge código */}
            <SkeletonBox className="h-5 w-9 shimmer rounded-lg shrink-0" style={shimmer ? { background: shimmer } : undefined} />
            {/* Hora fin */}
            <SkeletonBox className="h-3 w-10 shimmer shrink-0" style={shimmer ? { background: shimmer } : undefined} />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Skeleton para la cuadrícula de acceso rápido en Home */
export function SkeletonQuickActions({ count = 5, palette }: { count?: number; palette?: HomePalette }) {
  const cardBg = palette?.gradientCard ?? 'var(--gradient-card)'
  const border = palette?.overlay06 ?? 'var(--overlay-06)'
  const shimmer = shimmerBg(palette)

  return (
    <div className="flex flex-col gap-3">
      <SkeletonBox className="h-2.5 w-24 shimmer" style={shimmer ? { background: shimmer } : undefined} />
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: count }).map((_, i) => (
          <SkeletonCard key={i} className="flex flex-col items-center gap-3 py-5 px-4 bg-gradient-card border-overlay-6">
            <SkeletonBox className="h-16 w-16 shimmer rounded-2xl" style={shimmer ? { background: shimmer } : undefined} />
            <div className="flex flex-col items-center gap-1.5 w-full">
              <SkeletonBox className="h-3 w-14 shimmer" style={shimmer ? { background: shimmer } : undefined} />
              <SkeletonBox className="h-2.5 w-10 shimmer" style={shimmer ? { background: shimmer } : undefined} />
            </div>
          </SkeletonCard>
        ))}
      </div>
    </div>
  )
}
