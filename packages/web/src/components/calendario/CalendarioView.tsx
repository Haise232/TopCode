import { useState, type MutableRefObject } from 'react'
import { CalendarDays, ChevronDown, ChevronUp, Plus, RefreshCw, Zap } from 'lucide-react'
import type { EventoCalendario, TipoEvento } from '@topcode/shared'
import { useTheme } from '../../contexts/ThemeContext'
import { Copo } from '../Navidad'
import { Button } from '../ui'
import { cn } from '../ui/cn'
import { Seccion } from '../ui/Seccion'
import { FOCO, SUPERFICIE, mez } from '../ui/estilos'
import { Buscador, FiltroEstadoSwitch, FiltroTipos, VistaSwitch } from './Filtros'
import MiniCalendario from './MiniCalendario'
import TarjetaEvento from './TarjetaEvento'
import type { EstadoActividad, FiltroEstado, Vista } from './tipos'

export interface CalendarioViewProps {
  vista: Vista
  onCambiarVista: (v: Vista) => void
  /** Eventos de la vista actual, sin filtrar (para el mini calendario y los estados vacíos). */
  eventos: EventoCalendario[]
  /** Próximos y pasados ya filtrados por búsqueda, tipo y estado. */
  upcoming: EventoCalendario[]
  past: EventoCalendario[]
  todayCount: number
  weekCount: number

  canManage: boolean
  claseUsuario: string | null | undefined
  onNuevo: () => void
  onEditar: (ev: EventoCalendario) => void
  onEliminar: (ev: EventoCalendario) => void
  estadoDe: (ev: EventoCalendario) => EstadoActividad | undefined

  refreshing: boolean
  onRefresh: () => void

  searchQuery: string
  onSearch: (v: string) => void
  categoriaFilter: 'todas' | TipoEvento
  onCategoria: (v: 'todas' | TipoEvento) => void
  filtroEstado: FiltroEstado
  onFiltroEstado: (v: FiltroEstado) => void
  totalHechas: number
  totalPendientes: number
  pct: number

  pastExpanded: boolean
  onTogglePast: () => void

  diaHighlight: string | null
  onDiaClick: (fecha: string) => void
  viewYear: number
  viewMonth: number
  onPrevMonth: () => void
  onNextMonth: () => void
  onHoy: () => void
  eventRefs: MutableRefObject<Record<string, HTMLDivElement | null>>
}

function Vacio({ Icon, titulo, mensaje, accion, compacto }: {
  Icon: typeof CalendarDays; titulo?: string; mensaje: string; accion?: React.ReactNode; compacto?: boolean
}) {
  return (
    <div className={cn(SUPERFICIE, 'flex flex-col items-center gap-3 text-center px-6', compacto ? 'py-8' : 'py-14')}>
      <span className={cn('flex items-center justify-center rounded-full bg-gold/15 text-gold-light', compacto ? 'w-11 h-11' : 'w-14 h-14')}>
        <Icon size={compacto ? 20 : 26} aria-hidden="true" />
      </span>
      <div className="flex flex-col gap-1.5">
        {titulo && <p className="font-bold text-lg text-text-primary">{titulo}</p>}
        <p className="text-sm leading-relaxed max-w-xs text-text-muted">{mensaje}</p>
      </div>
      {accion}
    </div>
  )
}

function Progreso({ hechas, total, pct }: { hechas: number; total: number; pct: number }) {
  return (
    <div className={cn(SUPERFICIE, 'px-4 py-3.5 flex items-center gap-4')}>
      <span className="text-2xl font-black tabular-nums leading-none text-text-primary w-[3.2rem] shrink-0">{pct}%</span>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline gap-2 mb-1.5">
          <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">Tu progreso</span>
          <span className="text-xs text-text-muted">{hechas} de {total} completadas</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden bg-ov/[0.08]"
          role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Progreso de actividades">
          <div className="h-full rounded-full bg-teal motion-safe:transition-[width] motion-safe:duration-700" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  )
}

function diasHasta(fecha: string) {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  return Math.round((new Date(fecha + 'T00:00:00').getTime() - hoy.getTime()) / 86400000)
}

