import { Check, Copy, KeyRound } from 'lucide-react'
import { Button } from '../ui'
import { cn } from '../ui/cn'
import { FOCO } from '../ui/estilos'
import Dialogo from './Dialogo'

/** Contraseña temporal recién generada: se muestra una sola vez. */
export default function DialogoTemporal({ nombre, email, password, copiada, onCopiar, onClose }: {
  nombre: string; email: string; password: string; copiada: boolean; onCopiar: () => void; onClose: () => void
}) {
  return (
    <Dialogo idTitulo="temporal-titulo" titulo={`Contraseña temporal de ${nombre}`} subtitulo={email} Icono={KeyRound} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <button
          type="button"
          onClick={onCopiar}
          title="Copiar"
          aria-label="Copiar contraseña temporal"
          className={cn('w-full flex items-center justify-center gap-3 px-4 py-4 rounded-xl bg-input border border-ov/[0.1] hover:border-primary/50 transition-colors', FOCO)}
        >
          <code className="font-mono text-xl font-bold tracking-wider text-text-primary select-all break-all">{password}</code>
          {copiada ? <Check size={16} className="text-teal-light shrink-0" aria-hidden="true" /> : <Copy size={16} className="text-text-muted shrink-0" aria-hidden="true" />}
        </button>
        <p className="text-xs font-semibold text-teal-light min-h-4 text-center -mt-2" aria-live="polite">{copiada ? 'Copiada' : ''}</p>
        <p className="text-sm leading-relaxed text-text-muted">
          Pásasela por privado. Con ella entra con su email y TopCode le pedirá elegir una nueva antes de nada.
          Cuando cierres esta ventana ya no podrás volver a verla (puedes generar otra).
        </p>
        <Button type="button" onClick={onClose} className="w-full py-3">Hecho</Button>
      </div>
    </Dialogo>
  )
}
