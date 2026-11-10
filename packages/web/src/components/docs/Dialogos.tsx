import { useId, type FormEvent } from 'react'
import { FilePlus2, History } from 'lucide-react'
import type { DocRevision } from '../../hooks/useDocs'
import { Button } from '../ui'
import { cn } from '../ui/cn'
import { FOCO } from '../ui/estilos'
import MarkdownView, { type WikiPage } from './MarkdownView'
import { Dialogo, ETIQUETA, INPUT } from './Piezas'
import { formatFechaHora } from './fecha'

export function NuevaPaginaDialogo({ titulo, error, creando, onTitulo, onSubmit, onClose }: {
  /** null = cerrado */
  titulo: string | null
  error: string | null
  creando: boolean
  onTitulo: (t: string) => void
  onSubmit: (e: FormEvent) => void
  onClose: () => void
}) {
  const id = useId()
  return (
    <Dialogo
      open={titulo !== null} onClose={onClose} titulo="Nueva página" Icon={FilePlus2}
      subtitulo="Se añadirá al final de la colección" ancho="sm:max-w-md" onSubmit={onSubmit}
      pie={<>
        <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button type="submit" loading={creando}>Crear</Button>
      </>}
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className={ETIQUETA}>Título</label>
        <input id={id} value={titulo ?? ''} maxLength={200} autoFocus className={INPUT}
          aria-invalid={!!error} onChange={e => onTitulo(e.target.value)} placeholder="Ej. 07 - Conclusiones" />
        {error && <p role="alert" className="text-xs text-rose-600 dark:text-rose-300">{error}</p>}
      </div>
    </Dialogo>
  )
}

export function HistorialDialogo({ revisiones, seleccionada, onSeleccionar, tituloPagina, paginas, onRestaurar, onClose }: {
  /** null = cerrado */
  revisiones: DocRevision[] | null
  seleccionada: DocRevision | null
  onSeleccionar: (r: DocRevision) => void
  tituloPagina?: string
  paginas: WikiPage[]
  onRestaurar: (r: DocRevision) => void
  onClose: () => void
}) {
  return (
    <Dialogo
      open={revisiones !== null} onClose={onClose} titulo="Historial de cambios" Icon={History}
      subtitulo={tituloPagina} ancho="sm:max-w-5xl" alto="h-[88dvh] sm:h-[80vh]" plano
    >
      {revisiones && revisiones.length === 0 ? (
        <p className="flex-1 flex items-center justify-center px-6 text-center text-sm text-text-muted">
          Esta página todavía no tiene versiones anteriores.
        </p>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col md:flex-row">
          <ul className="md:w-60 shrink-0 max-h-40 md:max-h-none overflow-y-auto border-b md:border-b-0 md:border-r border-ov/[0.07] p-2 flex flex-col gap-0.5">
            {revisiones?.map(r => {
              const activa = seleccionada?.id === r.id
              return (
                <li key={r.id}>
                  <button
                    onClick={() => onSeleccionar(r)} aria-current={activa}
                    className={cn('w-full text-left rounded-lg px-3 py-2 transition-colors', FOCO, activa ? 'bg-ov/[0.08]' : 'hover:bg-ov/[0.04]')}
                  >
                    <span className={cn('block text-xs text-text-primary', activa ? 'font-bold' : 'font-semibold')}>{formatFechaHora(r.created_at)}</span>
                    <span className="block text-xs text-text-muted truncate">{r.editado_por_nombre || 'Desconocido'}</span>
                  </button>
                </li>
              )
            })}
          </ul>
          <div className="flex-1 min-w-0 flex flex-col min-h-0">
            {seleccionada && (
              <>
                <div className="px-5 py-2.5 border-b border-ov/[0.07] flex items-center justify-between gap-3">
                  <p className="text-xs text-text-muted truncate">Versión «{seleccionada.titulo}»</p>
                  <Button size="sm" variant="subtle" onClick={() => onRestaurar(seleccionada)}>
                    Restaurar en el editor
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto px-5 md:px-8 py-5">
                  <MarkdownView content={seleccionada.contenido} pages={paginas} />
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </Dialogo>
  )
}
