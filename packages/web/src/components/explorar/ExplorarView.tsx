import { useId, useState, type ElementType } from 'react'
import { BookMarked, FileText, HelpCircle, Loader2, MessageSquare, Search, Sparkles } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { tinta } from '../../lib/tinta'
import { Copo } from '../Navidad'
import { Button } from '../ui'
import { cn } from '../ui/cn'
import { FOCO, SUPERFICIE, SUPERFICIE_PULSABLE, materiaColor, mez } from '../ui/estilos'
import { EnlaceAccion, Seccion } from '../ui/Seccion'

export type DocItem = {
  id: string
  coleccion_id: string
  titulo: string
  updated_at: string
  updated_by_nombre: string
  docs_colecciones: { titulo: string } | null
}

export type PromptItem = {
  id: string
  titulo: string
  descripcion: string | null
  contenido: string
  categoria: string
  autor: string
  created_at: string
}

export type ForoItem = {
  id: string
  titulo: string
  cuerpo: string
  autor: string
  resuelto: boolean
  created_at: string
  foro_respuestas?: { id: string }[]
}

export type ExploreData = { docs: DocItem[]; prompts: PromptItem[]; dudas: ForoItem[] }

export interface ExplorarViewProps {
  data: ExploreData
  loading: boolean
  error: boolean
  /** Enter en el buscador */
  onBuscar: (q: string) => void
  onIr: (ruta: string) => void
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('es', { day: 'numeric', month: 'short' })
}

function Vacio({ Icon, mensaje }: { Icon: ElementType; mensaje: string }) {
  return (
    <div className={cn(SUPERFICIE, 'flex flex-col items-center gap-2.5 text-center px-6 py-8')}>
      <span className="w-11 h-11 flex items-center justify-center rounded-full bg-gold/15 text-gold-light">
        <Icon size={20} aria-hidden="true" />
      </span>
      <p className="text-sm text-text-muted max-w-xs">{mensaje}</p>
    </div>
  )
}

