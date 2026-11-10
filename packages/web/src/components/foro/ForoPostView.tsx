import { ArrowLeft, Check, CheckCircle2, Loader2, MessageCircle, Send } from 'lucide-react'
import type { RefObject } from 'react'
import type { ForoPost, ForoRespuesta } from '@topcode/shared'
import { Button } from '../ui'
import { cn } from '../ui/cn'
import { FOCO, SUPERFICIE } from '../ui/estilos'
import { Seccion } from '../ui/Seccion'
import { Avatar } from './Avatar'
import { Categoria, Estado } from './Estado'
import { formatDateTime } from './categorias'

export interface ForoPostViewProps {
  post: ForoPost
  respuestas: Pick<ForoRespuesta, 'id' | 'autor' | 'cuerpo' | 'es_solucion' | 'created_at'>[]
  nombreUsuario: string
  canResolve: boolean
  texto: string
  onTexto: (v: string) => void
  sending: boolean
  markingId: string | null
  onVolver: () => void
  onMarcarResuelta: () => void
  onSolucion: (id: string) => void
  onEnviar: (e: React.FormEvent) => void
  endRef: RefObject<HTMLDivElement>
}

export function VolverForo({ onVolver }: { onVolver: () => void }) {
  return (
    <button onClick={onVolver}
      className={cn('w-fit inline-flex items-center gap-1.5 rounded-md text-xs font-semibold text-primary-light hover:underline underline-offset-4', FOCO)}>
      <ArrowLeft size={14} aria-hidden="true" />Foro de dudas
    </button>
  )
}

export function HiloCargando() {
  return (
    <div className="motion-safe:animate-fade-in h-full flex items-center justify-center" role="status" aria-label="Cargando pregunta">
      <Loader2 size={24} className="animate-spin text-primary-light" aria-hidden="true" />
    </div>
  )
}

export function HiloNoEncontrado({ onVolver }: { onVolver: () => void }) {
  return (
    <div className="motion-safe:animate-fade-in h-full flex flex-col items-center justify-center gap-4 px-4">
      <div className={cn(SUPERFICIE, 'flex flex-col items-center gap-3 text-center px-8 py-10')}>
        <span className="w-14 h-14 flex items-center justify-center rounded-full bg-gold/15 text-gold-light">
          <MessageCircle size={26} aria-hidden="true" />
        </span>
        <p className="font-bold text-lg text-text-primary">No se encontró la pregunta</p>
        <p className="text-sm text-text-muted">Puede que se haya eliminado.</p>
        <Button variant="ghost" onClick={onVolver} className="px-5 mt-1">Volver al foro</Button>
      </div>
    </div>
  )
}

function Respuesta({
  r, canMark, marking, onSolucion,
}: {
  r: ForoPostViewProps['respuestas'][number]
  canMark: boolean
  marking: boolean
  onSolucion: () => void
}) {
  const sol = r.es_solucion
  return (
    <article
      className={cn(
        'rounded-2xl border overflow-hidden',
        sol ? 'border-teal/60 bg-surface shadow-card' : 'bg-surface border-ov/[0.07] shadow-card',
      )}
    >
      {sol && (
        <div className="flex items-center gap-1.5 px-4 sm:px-5 py-2 text-xs font-bold bg-teal/[0.14] text-teal-light">
          <CheckCircle2 size={14} aria-hidden="true" />
          Solución aceptada
        </div>
      )}
      <div className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar nombre={r.autor} size={32} />
            <div className="min-w-0">
              <p className="font-semibold text-sm leading-tight text-text-primary truncate">{r.autor}</p>
              <p className="text-xs text-text-muted">{formatDateTime(r.created_at)}</p>
            </div>
          </div>
          {canMark && (
            <button onClick={onSolucion} disabled={marking}
              className={cn('shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-teal/30 text-teal-light bg-teal/[0.08] hover:bg-teal/[0.15] transition-colors disabled:opacity-50', FOCO)}>
              <Check size={13} aria-hidden="true" />
              Marcar solución
            </button>
          )}
        </div>
        <p className="mt-3 text-sm text-text-secondary leading-relaxed whitespace-pre-wrap break-words">{r.cuerpo}</p>
      </div>
    </article>
  )
}

