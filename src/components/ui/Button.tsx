import { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from './cn'
import { Spinner } from './Spinner'

type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'subtle'
type ButtonSize = 'sm' | 'md' | 'lg'

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'bg-gradient-to-br from-primary to-cyan-400 text-white font-semibold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-primary',
  ghost: 'bg-surface border text-text-secondary font-medium rounded-xl hover:bg-surface-2 hover:text-slate-200 active:scale-[0.98] transition-all duration-200 border-white/[0.08]',
  danger: 'bg-gradient-to-br from-rose-500 to-rose-700 text-white font-semibold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-rose',
  subtle: 'font-medium rounded-xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all duration-200 bg-teal-500/10 text-teal border border-teal-500/20 hover:bg-teal-500/15',
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
