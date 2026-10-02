import { ReactNode, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { cn } from './cn'

interface ModalProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  maxWidthClassName?: string
  panelClassName?: string
}

/**
 * Shell visual compartido por AlertModal/AnuncioModal/PrivateMessageToast:
 * backdrop con blur + cierre por click-fuera/Escape + panel animado.
 * No incluye contenido — cada modal aporta su propio interior.
 */
export function Modal({ open, onClose, children, maxWidthClassName = 'max-w-sm', panelClassName }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-fade-in">
      <div
        className="absolute inset-0 bg-slate-900/35 backdrop-blur-[8px]"
        onClick={onClose}
      />
      <div
        className={cn(
          'relative w-full overflow-hidden animate-scale-in-modal rounded-[20px] bg-surface border border-border shadow-modal',
          maxWidthClassName,
          panelClassName
        )}
      >
        {children}
      </div>
    </div>,
    document.body
  )
}
