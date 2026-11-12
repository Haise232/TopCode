import { useState } from 'react'
import { Eye, EyeOff, Link2, Megaphone, Plus, ScanEye, Trash2 } from 'lucide-react'
import type { Anuncio } from '@topcode/shared'
import { Button, Spinner } from '../ui'
import { cn } from '../ui/cn'
import { Seccion } from '../ui/Seccion'
import { FOCO, SUPERFICIE } from '../ui/estilos'
import { AnuncioDialogo } from '../acceso/AnuncioDialogo'

const INPUT = 'bg-input border border-ov/[0.08] rounded-xl px-4 py-3 text-text-primary text-sm placeholder:text-text-muted transition-[border-color,box-shadow] duration-200 w-full outline-none focus:border-primary/50 focus:shadow-[0_0_0_3px_rgb(var(--c-primary)/0.12)]'

export interface AnunciosProps {
  anuncios: Anuncio[]
  titulo: string
  contenido: string
  onTitulo: (v: string) => void
  onContenido: (v: string) => void
  enlace: string
  onEnlace: (v: string) => void
  guardando: boolean
  toggling: number | null
  onPublicar: (e: React.FormEvent) => void
  onToggle: (a: Anuncio) => void
  onEliminar: (a: Anuncio) => void
}

/** Anuncios (solo master): formulario de publicación + historial con estado activo. */
export default function Anuncios(p: AnunciosProps) {
  const [previa, setPrevia] = useState(false)
  const enlaceValido = !p.enlace.trim() || p.enlace.trim().startsWith('/')
  const listo = !!p.titulo.trim() && !!p.contenido.trim() && enlaceValido

  return (
    <Seccion titulo="Anuncios" subtitulo="El último anuncio activo aparece a cada usuario una sola vez, en cualquier dispositivo">
      <form onSubmit={p.onPublicar} className={cn(SUPERFICIE, 'p-5 flex flex-col gap-3')}>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="anuncio-titulo" className="text-xs font-semibold text-text-secondary">Título</label>
          <input id="anuncio-titulo" type="text" value={p.titulo} onChange={e => p.onTitulo(e.target.value)}
            placeholder="Título del anuncio..." className={INPUT} maxLength={100} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="anuncio-contenido" className="text-xs font-semibold text-text-secondary">Mensaje</label>
          <textarea id="anuncio-contenido" value={p.contenido} onChange={e => p.onContenido(e.target.value)}
            placeholder="Escribe aquí el mensaje. Deja una línea en blanco entre párrafos y empieza con «- » para hacer una lista." rows={6}
            className={cn(INPUT, 'resize-y min-h-[8rem]')} maxLength={1000} />
          <span className="self-end text-2xs tabular-nums text-text-muted">{p.contenido.length}/1000</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="anuncio-enlace" className="text-xs font-semibold text-text-secondary">
            Enlace <span className="font-normal text-text-muted">(opcional)</span>
          </label>
          <div className="relative">
            <Link2 size={15} aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input id="anuncio-enlace" type="text" value={p.enlace} onChange={e => p.onEnlace(e.target.value)}
              placeholder="/docs/… — se muestra como botón «Abrir ahora»" maxLength={200}
              aria-invalid={!enlaceValido} className={cn(INPUT, 'pl-10', !enlaceValido && 'border-rose-500/60')} />
          </div>
          {!enlaceValido && <p className="text-2xs text-rose-600 dark:text-rose-300">Usa una ruta interna que empiece por «/».</p>}
        </div>
        <div className="flex items-center justify-end gap-2 pt-1">
          <button type="button" onClick={() => setPrevia(true)} disabled={!listo}
            className={cn('inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold text-text-secondary hover:bg-ov/[0.06] transition-colors disabled:opacity-50', FOCO)}>
            <ScanEye size={15} aria-hidden="true" />
            Vista previa
          </button>
          <Button type="submit" disabled={p.guardando || !listo} loading={p.guardando}
            icon={<Plus size={14} aria-hidden="true" />}>
            Publicar anuncio
          </Button>
        </div>
      </form>

      {previa && (
        <AnuncioDialogo
          anuncio={{ titulo: p.titulo, contenido: p.contenido, enlace: p.enlace.trim() || null, created_at: new Date().toISOString() }}
          cerrando={false}
          onLeido={() => setPrevia(false)}
          onAbrir={() => setPrevia(false)}
        />
      )}

      {p.anuncios.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-2xs font-bold uppercase tracking-wider text-text-muted">Historial</h3>
          <ul className={cn(SUPERFICIE, 'overflow-hidden divide-y divide-ov/[0.07]')}>
            {p.anuncios.map(a => (
              <li key={a.id} className="flex items-start gap-3 px-4 py-3.5">
                <span className={cn('w-9 h-9 shrink-0 flex items-center justify-center rounded-xl',
                  a.activo ? 'bg-gold/15 text-gold-light' : 'bg-ov/[0.05] text-text-faint')}>
                  <Megaphone size={16} aria-hidden="true" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={cn('font-semibold text-sm truncate', a.activo ? 'text-text-primary' : 'text-text-muted')}>{a.titulo}</p>
                    <span className={cn('shrink-0 inline-flex items-center gap-1 text-2xs font-bold px-2 py-0.5 rounded-full',
                      a.activo ? 'bg-teal/15 text-teal-light' : 'bg-ov/[0.06] text-text-muted')}>
                      <span className={cn('w-1.5 h-1.5 rounded-full', a.activo ? 'bg-teal' : 'bg-text-faint')} aria-hidden="true" />
                      {a.activo ? 'Activo' : 'Oculto'}
                    </span>
                  </div>
                  <p className="text-xs mt-1 line-clamp-2 text-text-muted">{a.contenido}</p>
                  <p className="flex items-center gap-1.5 text-2xs mt-1 text-text-faint">
                    {new Date(a.created_at).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {a.enlace && <><span aria-hidden="true">·</span><Link2 size={11} aria-hidden="true" /><span className="truncate">{a.enlace}</span></>}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => p.onToggle(a)} disabled={p.toggling === a.id}
                    title={a.activo ? 'Desactivar' : 'Activar'} aria-label={a.activo ? `Desactivar ${a.titulo}` : `Activar ${a.titulo}`}
                    className={cn('w-9 h-9 flex items-center justify-center rounded-xl text-text-secondary hover:bg-ov/[0.06] transition-colors disabled:opacity-50', FOCO)}>
                    {p.toggling === a.id ? <Spinner size="sm" /> : a.activo ? <Eye size={15} aria-hidden="true" /> : <EyeOff size={15} aria-hidden="true" />}
                  </button>
                  <span className="w-px h-5 bg-ov/[0.12]" aria-hidden="true" />
                  <button onClick={() => p.onEliminar(a)} title="Eliminar" aria-label={`Eliminar ${a.titulo}`}
                    className={cn('w-9 h-9 flex items-center justify-center rounded-xl text-rose-600 dark:text-rose-300 hover:bg-rose-500/10 transition-colors', FOCO)}>
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Seccion>
  )
}
