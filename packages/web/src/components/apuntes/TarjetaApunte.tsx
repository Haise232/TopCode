import { BookOpen, Download, ExternalLink, Eye, Trash2 } from 'lucide-react'
import type { ApunteConAutor } from '../../hooks/useApuntes'
import { tinta } from '../../lib/tinta'
import { cn } from '../ui/cn'
import { FOCO, SUPERFICIE, materiaColor, mez } from '../ui/estilos'
import IconoTipo from './IconoTipo'
import { TIPO_CONFIG, extension, fechaCorta } from './tipos'

const ACCION = cn('flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-ov/[0.06] transition-colors', FOCO)
const ELIMINAR = cn('flex items-center justify-center rounded-lg text-text-muted hover:text-rose-600 dark:hover:text-rose-300 hover:bg-rose-500/10 transition-colors', FOCO)

function ChipMateria({ materia }: { materia: string }) {
  const c = materiaColor(materia)
  return (
    <span className="inline-flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-full max-w-full"
      style={{ background: mez(c, 14), color: tinta(c) }}>
      <BookOpen size={10} aria-hidden="true" className="shrink-0" />
      <span className="truncate">{materia}</span>
    </span>
  )
}

function Extension({ ap }: { ap: ApunteConAutor }) {
  const { color } = TIPO_CONFIG[ap.tipo]
  return (
    <span className="text-2xs font-bold px-2 py-0.5 rounded-md shrink-0 tracking-wide"
      style={{ background: mez(color, 14), color: tinta(color) }}>
      {extension(ap)}
    </span>
  )
}

interface Props { ap: ApunteConAutor; canDelete: boolean; onDelete: () => void; onPreview: () => void }

/** Tarjeta de archivo (vista en rejilla). */
export function TarjetaApunte({ ap, canDelete, onDelete, onPreview }: Props) {
  const canPreview = ap.tipo === 'pdf' || ap.tipo === 'imagen'
  return (
    <article className={cn(SUPERFICIE, 'p-4 flex flex-col gap-3 min-w-0')}>
      <div className="flex items-start gap-3">
        <IconoTipo tipo={ap.tipo} />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold leading-snug line-clamp-2 break-words text-text-primary" title={ap.nombre}>{ap.nombre}</h3>
          <p className="text-xs mt-0.5 text-text-muted">{fechaCorta(ap.created_at)}</p>
        </div>
        <Extension ap={ap} />
      </div>
      {ap.materia && <div className="flex"><ChipMateria materia={ap.materia} /></div>}
      <div className="flex items-center gap-1.5 mt-auto pt-3 border-t border-ov/[0.07]">
        {canPreview ? (
          <button onClick={onPreview}
            className={cn('flex-1 flex items-center justify-center gap-1.5 h-9 text-xs font-semibold rounded-lg bg-ov/[0.05] text-text-primary hover:bg-ov/[0.09] transition-colors', FOCO)}>
            <Eye size={14} aria-hidden="true" /> Ver
          </button>
        ) : (
          <a href={ap.url} target="_blank" rel="noopener noreferrer"
            className={cn('flex-1 flex items-center justify-center gap-1.5 h-9 text-xs font-semibold rounded-lg bg-ov/[0.05] text-text-primary hover:bg-ov/[0.09] transition-colors', FOCO)}>
            <ExternalLink size={14} aria-hidden="true" /> Abrir
          </a>
        )}
        <a href={ap.url} download aria-label={`Descargar ${ap.nombre}`} className={cn(ACCION, 'w-9 h-9')}>
          <Download size={15} aria-hidden="true" />
        </a>
        {canDelete && (
          <button onClick={onDelete} aria-label={`Eliminar ${ap.nombre}`} className={cn(ELIMINAR, 'w-9 h-9')}>
            <Trash2 size={15} aria-hidden="true" />
          </button>
        )}
      </div>
    </article>
  )
}

/** Fila de archivo (vista en lista). */
export function FilaApunte({ ap, canDelete, onDelete, onPreview }: Props) {
  const canPreview = ap.tipo === 'pdf' || ap.tipo === 'imagen'
  return (
    <div className={cn(SUPERFICIE, 'flex items-center gap-3 pl-3 pr-2 py-2 min-w-0')}>
      <IconoTipo tipo={ap.tipo} size={36} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate text-text-primary" title={ap.nombre}>{ap.nombre}</p>
        <p className="text-xs mt-0.5 text-text-muted truncate">
          {fechaCorta(ap.created_at)}
          {ap.materia && <> · <span style={{ color: tinta(materiaColor(ap.materia)) }} className="font-medium">{ap.materia}</span></>}
        </p>
      </div>
      <span className="hidden sm:inline-flex"><Extension ap={ap} /></span>
      <div className="flex items-center shrink-0">
        {canPreview ? (
          <button onClick={onPreview} aria-label={`Vista previa de ${ap.nombre}`} className={cn(ACCION, 'w-9 h-9')}>
            <Eye size={15} aria-hidden="true" />
          </button>
        ) : (
          <a href={ap.url} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${ap.nombre}`} className={cn(ACCION, 'w-9 h-9')}>
            <ExternalLink size={15} aria-hidden="true" />
          </a>
        )}
        <a href={ap.url} download aria-label={`Descargar ${ap.nombre}`} className={cn(ACCION, 'w-9 h-9')}>
          <Download size={15} aria-hidden="true" />
        </a>
        {canDelete && (
          <button onClick={onDelete} aria-label={`Eliminar ${ap.nombre}`} className={cn(ELIMINAR, 'w-9 h-9')}>
            <Trash2 size={15} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  )
}
