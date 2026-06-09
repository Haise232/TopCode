import { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from './cn'

type IconButtonVariant = 'ghost' | 'surface' | 'glass'
type IconButtonSize = 'sm' | 'md' | 'lg'

const VARIANT_CLASS: Record<IconButtonVariant, string> = {
  ghost: 'btn-ghost',
  surface: 'bg-surface-2 border border-border text-text-secondary hover:text-text-primary',
  glass: 'glass border border-border text-text-secondary hover:text-text-primary',
}

const SIZE_CLASS: Record<IconButtonSize, string> = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: IconButtonVariant
  size?: IconButtonSize
  icon: ReactNode
  label: string
}

export function IconButton({
  variant = 'ghost',
  size = 'md',
  icon,
  label,
  className,
  ...rest
}: IconButtonProps) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        'flex items-center justify-center rounded-xl transition-all duration-200 active:scale-[0.96]',
        VARIANT_CLASS[variant],
        SIZE_CLASS[size],
        className
      )}
      {...rest}
    >
      {icon}
    </button>
  )
}