export default function ExplorarView({ data, loading, error, onBuscar, onIr }: ExplorarViewProps) {
  const { navidad } = useTheme()
  const idBuscar = useId()
  const [q, setQ] = useState('')

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center" role="status" aria-label="Cargando">
        <Loader2 size={26} className="motion-safe:animate-spin text-primary-light" />
      </div>
    )
  }

  return (
    <div className="motion-safe:animate-fade-in h-full overflow-y-auto">
      <div className="max-w-[1100px] mx-auto px-4 md:px-6 pt-6 pb-10 flex flex-col gap-8">

        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="font-extrabold text-3xl md:text-4xl tracking-tight text-text-primary">Explorar</h1>
              {navidad && <Copo size={18} className="text-gold-light" />}
            </div>
            <p className="mt-2 text-sm text-text-muted max-w-lg">Apuntes, prompts de IA y conversaciones de todos tus compañeros.</p>
          </div>
          <form role="search" className="relative w-full md:w-80 shrink-0"
            onSubmit={e => { e.preventDefault(); onBuscar(q) }}>
            <label htmlFor={idBuscar} className="sr-only">Buscar en la comunidad</label>
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" aria-hidden="true" />
            <input
              id={idBuscar} type="search" value={q} onChange={e => setQ(e.target.value)}
              placeholder="Buscar apuntes en la comunidad"
              className="bg-input border border-ov/[0.08] rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-muted w-full outline-none transition-[border-color,box-shadow] duration-200 focus:border-primary/50 focus:shadow-[0_0_0_3px_rgb(var(--c-primary)/0.12)]"
            />
          </form>
        </header>

        {error && (
          <div role="alert" className="rounded-2xl border border-rose-400/25 bg-rose-400/[0.07] px-4 py-3 text-sm text-rose-600 dark:text-rose-300">
            No se pudo cargar todo el contenido comunitario. Puedes seguir usando las secciones individuales.
          </div>
        )}

        <Seccion titulo="Dudas sin resolver" extra={<EnlaceAccion onClick={() => onIr('/foro')}>Ver foro</EnlaceAccion>}>
          {data.dudas.length === 0 ? (
            <Vacio Icon={HelpCircle} mensaje="No hay preguntas pendientes ahora mismo." />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {data.dudas.map(post => {
                const n = post.foro_respuestas?.length ?? 0
                return (
                  <button key={post.id} onClick={() => onIr(`/foro/${post.id}`)} className={cn(SUPERFICIE_PULSABLE, 'text-left p-4 flex flex-col gap-1.5')}>
                    <span className="flex items-center justify-between gap-3 text-xs text-text-muted">
                      <span className="flex items-center gap-1.5 font-semibold text-text-secondary">
                        <MessageSquare size={12} aria-hidden="true" />{n} {n === 1 ? 'respuesta' : 'respuestas'}
                      </span>
                      <span>{formatDate(post.created_at)}</span>
                    </span>
                    <h3 className="font-bold text-text-primary leading-snug line-clamp-2">{post.titulo}</h3>
                    <p className="text-sm text-text-muted line-clamp-2">{post.cuerpo}</p>
                    <span className="mt-1.5 text-xs text-text-muted">Por <span className="font-semibold text-text-secondary">{post.autor}</span></span>
                  </button>
                )
              })}
            </div>
          )}
        </Seccion>

        <Seccion titulo="Prompts IA recientes" extra={<EnlaceAccion onClick={() => onIr('/prompts')}>Ver prompts</EnlaceAccion>}>
          {data.prompts.length === 0 ? (
            <Vacio Icon={Sparkles} mensaje="Todavía no hay prompts compartidos." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {data.prompts.map(item => {
                const color = materiaColor(item.categoria)
                return (
                  <button key={item.id} onClick={() => onIr('/prompts')} className={cn(SUPERFICIE_PULSABLE, 'text-left p-4 flex flex-col gap-2')}>
                    <span className="self-start rounded-full px-2.5 py-0.5 text-2xs font-bold uppercase tracking-wider"
                      style={{ background: mez(color, 16), color: tinta(color) }}>{item.categoria}</span>
                    <h3 className="font-bold text-sm text-text-primary leading-snug line-clamp-2">{item.titulo}</h3>
                    <p className="text-xs text-text-muted line-clamp-2">{item.descripcion || item.contenido}</p>
                    <span className="mt-auto pt-2 text-xs text-text-muted truncate">{item.autor} · {formatDate(item.created_at)}</span>
                  </button>
                )
              })}
            </div>
          )}
        </Seccion>

        <Seccion titulo="Documentación reciente" extra={<EnlaceAccion onClick={() => onIr('/docs')}>Ver documentación</EnlaceAccion>}>
          {data.docs.length === 0 ? (
            <Vacio Icon={BookMarked} mensaje="Todavía no hay documentación publicada." />
          ) : (
            <div className="grid gap-3 md:grid-cols-3">
              {data.docs.map(item => (
                <button key={item.id} onClick={() => onIr(`/docs/${item.coleccion_id}/${item.id}`)} className={cn(SUPERFICIE_PULSABLE, 'text-left p-4 flex flex-col gap-1.5')}>
                  <span className="flex items-center gap-1.5 text-xs text-text-muted">
                    <FileText size={12} className="shrink-0" aria-hidden="true" />
                    <span className="truncate">{item.docs_colecciones?.titulo ?? 'Documentación'}</span>
                  </span>
                  <h3 className="font-bold text-text-primary leading-snug line-clamp-2">{item.titulo}</h3>
                  <span className="mt-auto pt-2 text-xs text-text-muted truncate">
                    {item.updated_by_nombre ? `${item.updated_by_nombre} · ` : ''}{formatDate(item.updated_at)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </Seccion>

        <div className="flex flex-wrap gap-3 border-t border-ov/[0.08] pt-6">
          <Button onClick={() => onIr('/foro')} className={FOCO}>Preguntar en el foro</Button>
          <Button variant="ghost" onClick={() => onIr('/apuntes')} className={FOCO}>Explorar apuntes</Button>
        </div>
      </div>
    </div>
  )
}
