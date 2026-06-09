import { HTMLAttributes } from 'react'
import { cn } from './cn'

type BadgeVariant = 'admin' | 'alumno' | 'success' | 'warning' | 'danger' | 'info'

const VARIANT_CLASS: Record<BadgeVariant, string> = {
  admin: 'badge-admin',
  alumno: 'badge-alumno',
  success: 'badge-success',
  warning: 'badge-warning',
  danger: 'badge-danger',
  info: 'badge-info',
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
