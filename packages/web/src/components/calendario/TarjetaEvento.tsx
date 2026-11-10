import { AlertTriangle, CalendarDays, Check, Clock, Pencil, Trash2, Zap } from 'lucide-react'
import { fechaLimiteEvento, type EventoCalendario } from '@topcode/shared'
import { TipoEventoBadge, tipoEventoConfig } from '../../lib/tiposEvento'
import { tinta } from '../../lib/tinta'
import { Spinner } from '../ui'
import { cn } from '../ui/cn'
import { FOCO, SUPERFICIE, materiaColor, mez, varsColor } from '../ui/estilos'
import { MESES_CORTO, fechaRelativa, formatFecha, type EstadoActividad } from './tipos'

const ROSE = 'var(--color-rose)'
const AMBAR = 'var(--color-warning)'
const TEAL = 'rgb(var(--c-teal-light))'

const BOTON_ICONO = cn(
  'w-9 h-9 flex items-center justify-center rounded-lg text-text-muted transition-colors',
  FOCO,
)

type Aviso = { texto: string; Icon?: typeof Zap; fondo: string; color: string; pulso?: boolean }

/** Chip de urgencia con el mismo criterio que Inicio: rojo si es hoy o está vencida, ámbar si es inminente. */
function avisoEvento(
  { relativo, daysUntil, past, completada, vencida }:
  { relativo: string; daysUntil: number; past?: boolean; completada: boolean; vencida: boolean },
): Aviso {
  if (completada) return { texto: 'Completada', Icon: Check, fondo: mez('rgb(var(--c-teal))', 16), color: TEAL }
  if (vencida) return { texto: 'Vencida', Icon: AlertTriangle, fondo: mez(ROSE, 14), color: tinta(ROSE) }
  if (past) return { texto: relativo, fondo: 'var(--overlay-05)', color: 'var(--color-text-muted)' }
  if (daysUntil === 0) return { texto: relativo, Icon: Zap, fondo: mez(ROSE, 15), color: tinta(ROSE), pulso: true }
  if (daysUntil <= 2) return { texto: relativo, fondo: mez(AMBAR, 16), color: tinta(AMBAR) }
  return { texto: relativo, fondo: 'var(--overlay-05)', color: 'var(--color-text-secondary)' }
}

