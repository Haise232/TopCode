interface SkeletonBoxProps {
  className?: string
  style?: React.CSSProperties
}

export function SkeletonBox({ className = '', style }: SkeletonBoxProps) {
  return (
    <div
      className={`shimmer ${className}`}
      style={{ borderRadius: '8px', ...style }}
    />
  )
}

export function SkeletonCard({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return (
    <div
      className={`p-4 rounded-2xl ${className}`}
      style={{
        background: '#1a1d27',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {children}
    </div>
  )
}

export function SkeletonLine({ className = '' }: { className?: string }) {
  return (
    <div
      className={`shimmer ${className}`}
      style={{ borderRadius: '6px' }}
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

/** Skeleton para el widget de horario diario en Home */
export function SkeletonSchedule({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {/* Cabecera de sección */}
      <div className="flex items-center justify-between">
        <SkeletonBox className="h-2.5 w-28 shimmer" />
        <SkeletonBox className="h-2.5 w-12 shimmer" />
      </div>
      {/* Tabla de clases */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(145deg, #1a1d27, #141720)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-4 py-3"
            style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : undefined }}
          >
            {/* Hora inicio */}
            <SkeletonBox className="h-3 w-10 shimmer shrink-0" />
            {/* Dot indicador */}
            <div className="shimmer shrink-0 rounded-full" style={{ width: 6, height: 6 }} />
            {/* Nombre materia */}
            <SkeletonBox className={`h-3 shimmer flex-1 ${i % 2 === 0 ? 'max-w-[60%]' : 'max-w-[45%]'}`} />
            {/* Badge código */}
            <SkeletonBox className="h-5 w-9 shimmer rounded-lg shrink-0" />
            {/* Hora fin */}
            <SkeletonBox className="h-3 w-10 shimmer shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Skeleton para la cuadrícula de acceso rápido en Home */
export function SkeletonQuickActions({ count = 5 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-3">
      <SkeletonBox className="h-2.5 w-24 shimmer" />
      <div
        className="grid gap-3 grid-cols-3"
        style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: count }).map((_, i) => (
          <SkeletonCard key={i} className="flex flex-col items-center gap-3 py-5 px-4">
            <SkeletonBox className="h-16 w-16 shimmer rounded-2xl" />
            <div className="flex flex-col items-center gap-1.5 w-full">
              <SkeletonBox className="h-3 w-14 shimmer" />
              <SkeletonBox className="h-2.5 w-10 shimmer" />
            </div>
          </SkeletonCard>
        ))}
      </div>
    </div>
  )
}
