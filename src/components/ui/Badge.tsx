import { HTMLAttributes } from 'react'
import { cn } from './cn'

type BadgeVariant = 'admin' | 'alumno' | 'success' | 'warning' | 'danger' | 'info'

const VARIANT_CLASS: Record<BadgeVariant, string> = {
  admin: 'inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/15 text-primary-light border border-primary/25',
  alumno: 'inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-white/[0.04] text-text-muted border border-white/[0.08]',
  success: 'inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/25',
  warning: 'inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-500 border border-amber-500/25',
  danger: 'inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-500 border border-rose-500/25',
  info: 'inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-500 border border-blue-500/25',
}

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

export function Badge({ variant = 'info', className, children, ...rest }: BadgeProps) {
  return (
    <span className={cn(VARIANT_CLASS[variant], className)} {...rest}>
      {children}
    </span>
  )
}
