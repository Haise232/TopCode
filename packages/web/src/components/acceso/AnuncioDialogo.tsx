import { useId } from 'react'
import { CheckCheck, Megaphone } from 'lucide-react'
import type { Anuncio } from '@topcode/shared'
import { useTheme } from '../../contexts/ThemeContext'
import { Copo } from '../Navidad'
import Dialogo from './Dialogo'
import { BOTON_PRINCIPAL } from './Marca'

/** Comunicado del administrador: solo se cierra con el botón (ni Escape ni pulsar fuera). */
export function AnuncioDialogo({ anuncio, cerrando, onLeido }: {
  anuncio: Pick<Anuncio, 'titulo' | 'contenido' | 'created_at'>
  cerrando: boolean
  onLeido: () => void
}) {
  const { navidad } = useTheme()
  const id = useId()
  const fecha = new Date(anuncio.created_at).toLocaleDateString('es', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <Dialogo onClose={onLeido} labelledBy={`${id}-t`} describedBy={`${id}-c`} ancho="sm:max-w-md" cerrable={false} saliendo={cerrando}>
      <div className="flex items-start gap-3 px-5 sm:px-6 pt-4 sm:pt-6 pb-4 shrink-0">
        <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-xl bg-gold/15 text-gold-light">
          <Megaphone size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-text-muted">
            Comunicado
            {navidad && <Copo size={12} className="text-gold-light" />}
            <span aria-hidden="true">·</span>
            <span className="first-letter:uppercase font-normal">{fecha}</span>
          </p>
          <h2 id={`${id}-t`} className="mt-0.5 font-extrabold text-lg leading-snug text-text-primary break-words">{anuncio.titulo}</h2>
        </div>
      </div>

      <div className="px-5 sm:px-6 pb-5 overflow-y-auto min-h-0">
        <div id={`${id}-c`} className="rounded-xl p-4 text-sm leading-relaxed whitespace-pre-wrap break-words bg-ov/[0.03] border border-ov/[0.07] text-text-secondary">
          {anuncio.contenido}
        </div>
      </div>

      <div className="px-5 sm:px-6 py-4 shrink-0 border-t border-ov/[0.07] pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button autoFocus onClick={onLeido} className={BOTON_PRINCIPAL}>
          <CheckCheck size={16} aria-hidden="true" />
          He leído el mensaje
        </button>
      </div>
    </Dialogo>
  )
}
