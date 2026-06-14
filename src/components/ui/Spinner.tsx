import { cn } from './cn'

type SpinnerSize = 'sm' | 'md' | 'lg'

const SIZE_CLASS: Record<SpinnerSize, string> = {
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-9 h-9 border-[3px]',
}

interface SpinnerProps {
  size?: SpinnerSize
  className?: string
}

export function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <span
      className={cn('inline-block rounded-full animate-spin-smooth', SIZE_CLASS[size], className)}
      style={{ borderColor: 'rgba(255,255,255,0.2)', borderTopColor: 'currentColor' }}
      aria-hidden="true"
    />
  )
}
