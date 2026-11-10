import type { ElementType, ReactNode } from 'react'
import { cn } from './cn'
import { FOCO } from './estilos'

/** Cabecera de sección: título en mayúsculas pequeñas + acción opcional a la derecha. */
export function Seccion({
  titulo, subtitulo, extra, children, className,
}: {
  titulo: string
  subtitulo?: string
  extra?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('flex flex-col gap-3 min-w-0', className)}>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xs font-bold uppercase tracking-wider text-text-secondary">{titulo}</h2>
          {subtitulo && <p className="mt-0.5 text-xs text-text-muted">{subtitulo}</p>}
        </div>
        {extra && <div className="shrink-0 flex items-center gap-3">{extra}</div>}
      </div>
      {children}
    </section>
  )
}

/** Botón de texto con chevron para las acciones de cabecera («Ver foro», «Ver semana»). */
export function EnlaceAccion({
  onClick, children, Icon,
}: { onClick: () => void; children: ReactNode; Icon?: ElementType }) {
  return (
    <button
      onClick={onClick}
      className={cn('flex items-center gap-1 rounded-md text-xs font-semibold text-primary-light hover:underline underline-offset-4', FOCO)}
    >
      {Icon && <Icon size={13} aria-hidden="true" />}
      {children}
    </button>
  )
}