export default function ForoPostView(p: ForoPostViewProps) {
  const { post, respuestas } = p
  const hayTexto = p.texto.trim().length > 0
  return (
    <div className="motion-safe:animate-fade-in h-full flex flex-col">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 md:px-6 pt-6 pb-8 flex flex-col gap-6">
          <VolverForo onVolver={p.onVolver} />

          {/* Pregunta original */}
          <article className={cn(SUPERFICIE, 'p-5 sm:p-6')}>
            <div className="flex items-center gap-2 flex-wrap">
              <Categoria codigo={post.materia} />
              <Estado resuelto={post.resuelto} />
            </div>
            <h1 className="mt-3 font-extrabold text-2xl sm:text-3xl tracking-tight leading-tight text-text-primary break-words">{post.titulo}</h1>
            <div className="mt-4 flex items-center gap-2.5">
              <Avatar nombre={post.autor} size={36} />
              <div className="min-w-0">
                <p className="font-semibold text-sm leading-tight text-text-primary truncate">{post.autor}</p>
                <p className="text-xs text-text-muted">{formatDateTime(post.created_at)}</p>
              </div>
            </div>
            <p className="mt-4 text-sm sm:text-[15px] text-text-secondary leading-relaxed whitespace-pre-wrap break-words">{post.cuerpo}</p>
            {p.canResolve && !post.resuelto && respuestas.length > 0 && (
              <div className="mt-5 pt-4 border-t border-ov/[0.07] flex items-center justify-between gap-3 flex-wrap">
                <p className="text-xs text-text-muted">¿Ya tienes tu respuesta?</p>
                <button onClick={p.onMarcarResuelta}
                  className={cn('inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border border-teal/30 text-teal-light bg-teal/[0.08] hover:bg-teal/[0.15] transition-colors', FOCO)}>
                  <CheckCircle2 size={14} aria-hidden="true" />
                  Marcar resuelta
                </button>
              </div>
            )}
          </article>

          {/* Respuestas */}
          {respuestas.length > 0 ? (
            <Seccion titulo={`${respuestas.length} ${respuestas.length === 1 ? 'respuesta' : 'respuestas'}`}>
              <div className="flex flex-col gap-3">
                {respuestas.map(r => (
                  <Respuesta key={r.id} r={r}
                    canMark={p.canResolve && !r.es_solucion && !post.resuelto}
                    marking={p.markingId === r.id}
                    onSolucion={() => p.onSolucion(r.id)} />
                ))}
              </div>
            </Seccion>
          ) : (
            <p className="text-sm text-text-muted text-center py-4">Todavía nadie ha respondido. Sé el primero en ayudar.</p>
          )}

          <div ref={p.endRef} />
        </div>
      </div>

      {/* Caja de respuesta */}
      <div className="shrink-0 border-t border-ov/[0.08] bg-surface">
        <form onSubmit={p.onEnviar} className="max-w-3xl mx-auto px-4 md:px-6 py-3 flex items-end gap-3">
          <div className="hidden sm:block pb-0.5"><Avatar nombre={p.nombreUsuario} size={40} /></div>
          <label htmlFor="foro-respuesta" className="sr-only">Tu respuesta</label>
          <textarea
            id="foro-respuesta"
            value={p.texto}
            onChange={e => p.onTexto(e.target.value)}
            placeholder="Escribe tu respuesta..."
            rows={1}
            className="flex-1 bg-input border border-ov/[0.08] rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted outline-none transition-[border-color,box-shadow] focus:border-primary/50 focus:shadow-[0_0_0_3px_rgb(var(--c-primary)/0.12)] resize-none min-h-[44px] max-h-32 overflow-y-auto"
            style={{ lineHeight: '1.5' }}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (hayTexto) e.currentTarget.form?.requestSubmit() }
            }}
            onInput={e => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = `${Math.min(el.scrollHeight, 128)}px`
            }}
          />
          <button
            type="submit"
            disabled={!hayTexto || p.sending}
            aria-label="Enviar respuesta"
            className={cn('w-11 h-11 flex items-center justify-center rounded-xl shrink-0 transition-all active:scale-95', FOCO,
              hayTexto ? 'bg-gradient-to-br from-primary to-primary-dark text-white' : 'bg-ov/[0.06] text-text-muted', 'disabled:opacity-60')}
          >
            {p.sending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Send size={16} aria-hidden="true" className="translate-x-px" />}
          </button>
        </form>
      </div>
    </div>
  )
}
