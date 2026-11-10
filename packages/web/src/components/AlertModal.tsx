import { useId } from 'react'
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react'
import Dialogo from './acceso/Dialogo'
import { cn } from './ui/cn'
import { FOCO } from './ui/estilos'

interface AlertModalProps {
  visible: boolean
  type?: 'error' | 'success' | 'info' | 'warning'
  title: string
  message?: string
  onClose: () => void
  onConfirm?: () => void
  confirmLabel?: string
  confirmDestructive?: boolean
}

// Icono suave + botón sólido por tipo (éxito en teal, error en rose; nunca en primary).
const CONFIG = {
  error:   { Icon: AlertCircle,   icono: 'bg-rose-500/10 text-rose-600 dark:text-rose-300',    boton: 'bg-rose-600' },
  success: { Icon: CheckCircle,   icono: 'bg-teal/15 text-teal-light',                          boton: 'bg-teal-dark' },
  info:    { Icon: Info,          icono: 'bg-primary/10 text-primary-light',                    boton: 'bg-primary-dark' },
  warning: { Icon: AlertTriangle, icono: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',  boton: 'bg-amber-700' },
}

const BOTON = cn('rounded-xl py-3 px-5 text-sm font-semibold text-white transition-[filter,transform] hover:brightness-110 active:scale-[0.99]', FOCO)

export default function AlertModal({
  visible, type, title, message, onClose, onConfirm, confirmLabel, confirmDestructive,
}: AlertModalProps) {
  const id = useId()
  if (!visible) return null
  const config = type ? CONFIG[type] : null
  const colorBoton = confirmDestructive ? 'bg-rose-600' : (config?.boton ?? 'bg-primary-dark')

  return (
    <Dialogo onClose={onClose} labelledBy={`${id}-t`} describedBy={message ? `${id}-m` : undefined} alerta>
      <div className="flex items-start gap-4 px-5 sm:px-6 pt-4 sm:pt-6">
        {config && (
          <span className={cn('w-10 h-10 shrink-0 flex items-center justify-center rounded-xl', config.icono)}>
            <config.Icon size={18} aria-hidden="true" />
          </span>
        )}
        <div className="flex-1 min-w-0 pt-0.5">
          <h2 id={`${id}-t`} className="font-extrabold text-lg leading-snug text-text-primary">{title}</h2>
          {message && <p id={`${id}-m`} className="mt-1.5 text-sm leading-relaxed text-text-secondary">{message}</p>}
        </div>
        <button onClick={onClose} aria-label="Cerrar"
          className={cn('-mt-1 -mr-2 w-10 h-10 shrink-0 flex items-center justify-center rounded-xl text-text-muted hover:bg-ov/[0.06] hover:text-text-primary transition-colors', FOCO)}>
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="flex gap-3 px-5 sm:px-6 pt-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-6">
        {onConfirm ? (
          <>
            <button onClick={onClose}
              className={cn('flex-1 rounded-xl py-3 text-sm font-semibold text-text-secondary bg-ov/[0.04] border border-ov/[0.08] hover:bg-ov/[0.07] hover:text-text-primary transition-colors', FOCO)}>
              Cancelar
            </button>
            <button autoFocus onClick={() => { onConfirm(); onClose() }} className={cn(BOTON, 'flex-[2]', colorBoton)}>
              {confirmLabel ?? 'Confirmar'}
            </button>
          </>
        ) : (
          <button autoFocus onClick={onClose} className={cn(BOTON, 'w-full sm:w-auto sm:ml-auto sm:px-8', colorBoton)}>
            Aceptar
          </button>
        )}
      </div>
    </Dialogo>
  )
}
