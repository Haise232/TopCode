import { useId } from 'react'
import { ArrowRight, Check, Megaphone } from 'lucide-react'
import type { Anuncio } from '@topcode/shared'
import { useTheme } from '../../contexts/ThemeContext'
import { Copo } from '../Navidad'
import { cn } from '../ui/cn'
import { FOCO } from '../ui/estilos'
import Dialogo from './Dialogo'
import { BOTON_PRINCIPAL } from './Marca'

const VIÑETA = /^\s*(?:[-•*]|\d+[.)])\s+/

/** Texto del anuncio: párrafos separados por línea en blanco y líneas con "- " como lista. */
function Cuerpo({ texto }: { texto: string }) {
  const bloques = texto.trim().split(/\n\s*\n/)
  return (
    <>
      {bloques.map((b, i) => {
        const lineas = b.split('\n')
        if (lineas.every(l => VIÑETA.test(l))) {
          return (
            <ul key={i} className="flex flex-col gap-1.5">
              {lineas.map((l, j) => (
                <li key={j} className="flex gap-2.5">
                  <span className="mt-[0.55em] w-1.5 h-1.5 shrink-0 rounded-full bg-gold" aria-hidden="true" />
                  <span>{l.replace(VIÑETA, '')}</span>
                </li>
              ))}
            </ul>
          )
        }
        return <p key={i} className="whitespace-pre-line">{b}</p>
      })}
    </>
  )
}

/** Comunicado del administrador: solo se cierra con sus botones (ni Escape ni pulsar fuera). */
export function AnuncioDialogo({ anuncio, cerrando, onLeido, onAbrir }: {
  anuncio: Pick<Anuncio, 'titulo' | 'contenido' | 'created_at'> & { enlace?: string | null }
  cerrando: boolean
  onLeido: () => void
  /** Si el anuncio trae enlace: marcar como leído e ir a él. */
  onAbrir?: () => void
}) {
  const { navidad } = useTheme()
  const id = useId()
  const fecha = new Date(anuncio.created_at).toLocaleDateString('es', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
  const conEnlace = !!anuncio.enlace && !!onAbrir

  return (
    <Dialogo onClose={onLeido} labelledBy={`${id}-t`} describedBy={`${id}-c`} ancho="sm:max-w-lg" cerrable={false} saliendo={cerrando}>
      {/* Cabecera con tinte dorado */}
      <div className="relative overflow-hidden shrink-0 px-5 sm:px-7 pt-5 sm:pt-7 pb-5 sm:rounded-t-2xl
        bg-[radial-gradient(120%_140%_at_0%_0%,rgb(var(--c-gold)/0.22),transparent_60%)] border-b border-ov/[0.07]">
        <Megaphone size={132} strokeWidth={1.2} aria-hidden="true"
          className="absolute -right-6 -top-5 text-gold/[0.09] -rotate-12 pointer-events-none" />
        <div className="relative flex items-center gap-2">
          <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-xl bg-gold text-white shadow-card">
            <Megaphone size={17} aria-hidden="true" />
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-2xs font-bold uppercase tracking-wider bg-gold/15 text-gold-light">
            <span className="w-1.5 h-1.5 rounded-full bg-gold motion-safe:animate-pulse" aria-hidden="true" />
            Comunicado
            {navidad && <Copo size={11} />}
          </span>
        </div>
        <h2 id={`${id}-t`} className="relative mt-4 font-extrabold text-xl sm:text-2xl leading-tight tracking-tight text-text-primary break-words">
          {anuncio.titulo}
        </h2>
        <p className="relative mt-1.5 text-xs text-text-muted first-letter:uppercase">{fecha}</p>
      </div>

      <div id={`${id}-c`} className="px-5 sm:px-7 py-5 overflow-y-auto min-h-0 flex flex-col gap-3 text-sm sm:text-[0.95rem] leading-relaxed text-text-secondary break-words">
        <Cuerpo texto={anuncio.contenido} />
      </div>

      <div className={cn('px-5 sm:px-7 pt-4 shrink-0 border-t border-ov/[0.07] pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-5',
        conEnlace && 'flex flex-col-reverse sm:flex-row gap-2')}>
        {conEnlace ? (
          <>
            <button onClick={onLeido}
              className={cn('sm:flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-text-secondary bg-ov/[0.05] hover:bg-ov/[0.09] transition-colors', FOCO)}>
              <Check size={16} aria-hidden="true" />
              Entendido
            </button>
            <button autoFocus onClick={onAbrir} className={cn(BOTON_PRINCIPAL, 'sm:flex-[1.4]')}>
              Abrir ahora
              <ArrowRight size={16} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
            </button>
          </>
        ) : (
          <button autoFocus onClick={onLeido} className={BOTON_PRINCIPAL}>
            <Check size={16} aria-hidden="true" />
            Entendido
          </button>
        )}
      </div>
    </Dialogo>
  )
}
