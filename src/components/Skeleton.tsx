interface SkeletonBoxProps {
  className?: string
  style?: React.CSSProperties
}

export function SkeletonBox({ className = '', style }: SkeletonBoxProps) {
  return (
    <div
      className={`overflow-hidden ${className}`}
      style={{ borderRadius: '8px', ...style }}
    >
      <div className="w-full h-full shimmer" style={{ minHeight: 'inherit' }} />
    </div>
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
