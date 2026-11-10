import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '../ui/cn'
import { FOCO } from '../ui/estilos'

/** Hoja modal: panel inferior en móvil, diálogo centrado en escritorio. Escape cierra. */
export default function Dialogo({
  titulo, subtitulo, icono, onClose, children, idTitulo, ancho = 'sm:max-w-md',
}: {
  titulo: string
  subtitulo?: string
  icono: ReactNode
  onClose: () => void
  children: ReactNode
  idTitulo: string
  ancho?: string
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0" style={{ background: 'var(--color-modal-backdrop)', backdropFilter: 'blur(10px)' }} onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby={idTitulo}
        className={cn('relative w-full max-h-[92dvh] flex flex-col motion-safe:animate-slide-in-bottom sm:motion-safe:animate-scale-in-modal rounded-t-2xl sm:rounded-2xl bg-surface border border-ov/[0.08] shadow-modal', ancho)}>
        <div className="w-9 h-1 mx-auto mt-3 shrink-0 sm:hidden rounded-full bg-ov/[0.15]" aria-hidden="true" />
        <div className="flex items-center justify-between gap-3 px-5 sm:px-6 pt-4 sm:pt-6 pb-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {icono}
            <div className="min-w-0">
              <h2 id={idTitulo} className="font-extrabold text-lg leading-tight text-text-primary truncate">{titulo}</h2>
              {subtitulo && <p className="text-xs mt-0.5 text-text-muted truncate">{subtitulo}</p>}
            </div>
          </div>
          <button onClick={onClose} aria-label="Cerrar" type="button"
            className={cn('w-10 h-10 shrink-0 flex items-center justify-center rounded-xl text-text-muted hover:bg-ov/[0.06] hover:text-text-primary transition-colors', FOCO)}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