export default function TarjetaEvento({
  evento, puedeGestionar, onEdit, onDelete, past, highlight, estado,
}: {
  evento: EventoCalendario
  puedeGestionar: boolean
  onEdit: () => void
  onDelete: () => void
  past?: boolean
  highlight?: boolean
  estado?: EstadoActividad
}) {
  const relativo = fechaRelativa(evento.fecha)
  const esHoy = relativo === 'Hoy'
  const [, mes, dia] = evento.fecha.split('-').map(Number)

  const cfg = tipoEventoConfig(evento.tipo)
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const daysUntil = Math.round((new Date(evento.fecha + 'T00:00:00').getTime() - hoy.getTime()) / 86400000)

  const completada = estado?.completada ?? false
  const vencida = !!estado && !completada && fechaLimiteEvento(evento).getTime() < Date.now()
  const aviso = avisoEvento({ relativo, daysUntil, past, completada, vencida })
  const apagada = past || completada
  const colorMateria = evento.materia ? materiaColor(evento.materia) : null

  return (
    <div
      className={cn(SUPERFICIE, 'flex items-stretch overflow-hidden transition-[box-shadow,border-color] duration-200')}
      style={{
        ...varsColor(cfg.color),
        ...(highlight ? { borderColor: mez('var(--color-primary)', 60), boxShadow: `0 0 0 3px ${mez('var(--color-primary)', 16)}` }
          : esHoy && !past ? { borderColor: mez(ROSE, 40) } : null),
      }}
    >
      {/* Fecha */}
      <div
        className={cn(
          'shrink-0 w-[60px] sm:w-[68px] flex flex-col items-center justify-center gap-0.5 py-3',
          past ? 'bg-ov/[0.04] text-text-muted' : 'bg-[color:var(--c-suave)] text-[color:var(--c-ink)]',
        )}
      >
        <span className="text-2xs font-extrabold uppercase tracking-wider leading-none">{MESES_CORTO[mes - 1]}</span>
        <span className="text-2xl font-black leading-none tabular-nums">{dia}</span>
      </div>

      {/* Contenido */}
      <div className={cn('flex-1 min-w-0 px-3 sm:px-4 py-3 flex flex-col gap-1.5', apagada && 'opacity-80')}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-x-2 gap-y-1 flex-wrap min-w-0">
            <TipoEventoBadge tipo={evento.tipo} />
            {evento.materia && (
              <span className="inline-flex items-center gap-1.5 text-2xs font-semibold text-text-secondary min-w-0 max-w-full">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: colorMateria! }} aria-hidden="true" />
                <span className="truncate">{evento.materia}</span>
              </span>
            )}
          </div>
          {puedeGestionar && !past && (
            <div className="flex items-center -mt-1.5 -mr-1.5 shrink-0">
              <button onClick={onEdit} aria-label="Editar evento" title="Editar"
                className={cn(BOTON_ICONO, 'hover:bg-ov/[0.06] hover:text-text-primary')}>
                <Pencil size={14} aria-hidden="true" />
              </button>
              <button onClick={onDelete} aria-label="Eliminar evento" title="Eliminar"
                className={cn(BOTON_ICONO, 'hover:bg-[color:var(--c-rose-suave)] hover:text-[color:var(--c-rose-ink)]')}
                style={{ '--c-rose-suave': mez(ROSE, 12), '--c-rose-ink': tinta(ROSE) } as React.CSSProperties}>
                <Trash2 size={14} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>

        <p className={cn('font-semibold text-sm leading-snug break-words', apagada ? 'text-text-muted' : 'text-text-primary', completada && 'line-through')}>
          {evento.titulo}
        </p>

        {evento.descripcion && (
          <p className="text-xs leading-relaxed line-clamp-2 text-text-muted">{evento.descripcion}</p>
        )}

        <div className="flex items-center gap-x-3 gap-y-1.5 flex-wrap mt-0.5">
          <span
            className={cn('inline-flex items-center gap-1 text-2xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap', aviso.pulso && 'motion-safe:animate-pulse-soft')}
            style={{ background: aviso.fondo, color: aviso.color }}
          >
            {aviso.Icon && <aviso.Icon size={10} aria-hidden="true" />}
            {aviso.texto}
          </span>
          {evento.hora && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold tabular-nums text-text-secondary">
              <Clock size={11} aria-hidden="true" />
              {evento.hora.slice(0, 5)}
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-xs text-text-muted">
            <CalendarDays size={11} aria-hidden="true" />
            {formatFecha(evento.fecha)}
          </span>
        </div>

        {estado && estado.adminCount !== null && estado.totalAlumnos > 0 && (
          <div className="flex items-center gap-2 text-2xs font-medium text-text-muted">
            <span className="h-1 w-16 shrink-0 rounded-full overflow-hidden bg-ov/[0.08]" aria-hidden="true">
              <span className="block h-full rounded-full bg-teal" style={{ width: `${(estado.adminCount / estado.totalAlumnos) * 100}%` }} />
            </span>
            {estado.adminCount} de {estado.totalAlumnos} alumnos la han completado
          </div>
        )}
      </div>

      {/* Casilla de completada */}
      {estado && (
        <div className="shrink-0 flex items-center pr-2 sm:pr-3">
          <button
            onClick={estado.onToggle}
            disabled={estado.toggling}
            role="checkbox"
            aria-checked={estado.completada}
            aria-label={estado.completada ? 'Marcar como pendiente' : 'Marcar como completada'}
            className={cn('w-11 h-11 flex items-center justify-center rounded-xl group', FOCO)}
          >
            <span
              className={cn(
                'w-6 h-6 flex items-center justify-center rounded-md border-2 transition-colors',
                estado.completada ? 'bg-teal border-teal text-white' : 'border-ov/25 group-hover:border-teal',
              )}
            >
              {estado.toggling ? <Spinner size="sm" className="!w-3 !h-3" />
                : estado.completada ? <Check size={14} strokeWidth={3} aria-hidden="true" /> : null}
            </span>
          </button>
        </div>
      )}
    </div>
  )
}
