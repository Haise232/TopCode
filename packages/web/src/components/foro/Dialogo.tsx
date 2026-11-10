import { useEffect, type ElementType, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '../ui/cn'
import { FOCO } from '../ui/estilos'

export const INPUT = 'bg-input border border-ov/[0.08] rounded-xl px-4 py-3 text-text-primary text-sm placeholder:text-text-muted transition-[border-color,box-shadow] duration-200 w-full outline-none focus:border-primary/50 focus:shadow-[0_0_0_3px_rgb(var(--c-primary)/0.12)]'
export const ETIQUETA = 'text-xs font-semibold text-text-secondary'

/** Hoja de formulario: panel inferior en móvil, diálogo centrado en escritorio. Escape cierra. */
export function Dialogo({
  id, titulo, subtitulo, Icon, onClose, onSubmit, pie, children,
}: {
  id: string
  titulo: string
  subtitulo: string
  Icon: ElementType
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
  pie: ReactNode
  children: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0" style={{ background: 'var(--color-modal-backdrop)', backdropFilter: 'blur(10px)' }} onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        className="relative w-full sm:max-w-lg max-h-[92dvh] flex flex-col motion-safe:animate-slide-in-bottom sm:motion-safe:animate-scale-in-modal rounded-t-2xl sm:rounded-2xl bg-surface border border-ov/[0.08] shadow-modal"
      >
        <div className="w-9 h-1 mx-auto mt-3 shrink-0 sm:hidden rounded-full bg-ov/[0.15]" aria-hidden="true" />
        <div className="flex items-center justify-between gap-3 px-5 sm:px-6 pt-4 sm:pt-6 pb-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-xl bg-gold/15 text-gold-light">
              <Icon size={16} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 id={id} className="font-extrabold text-lg leading-tight text-text-primary">{titulo}</h2>
              <p className="text-xs mt-0.5 text-text-muted">{subtitulo}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar"
            className={cn('w-10 h-10 shrink-0 flex items-center justify-center rounded-xl text-text-muted hover:bg-ov/[0.06] hover:text-text-primary transition-colors', FOCO)}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <form onSubmit={onSubmit} className="flex flex-col min-h-0 flex-1">
          <div className="flex flex-col gap-4 px-5 sm:px-6 pb-4 overflow-y-auto">{children}</div>
          <div className="flex gap-3 px-5 sm:px-6 py-4 shrink-0 border-t border-ov/[0.07] pb-[max(1rem,env(safe-area-inset-bottom))]">{pie}</div>
        </form>
      </div>
    </div>,
    document.body,
  )
}
