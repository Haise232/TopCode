import { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from './cn'
import { Spinner } from './Spinner'

type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'subtle'
type ButtonSize = 'sm' | 'md' | 'lg'

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
  subtle: 'btn-subtle',
}

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'px-3 py-2 text-sm',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn(VARIANT_CLASS[variant], SIZE_CLASS[size], className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Spinner size="sm" /> : icon}
      {children}
    </button>
  )
}
