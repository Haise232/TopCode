import { useRef } from 'react'
import { BookOpen, ClipboardCheck, Search, X, type LucideIcon } from 'lucide-react'
import { TIPOS_ACTIVIDAD, TIPOS_EVENTO, type TipoEvento } from '@topcode/shared'
import { TIPO_EVENTO_CONFIG } from '../../lib/tiposEvento'
import { cn } from '../ui/cn'
import { FOCO } from '../ui/estilos'
import type { FiltroEstado, Vista } from './tipos'

const VISTAS: { id: Vista; label: string; Icon: LucideIcon }[] = [
  { id: 'examenes', label: 'Exámenes', Icon: BookOpen },
  { id: 'actividades', label: 'Actividades', Icon: ClipboardCheck },
]

/** Selector segmentado con la misma forma que el de claro/oscuro de Inicio. */
export function VistaSwitch({ value, onChange }: { value: Vista; onChange: (v: Vista) => void }) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})
  function onKeyDown(e: React.KeyboardEvent, idx: number) {
    let next = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % VISTAS.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (idx - 1 + VISTAS.length) % VISTAS.length
    if (next < 0) return
    e.preventDefault()
    onChange(VISTAS[next].id)
    refs.current[VISTAS[next].id]?.focus()
  }
  return (
    <div role="tablist" aria-label="Tipo de calendario"
      className="grid grid-cols-2 gap-0.5 p-0.5 rounded-xl w-full sm:w-fit bg-ov/[0.06] border border-ov/[0.08]">
      {VISTAS.map(({ id, label, Icon }, idx) => {
        const active = value === id
        return (
          <button key={id} type="button" role="tab" aria-selected={active} tabIndex={active ? 0 : -1}
            ref={el => { refs.current[id] = el }}
            onClick={() => onChange(id)} onKeyDown={e => onKeyDown(e, idx)}
            className={cn(
              'flex items-center justify-center gap-2 px-5 py-2 rounded-[10px] text-sm font-semibold transition-colors duration-200',
              FOCO,
              active ? 'bg-surface text-text-primary shadow-card' : 'text-text-muted hover:text-text-secondary',
            )}>
            <Icon size={15} aria-hidden="true" className={active ? 'text-primary-light' : undefined} />
            {label}
          </button>
        )
      })}
    </div>
  )
}

export function Buscador({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative w-full">
      <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" aria-hidden="true" />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Buscar eventos..."
        aria-label="Buscar eventos"
        className="bg-input border border-ov/[0.08] rounded-xl pl-10 pr-10 py-2.5 text-text-primary text-sm placeholder:text-text-muted w-full outline-none transition-[border-color,box-shadow] duration-200 focus:border-primary/50 focus:shadow-[0_0_0_3px_rgb(var(--c-primary)/0.12)]"
      />
      {value && (
        <button onClick={() => onChange('')} aria-label="Borrar búsqueda"
          className={cn('absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary', FOCO)}>
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

const CHIP = 'inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border whitespace-nowrap transition-colors duration-150'

/** Filtro por tipo de evento (chips con desplazamiento horizontal en móvil). */
export function FiltroTipos({
  value, onChange, actividades,
}: { value: 'todas' | TipoEvento; onChange: (v: 'todas' | TipoEvento) => void; actividades: boolean }) {
  return (
    <div role="group" aria-label="Filtrar por tipo"
      className="flex gap-2 overflow-x-auto sm:flex-wrap sm:overflow-visible -mx-4 px-4 sm:mx-0 sm:px-0 pb-1 sm:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <button onClick={() => onChange('todas')} aria-pressed={value === 'todas'}
        className={cn(CHIP, FOCO, value === 'todas'
          ? 'bg-text-primary text-bg border-transparent'
          : 'bg-surface border-ov/[0.1] text-text-secondary hover:bg-ov/[0.04]')}>
        Todos
      </button>
      {TIPOS_EVENTO.filter(t => TIPOS_ACTIVIDAD.includes(t.id) === actividades).map(({ id }) => {
        const cfg = TIPO_EVENTO_CONFIG[id]
        const active = value === id
        return (
          <button key={id} onClick={() => onChange(active ? 'todas' : id)} aria-pressed={active}
            className={cn(CHIP, FOCO, !active && 'bg-surface border-ov/[0.1] text-text-secondary hover:bg-ov/[0.04]')}
            style={active ? { background: cfg.bg, color: cfg.texto, borderColor: cfg.border } : undefined}>
            <cfg.Icon size={12} aria-hidden="true" style={{ color: cfg.texto }} />
            {cfg.label}
          </button>
        )
      })}
    </div>
  )
}

/** Filtro por estado (solo en la vista de actividades). */
export function FiltroEstadoSwitch({
  value, onChange, cuentas,
}: { value: FiltroEstado; onChange: (v: FiltroEstado) => void; cuentas: Record<FiltroEstado, number> }) {
  const opciones: { key: FiltroEstado; label: string }[] = [
    { key: 'todas', label: 'Todas' },
    { key: 'pendientes', label: 'Pendientes' },
    { key: 'hechas', label: 'Hechas' },
  ]
  return (
    <div role="group" aria-label="Filtrar por estado"
      className="grid grid-cols-3 gap-0.5 p-0.5 rounded-xl bg-ov/[0.06] border border-ov/[0.08] w-full sm:w-fit">
      {opciones.map(({ key, label }) => {
        const active = value === key
        return (
          <button key={key} onClick={() => onChange(key)} aria-pressed={active}
            className={cn(
              'flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-[10px] text-xs font-semibold transition-colors duration-200',
              FOCO,
              active ? 'bg-surface text-text-primary shadow-card' : 'text-text-muted hover:text-text-secondary',
            )}>
            {label}
            <span className={cn('tabular-nums text-2xs font-bold', active ? 'text-text-secondary' : 'text-text-faint')}>{cuentas[key]}</span>
          </button>
        )
      })}
    </div>
  )
}
