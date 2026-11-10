import { Pencil, Plus, Trash2 } from 'lucide-react'
import type { HorarioClase } from '@topcode/shared'
import { Button, Spinner } from '../ui'
import { cn } from '../ui/cn'
import { Seccion } from '../ui/Seccion'
import { FOCO, SUPERFICIE, materiaColor } from '../ui/estilos'
import { DIAS_SEMANA } from './dias'

const ICONO = 'w-9 h-9 flex items-center justify-center rounded-lg text-text-muted transition-colors'

/** Presentación del horario semanal de la clase del admin; lógica en components/AdminHorario.tsx. */
export default function HorarioPanel({ clase, loading, porDia, onNueva, onEditar, onEliminar }: {
  clase: string | null
  loading: boolean
  porDia: Record<number, HorarioClase[]>
  onNueva: () => void
  onEditar: (c: HorarioClase) => void
  onEliminar: (c: HorarioClase) => void
}) {
  return (
    <Seccion
      titulo="Horario"
      subtitulo={clase ? `Horario semanal de ${clase}` : 'Horario semanal de cada clase'}
      extra={clase && (
        <Button type="button" size="sm" icon={<Plus size={14} aria-hidden="true" />} onClick={onNueva}>Añadir clase</Button>
      )}
    >
      {!clase && (
        <div className={cn(SUPERFICIE, 'p-5 text-sm text-text-muted')}>
          Este administrador todavía no tiene una clase asignada.
        </div>
      )}
      <div className={cn(SUPERFICIE, 'overflow-hidden divide-y divide-ov/[0.07]')}>
        {loading ? (
          <div className="flex items-center justify-center py-10"><Spinner size="sm" /></div>
        ) : (
          [1, 2, 3, 4, 5].map(dia => {
            const clases = porDia[dia] ?? []
            return (
              <div key={dia} className="flex flex-col gap-1 px-4 py-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">{DIAS_SEMANA[dia]}</h3>
                {clases.length === 0 ? (
                  <p className="text-xs text-text-muted">Sin clases</p>
                ) : (
                  <ul className="flex-1 min-w-0 flex flex-col">
                    {clases.map(c => (
                      <li key={c.id} className="flex items-center gap-2.5 py-1">
                        <span className="font-mono text-xs tabular-nums text-text-muted w-[88px] shrink-0">{c.hora_inicio}–{c.hora_fin}</span>
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: materiaColor(c.materia) }} aria-hidden="true" />
                        <span className="text-sm text-text-primary flex-1 min-w-0 truncate">{c.materia}</span>
                        <span className="hidden min-[420px]:inline text-2xs font-bold px-2 py-0.5 rounded-md bg-ov/[0.06] text-text-muted shrink-0">{c.codigo}</span>
                        <div className="flex items-center shrink-0">
                          <button onClick={() => onEditar(c)} aria-label={`Editar ${c.materia}`} title="Editar"
                            className={cn(ICONO, 'hover:text-primary-light hover:bg-ov/[0.06]', FOCO)}>
                            <Pencil size={14} aria-hidden="true" />
                          </button>
                          <button onClick={() => onEliminar(c)} aria-label={`Eliminar ${c.materia}`} title="Eliminar"
                            className={cn(ICONO, 'hover:text-rose-600 dark:hover:text-rose-300 hover:bg-rose-500/10', FOCO)}>
                            <Trash2 size={14} aria-hidden="true" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })
        )}
      </div>
    </Seccion>
  )
}