export default function CalendarioView(p: CalendarioViewProps) {
  const { navidad } = useTheme()
  const [calAbierto, setCalAbierto] = useState(false)
  const esActividades = p.vista === 'actividades'
  const hayFiltros = !!p.searchQuery || p.categoriaFilter !== 'todas' || p.filtroEstado !== 'todas'

  const secciones = [
    { id: 'hoy', titulo: 'Hoy', eventos: p.upcoming.filter(e => diasHasta(e.fecha) === 0) },
    { id: 'semana', titulo: 'Esta semana', eventos: p.upcoming.filter(e => { const d = diasHasta(e.fecha); return d >= 1 && d < 7 }) },
    { id: 'despues', titulo: 'Más adelante', eventos: p.upcoming.filter(e => diasHasta(e.fecha) >= 7) },
  ].filter(s => s.eventos.length > 0)

  function tarjeta(ev: EventoCalendario, idx: number, past?: boolean) {
    return (
      <div key={ev.id} ref={el => { p.eventRefs.current[ev.id] = el }}
        className="motion-safe:animate-slide-up" style={{ animationDelay: `${Math.min(idx, 8) * 35}ms` }}>
        <TarjetaEvento
          evento={ev}
          puedeGestionar={p.canManage && ev.clase === p.claseUsuario}
          onEdit={() => p.onEditar(ev)}
          onDelete={() => p.onEliminar(ev)}
          past={past}
          highlight={p.diaHighlight === ev.fecha}
          estado={p.estadoDe(ev)}
        />
      </div>
    )
  }

  const botonNuevo = p.canManage && (
    <Button onClick={p.onNuevo} icon={<Plus size={16} aria-hidden="true" />} className={cn('shrink-0', FOCO)}>
      {esActividades ? 'Nueva actividad' : 'Nuevo evento'}
    </Button>
  )

  return (
    <div className="motion-safe:animate-fade-in h-full overflow-y-auto">
      <div className="max-w-[1100px] mx-auto px-4 md:px-6 pt-6 pb-10 flex flex-col gap-6">

        {/* ── Cabecera ─────────────────────────────────────────────────── */}
        <header className="flex justify-between items-start gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="font-extrabold text-3xl md:text-4xl tracking-tight text-text-primary">Calendario</h1>
              {navidad && <Copo size={18} className="text-gold-light" />}
            </div>
            <div className="mt-2 flex items-center gap-x-3 gap-y-1.5 flex-wrap text-xs text-text-muted">
              {p.todayCount > 0 && (
                <span className="inline-flex items-center gap-1 font-bold px-2.5 py-1 rounded-full text-2xs tracking-wide"
                  style={{ background: mez('var(--color-rose)', 14), color: 'color-mix(in srgb, var(--color-rose), black var(--oscurecer))' }}>
                  <Zap size={10} aria-hidden="true" />{p.todayCount} hoy
                </span>
              )}
              <span><b className="font-bold text-text-primary tabular-nums">{p.weekCount}</b> esta semana</span>
              <span><b className="font-bold text-text-primary tabular-nums">{p.upcoming.length}</b> próximos</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={p.onRefresh} disabled={p.refreshing} aria-label="Actualizar"
              className={cn('w-10 h-10 flex items-center justify-center rounded-xl transition-colors hover:bg-ov/5 bg-ov/[0.03] text-text-secondary', FOCO)}>
              <RefreshCw size={15} className={p.refreshing ? 'animate-spin' : ''} aria-hidden="true" />
            </button>
            {botonNuevo}
          </div>
        </header>

        <VistaSwitch value={p.vista} onChange={p.onCambiarVista} />

        {p.eventos.length === 0 ? (
          <Vacio
            Icon={CalendarDays}
            titulo={esActividades ? 'Sin actividades todavía' : 'Sin exámenes programados'}
            mensaje={p.canManage
              ? 'Añade el primer evento para que tu clase esté al tanto de lo que se viene.'
              : 'Todavía no hay eventos en el calendario. Vuelve pronto para estar al día.'}
            accion={p.canManage && (
              <Button onClick={p.onNuevo} icon={<Plus size={16} aria-hidden="true" />} className="mt-1 px-5">
                {esActividades ? 'Crear primera actividad' : 'Crear primer evento'}
              </Button>
            )}
          />
        ) : (
          <>
            {esActividades && <Progreso hechas={p.totalHechas} total={p.eventos.length} pct={p.pct} />}

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">

              {/* ── Calendario del mes: plegable en móvil, fijo a la derecha en escritorio ── */}
              <aside className="flex flex-col gap-3 lg:col-start-2 lg:row-start-1 lg:sticky lg:top-6">
                <button
                  onClick={() => setCalAbierto(a => !a)}
                  aria-expanded={calAbierto}
                  aria-controls="mini-calendario"
                  className={cn(SUPERFICIE, 'lg:hidden flex items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-text-primary', FOCO)}
                >
                  <span className="flex items-center gap-2"><CalendarDays size={16} className="text-text-muted" aria-hidden="true" />Calendario del mes</span>
                  {calAbierto ? <ChevronUp size={16} aria-hidden="true" className="text-text-muted" /> : <ChevronDown size={16} aria-hidden="true" className="text-text-muted" />}
                </button>
                <div id="mini-calendario" className={cn(!calAbierto && 'hidden', 'lg:block')}>
                  <MiniCalendario
                    eventos={p.eventos}
                    onDiaClick={p.onDiaClick}
                    diaHighlight={p.diaHighlight}
                    viewYear={p.viewYear}
                    viewMonth={p.viewMonth}
                    onPrevMonth={p.onPrevMonth}
                    onNextMonth={p.onNextMonth}
                    onHoy={p.onHoy}
                  />
                </div>
              </aside>

              {/* ── Listado ── */}
              <div className="flex flex-col gap-6 min-w-0 lg:col-start-1 lg:row-start-1">
                <div className="flex flex-col gap-3">
                  <Buscador value={p.searchQuery} onChange={p.onSearch} />
                  {esActividades && (
                    <FiltroEstadoSwitch
                      value={p.filtroEstado}
                      onChange={p.onFiltroEstado}
                      cuentas={{ todas: p.eventos.length, pendientes: p.totalPendientes, hechas: p.totalHechas }}
                    />
                  )}
                  <FiltroTipos value={p.categoriaFilter} onChange={p.onCategoria} actividades={esActividades} />
                  {hayFiltros && (
                    <button
                      onClick={() => { p.onSearch(''); p.onCategoria('todas'); p.onFiltroEstado('todas') }}
                      className={cn('w-fit rounded-md text-xs font-semibold text-primary-light hover:underline underline-offset-4', FOCO)}
                    >
                      Limpiar filtros
                    </button>
                  )}
                </div>

                {secciones.length === 0 ? (
                  <Vacio compacto Icon={CalendarDays} mensaje="No hay eventos próximos que coincidan con los filtros aplicados." />
                ) : (
                  secciones.map(s => (
                    <Seccion key={s.id} titulo={s.titulo}
                      extra={<span className="text-xs font-semibold tabular-nums text-text-muted">{s.eventos.length}</span>}>
                      <div className="flex flex-col gap-2.5">{s.eventos.map((ev, i) => tarjeta(ev, i))}</div>
                    </Seccion>
                  ))
                )}

                <Seccion titulo="Pasados"
                  extra={
                    <button onClick={p.onTogglePast} aria-expanded={p.pastExpanded}
                      className={cn('inline-flex items-center gap-1 rounded-md text-xs font-semibold text-primary-light hover:underline underline-offset-4', FOCO)}>
                      {p.pastExpanded ? <ChevronUp size={13} aria-hidden="true" /> : <ChevronDown size={13} aria-hidden="true" />}
                      {p.pastExpanded ? 'Ocultar' : `Ver ${p.past.length}`}
                    </button>
                  }>
                  {p.pastExpanded && (
                    p.past.length === 0 ? (
                      <Vacio compacto Icon={CalendarDays} mensaje="No hay eventos pasados que coincidan con los filtros aplicados." />
                    ) : (
                      <div className="flex flex-col gap-2.5">{p.past.map((ev, i) => tarjeta(ev, i, true))}</div>
                    )
                  )}
                </Seccion>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
