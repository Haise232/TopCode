import { useEffect, useId, useRef, type ElementType, type FormEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Search, X } from 'lucide-react'
import { cn } from '../ui/cn'
import { FOCO, SUPERFICIE } from '../ui/estilos'

/** Entrada de texto con la forma de los buscadores de Calendario. */
export const INPUT =
  'bg-input border border-ov/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-muted w-full outline-none transition-[border-color,box-shadow] duration-200 focus:border-primary/50 focus:shadow-[0_0_0_3px_rgb(var(--c-primary)/0.12)]'

export const ETIQUETA = 'text-xs font-bold uppercase tracking-wider text-text-secondary'

export function Buscador({ value, onChange, placeholder, etiqueta }: {
  value: string; onChange: (v: string) => void; placeholder: string; etiqueta: string
}) {
  return (
    <div className="relative w-full">
      <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" aria-hidden="true" />
      <input
        type="text" value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} aria-label={etiqueta}
        className={cn(INPUT, 'pl-10 pr-10')}
      />
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="Borrar búsqueda"
          className={cn('absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary', FOCO)}>
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

export const CHIP = 'inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border whitespace-nowrap transition-colors duration-150'

export function Vacio({ Icon, titulo, mensaje, accion, compacto }: {
  Icon: ElementType; titulo?: string; mensaje: string; accion?: ReactNode; compacto?: boolean
}) {
  return (
    <div className={cn(SUPERFICIE, 'flex flex-col items-center gap-3 text-center px-6', compacto ? 'py-8' : 'py-14')}>
      <span className={cn('flex items-center justify-center rounded-full bg-gold/15 text-gold-light', compacto ? 'w-11 h-11' : 'w-14 h-14')}>
        <Icon size={compacto ? 20 : 26} aria-hidden="true" />
      </span>
      <div className="flex flex-col gap-1.5">
        {titulo && <p className="font-bold text-lg text-text-primary">{titulo}</p>}
        <p className="text-sm leading-relaxed max-w-sm text-text-muted">{mensaje}</p>
      </div>
      {accion}
    </div>
  )
}

export function AvisoError({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="rounded-2xl border border-rose-400/25 bg-rose-400/[0.07] px-4 py-3 text-sm text-rose-600 dark:text-rose-300">
      {children}
    </div>
  )
}

/**
 * Diálogo común: panel inferior en móvil, centrado en escritorio, Escape para cerrar.
 * Con `onSubmit` el cuerpo y el pie van dentro de un <form>.
 */
export function Dialogo({
  open, onClose, titulo, subtitulo, Icon, ancho = 'sm:max-w-lg', alto, plano, onSubmit, pie, children,
}: {
  open: boolean
  onClose: () => void
  titulo: string
  subtitulo?: ReactNode
  Icon?: ElementType
  ancho?: string
  /** Alto fijo del panel (p. ej. el historial). */
  alto?: string
  /** Cuerpo sin relleno ni desplazamiento propio: el contenido lo gestiona. */
  plano?: boolean
  onSubmit?: (e: FormEvent) => void
  pie?: ReactNode
  children: ReactNode
}) {
  const id = useId()
  const cerrar = useRef(onClose)
  cerrar.current = onClose

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrar.current() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null

  const Cuerpo = onSubmit ? 'form' : 'div'
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0" style={{ background: 'var(--color-modal-backdrop)', backdropFilter: 'blur(10px)' }} onClick={onClose} />
      <div
        role="dialog" aria-modal="true" aria-labelledby={id}
        className={cn(
          'relative w-full max-h-[92dvh] flex flex-col motion-safe:animate-slide-in-bottom sm:motion-safe:animate-scale-in-modal rounded-t-2xl sm:rounded-2xl bg-surface border border-ov/[0.08] shadow-modal',
          ancho, alto,
        )}
      >
        <div className="w-9 h-1 mx-auto mt-3 shrink-0 sm:hidden rounded-full bg-ov/[0.15]" aria-hidden="true" />
        <div className="flex items-center justify-between gap-3 px-5 sm:px-6 pt-4 sm:pt-6 pb-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {Icon && (
              <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-xl bg-gold/15 text-gold-light">
                <Icon size={16} aria-hidden="true" />
              </span>
            )}
            <div className="min-w-0">
              <h2 id={id} className="font-extrabold text-lg leading-tight text-text-primary">{titulo}</h2>
              {subtitulo && <p className="text-xs mt-0.5 text-text-muted">{subtitulo}</p>}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar"
            className={cn('w-10 h-10 shrink-0 flex items-center justify-center rounded-xl text-text-muted hover:bg-ov/[0.06] hover:text-text-primary transition-colors', FOCO)}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <Cuerpo onSubmit={onSubmit} className="flex flex-col min-h-0 flex-1">
          <div className={plano ? 'flex flex-col min-h-0 flex-1 border-t border-ov/[0.07]' : 'flex flex-col gap-4 px-5 sm:px-6 pb-4 overflow-y-auto min-h-0 flex-1'}>{children}</div>
          {pie && <div className="flex justify-end gap-2 px-5 sm:px-6 py-4 shrink-0 border-t border-ov/[0.07]">{pie}</div>}
        </Cuerpo>
      </div>
    </div>,
    document.body,
  )
}

/** Elemento de un menú desplegable. */
export function ItemMenu({ Icon, label, onClick, danger }: { Icon: ElementType; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button" role="menuitem" onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors',
        FOCO,
        danger ? 'text-rose-600 dark:text-rose-300 hover:bg-rose-500/10' : 'text-text-secondary hover:bg-ov/[0.06] hover:text-text-primary',
      )}
    >
      <Icon size={15} aria-hidden="true" />
      {label}
    </button>
  )
}

/** Panel flotante de un menú: cierra con clic fuera y con Escape. */
export function PanelMenu({ onClose, className, children, etiqueta }: { onClose: () => void; className?: string; children: ReactNode; etiqueta: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} aria-hidden="true" />
      <div role="menu" aria-label={etiqueta}
        className={cn('absolute right-0 top-full mt-1.5 z-30 w-60 rounded-xl border border-ov/[0.1] bg-surface-2 p-1 shadow-modal', className)}>
        {children}
      </div>
    </>
  )
}
