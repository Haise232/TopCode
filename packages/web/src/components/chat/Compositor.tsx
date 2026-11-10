import { Send } from 'lucide-react'
import { cn } from '../ui/cn'
import { FOCO } from '../ui/estilos'
import { FONDO_PRIMARIO } from './estilos'

/** Barra de escritura fija bajo el hilo. Enter envía. */
export default function Compositor({
  valor, onCambiar, onEnviar, onEscribiendo, placeholder, inputRef,
}: {
  valor: string
  onCambiar: (v: string) => void
  onEnviar: (e: React.FormEvent) => void
  onEscribiendo?: () => void
  placeholder: string
  inputRef?: React.RefObject<HTMLInputElement>
}) {
  const activo = valor.trim().length > 0
  return (
    <form
      onSubmit={onEnviar}
      className="shrink-0 flex items-center gap-2 px-3 md:px-4 py-3 bg-surface border-t border-ov/[0.07]"
    >
      <input
        ref={inputRef}
        value={valor}
        onChange={e => { onCambiar(e.target.value); if (e.target.value.trim()) onEscribiendo?.() }}
        placeholder={placeholder}
        aria-label={placeholder}
        autoComplete="off"
        className="flex-1 min-w-0 h-11 rounded-full bg-input border border-ov/[0.1] px-4 text-base md:text-sm text-text-primary placeholder:text-text-muted outline-none transition-[border-color,box-shadow] focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            if (activo) onEnviar(e as unknown as React.FormEvent)
          }
        }}
      />
      <button
        type="submit"
        disabled={!activo}
        aria-label="Enviar"
        className={cn(
          'w-11 h-11 shrink-0 flex items-center justify-center rounded-full transition-colors',
          activo ? FONDO_PRIMARIO + ' hover:opacity-90 active:scale-95' : 'bg-ov/[0.07] text-text-faint cursor-not-allowed',
          FOCO,
        )}
      >
        <Send size={17} aria-hidden="true" className="translate-x-px" />
      </button>
    </form>
  )
}
