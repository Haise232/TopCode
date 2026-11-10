import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../ui/cn'

/**
 * Carcasa de diálogo (mismo patrón que el formulario del calendario): panel inferior en móvil,
 * centrado en escritorio, con fondo desenfocado. El llamador pone el contenido.
 */
export default function Dialogo({
  onClose, labelledBy, describedBy, children, ancho = 'sm:max-w-sm', cerrable = true, saliendo = false, alerta = false,
}: {
  onClose: () => void
  labelledBy: string
  describedBy?: string
  children: ReactNode
  ancho?: string
  /** Si es false, ni Escape ni pulsar fuera lo cierran (el contenido debe traer su propio botón). */
  cerrable?: boolean
  saliendo?: boolean
  alerta?: boolean
}) {
  useEffect(() => {
    if (!cerrable) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cerrable, onClose])

  return createPortal(
    <div className={cn('fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 transition-opacity duration-200', saliendo && 'opacity-0')}>
      <div
        className="absolute inset-0"
        style={{ background: 'var(--color-modal-backdrop)', backdropFilter: 'blur(10px)' }}
        onClick={cerrable ? onClose : undefined}
      />
      <div
        role={alerta ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        className={cn(
          'relative w-full max-h-[92dvh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-surface border border-ov/[0.08] shadow-modal',
          'motion-safe:animate-slide-in-bottom sm:motion-safe:animate-scale-in-modal',
          ancho,
        )}
      >
        <div className="w-9 h-1 mx-auto mt-3 shrink-0 sm:hidden rounded-full bg-ov/[0.15]" aria-hidden="true" />
        {children}
      </div>
    </div>,
    document.body,
  )
}
