import { ReactNode } from 'react'
import { cn } from './cn'

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
  className?: string
}

export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <header className={cn('page-header flex items-center justify-between gap-4', className)}>
      <div className="min-w-0">
        <h1 className="text-lg md:text-xl font-bold text-text-primary truncate">{title}</h1>
        {subtitle && <p className="section-title mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </header>
  )
}
