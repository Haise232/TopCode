import type { ElementType, ReactNode } from 'react'
import { cn } from '../ui/cn'
import { SUPERFICIE } from '../ui/estilos'

export const INPUT = 'bg-input border border-ov/[0.08] rounded-xl px-4 py-3 text-text-primary text-sm placeholder:text-text-muted transition-[border-color,box-shadow] duration-200 w-full outline-none focus:border-primary/50 focus:shadow-[0_0_0_3px_rgb(var(--c-primary)/0.12)]'
export const ETIQUETA = 'flex items-center gap-1.5 text-xs font-semibold text-text-secondary'

/** Campo de formulario con etiqueta asociada. */
export function Campo({ id, label, Icon, ayuda, children }: {
  id: string; label: ReactNode; Icon?: ElementType; ayuda?: ReactNode; children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={ETIQUETA}>
        {Icon && <Icon size={12} aria-hidden="true" />}{label}
      </label>
      {children}
      {ayuda}
    </div>
  )
}

/** Tarjeta de contenido con la superficie común. */
export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn(SUPERFICIE, 'p-5', className)}>{children}</div>
}
