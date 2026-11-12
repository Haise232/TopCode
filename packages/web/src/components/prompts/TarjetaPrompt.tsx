import { Check, Copy, ExternalLink, Pencil, Trash2 } from 'lucide-react'
import type { Prompt } from '@topcode/shared'
import { cn } from '../ui/cn'
import { FOCO, SUPERFICIE, mez } from '../ui/estilos'
import { tinta } from '../../lib/tinta'
import { ABRIR_EN, CATEGORIAS, MODELOS } from './config'

const ICONO_BTN = 'w-9 h-9 flex items-center justify-center rounded-lg text-text-muted transition-colors'

export default function TarjetaPrompt({
  prompt: p, puedeEditar, puedeEliminar, copiado, expandido, onCopiar, onEditar, onEliminar, onToggle,
}: {
  prompt: Prompt
  puedeEditar: boolean
  puedeEliminar: boolean
  copiado: boolean
  expandido: boolean
  onCopiar: () => void
  onEditar: () => void
  onEliminar: () => void
  onToggle: () => void
}) {
  const { label, Icon, color } = CATEGORIAS[p.categoria] ?? CATEGORIAS.general
  const larga = p.contenido.length > 280
  return (
    <article className={cn(SUPERFICIE, 'flex flex-col gap-3 p-4 sm:p-5 min-w-0')}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3 min-w-0">
          <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: mez(color, 14) }}>
            <Icon size={18} aria-hidden="true" style={{ color: tinta(color) }} />
          </span>
          <div className="min-w-0">
            <h2 className="font-bold text-[15px] text-text-primary leading-snug line-clamp-2">{p.titulo}</h2>
            <p className="mt-0.5 flex items-center gap-x-1.5 text-xs text-text-muted min-w-0">
              <span className="font-semibold" style={{ color: tinta(color) }}>{label}</span>
              <span className="text-text-faint" aria-hidden="true">·</span>
              <span className="shrink-0">{MODELOS[p.modelo] ?? p.modelo}</span>
            </p>
          </div>
        </div>
        {(puedeEditar || puedeEliminar) && (
          <div className="flex items-center -mr-1.5 -mt-1 shrink-0">
            {puedeEditar && (
              <button onClick={onEditar} aria-label={`Editar prompt: ${p.titulo}`}
                className={cn(ICONO_BTN, 'hover:bg-ov/[0.06] hover:text-text-primary', FOCO)}>
                <Pencil size={14} aria-hidden="true" />
              </button>
            )}
            {puedeEliminar && (
              <button onClick={onEliminar} aria-label={`Eliminar prompt: ${p.titulo}`}
                className={cn(ICONO_BTN, 'hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-300', FOCO)}>
                <Trash2 size={14} aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </div>

      {p.descripcion && <p className="text-sm leading-relaxed text-text-secondary">{p.descripcion}</p>}

      <div className="rounded-xl border border-ov/[0.07] bg-ov/[0.04] px-3.5 py-3">
        <pre className={cn('whitespace-pre-wrap break-words font-mono text-[12.5px] leading-relaxed text-text-primary', larga && !expandido && 'line-clamp-6')}>
          {p.contenido}
        </pre>
        {larga && (
          <button onClick={onToggle} aria-expanded={expandido}
            className={cn('mt-2 rounded-md text-xs font-semibold text-primary-light hover:underline underline-offset-4', FOCO)}>
            {expandido ? 'Ver menos' : 'Ver completo'}
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={onCopiar}
          className={cn(
            'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors active:scale-[0.98] w-full sm:w-auto',
            FOCO,
            copiado
              ? 'bg-teal/[0.16] text-teal-light'
              : 'bg-gradient-to-br from-primary to-primary-dark text-white hover:opacity-90',
          )}
        >
          {copiado ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
          <span aria-live="polite">{copiado ? 'Copiado' : 'Copiar prompt'}</span>
        </button>
        <span className="text-xs text-text-muted sm:ml-1">Abrir en</span>
        {ABRIR_EN.map(a => (
          <a key={a.label} href={a.url(p.contenido)} target="_blank" rel="noopener noreferrer"
            onClick={a.copiar ? onCopiar : undefined}
            title={a.copiar ? 'Copia el prompt y abre Gemini: pégalo con Ctrl+V' : undefined}
            aria-label={a.copiar
              ? `Copiar el prompt y abrir ${a.label} para pegarlo (se abre en una pestaña nueva)`
              : `Abrir en ${a.label} (se abre en una pestaña nueva)`}
            className={cn('inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-ov/[0.1] text-text-secondary hover:bg-ov/[0.05] hover:text-text-primary transition-colors', FOCO)}>
            {a.label}
            <ExternalLink size={11} aria-hidden="true" />
          </a>
        ))}
      </div>

      <p className="mt-auto text-xs text-text-muted truncate">Compartido por {p.autor}</p>
    </article>
  )
}
