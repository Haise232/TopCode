import { useMemo, useState } from 'react'
import { CloudUpload, Inbox, LayoutGrid, LayoutList, RefreshCw, Search, SearchX, Upload, X } from 'lucide-react'
import { MATERIAS } from '@topcode/shared'
import type { ApunteConAutor } from '../../hooks/useApuntes'
import { useTheme } from '../../contexts/ThemeContext'
import { tinta } from '../../lib/tinta'
import { Copo } from '../Navidad'
import { Spinner } from '../ui'
import { cn } from '../ui/cn'
import { Seccion } from '../ui/Seccion'
import { FOCO, SUPERFICIE } from '../ui/estilos'
import { SkeletonBox } from '../Skeleton'
import { FilaApunte, TarjetaApunte } from './TarjetaApunte'
import { VistaPrevia } from './Dialogos'
import { TIPO_CONFIG, type FiltroTipo, type TipoApunte } from './tipos'
import { CabeceraUt, CarpetaAsignatura, VolverAsignaturas, agruparPorUt } from '../ui/Unidades'

/** Valor de `asignatura` para los apuntes sin asignatura. */
export const SIN_ASIGNATURA = '__sin'

const ACCEPT = '.pdf,image/*,.doc,.docx,.txt,.pptx,.xlsx'
const CHIP = 'inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border whitespace-nowrap transition-colors duration-150'

export interface ApuntesViewProps {
  usuarioId: string | undefined
  claseUsuario: string | null | undefined
  canManage: boolean
  apuntes: ApunteConAutor[]
  subiendo: boolean
  refreshing: boolean
  /** Asignatura abierta (nombre corto o SIN_ASIGNATURA); null = lista de asignaturas. */
  asignatura: string | null
  onAsignatura: (a: string | null) => void
  onRefresh: () => void
  /** Archivo elegido (input o arrastrado): la página valida y abre el diálogo. */
  onArchivo: (file: File) => void
  onEliminar: (ap: ApunteConAutor) => void
  onMover: (ap: ApunteConAutor) => void
}

function Vacio({ Icon, titulo, mensaje, accion, compacto }: {
  Icon: typeof Inbox; titulo: string; mensaje?: string; accion?: React.ReactNode; compacto?: boolean
}) {
  return (
    <div className={cn(SUPERFICIE, 'flex flex-col items-center gap-3 text-center px-6', compacto ? 'py-8' : 'py-14')}>
      <span className={cn('flex items-center justify-center rounded-full bg-gold/15 text-gold-light', compacto ? 'w-11 h-11' : 'w-14 h-14')}>
        <Icon size={compacto ? 20 : 26} aria-hidden="true" />
      </span>
      <div className="flex flex-col gap-1.5">
        <p className={cn('font-bold text-text-primary', compacto ? 'text-base' : 'text-lg')}>{titulo}</p>
        {mensaje && <p className="text-sm leading-relaxed max-w-xs text-text-muted">{mensaje}</p>}
      </div>
      {accion}
    </div>
  )
}

export function ApuntesEsqueleto() {
  return (
    <div className="h-full overflow-y-auto" aria-hidden="true">
      <div className="max-w-[1100px] mx-auto px-4 md:px-6 pt-6 pb-10 flex flex-col gap-6 motion-safe:animate-fade-in">
        <div className="flex justify-between items-start gap-4">
          <div className="flex flex-col gap-3">
            <SkeletonBox className="h-9 w-44 shimmer" />
            <SkeletonBox className="h-3 w-56 shimmer" />
          </div>
          <SkeletonBox className="h-10 w-36 shimmer rounded-xl" />
        </div>
        <SkeletonBox className="h-11 w-full shimmer rounded-xl" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3].map(i => <div key={i} className="h-[148px] rounded-2xl shimmer border border-ov/[0.07]" />)}
        </div>
      </div>
    </div>
  )
}

export default function ApuntesView(p: ApuntesViewProps) {
  const { navidad } = useTheme()
  const [busqueda, setBusqueda] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todos')
  const [vistaLista, setVistaLista] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [previewApunte, setPreviewApunte] = useState<ApunteConAutor | null>(null)

  const { apuntes } = p
  const cuenta = useMemo(() => {
    const base = p.asignatura === null ? apuntes : apuntes.filter(a => (a.materia ?? SIN_ASIGNATURA) === p.asignatura)
    return {
      todos: base.length,
      pdf: base.filter(a => a.tipo === 'pdf').length,
      imagen: base.filter(a => a.tipo === 'imagen').length,
      otro: base.filter(a => a.tipo === 'otro').length,
    }
  }, [apuntes, p.asignatura])
  const asignaturas = useMemo(() => {
    const cuentas = new Map<string, ApunteConAutor[]>()
    for (const m of MATERIAS) cuentas.set(m.nombreCorto, [])
    for (const a of apuntes) {
      const k = a.materia ?? SIN_ASIGNATURA
      if (!cuentas.has(k)) cuentas.set(k, [])
      cuentas.get(k)!.push(a)
    }
    return [...cuentas.entries()]
      .map(([clave, lista]) => ({
        clave,
        nombre: clave === SIN_ASIGNATURA ? 'Sin asignatura' : clave,
        total: lista.length,
        uts: new Set(lista.filter(a => a.ut != null).map(a => a.ut)).size,
      }))
      // Primero las que tienen apuntes; «Sin asignatura» siempre al final.
      .sort((x, y) => Number(x.clave === SIN_ASIGNATURA) - Number(y.clave === SIN_ASIGNATURA)
        || Number(y.total > 0) - Number(x.total > 0) || x.nombre.localeCompare(y.nombre, 'es'))
  }, [apuntes])

  const enAsignatura = p.asignatura !== null
  const nombreAsignatura = p.asignatura === SIN_ASIGNATURA ? 'Sin asignatura' : p.asignatura
  const buscando = busqueda.trim() !== ''

  const filtrados = useMemo(() => apuntes.filter(a => {
    const okA = !enAsignatura || (a.materia ?? SIN_ASIGNATURA) === p.asignatura
    const okB = !buscando || a.nombre.toLowerCase().includes(busqueda.trim().toLowerCase())
    const okT = filtroTipo === 'todos' || a.tipo === filtroTipo
    return okA && okB && okT
  }), [apuntes, enAsignatura, p.asignatura, buscando, busqueda, filtroTipo])

  const porUt = useMemo(
    () => agruparPorUt([...filtrados].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true })), a => a.ut),
    [filtrados],
  )

  const hayFiltros = buscando || filtroTipo !== 'todos'
  const limpiar = () => { setBusqueda(''); setFiltroTipo('todos') }

  function onInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    p.onArchivo(file)
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) p.onArchivo(file)
  }
  const dragProps = {
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); setDragOver(true) },
    onDragLeave: (e: React.DragEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(false) },
    onDrop,
  }

  function lista(archivos: ApunteConAutor[], mostrarUbicacion = false) {
    const gestiona = (ap: ApunteConAutor) => p.canManage && ap.clase === p.claseUsuario
    const props = (ap: ApunteConAutor) => ({
      ap, mostrarUbicacion,
      canDelete: gestiona(ap),
      onDelete: () => p.onEliminar(ap),
      onMover: gestiona(ap) ? () => p.onMover(ap) : undefined,
      onPreview: () => setPreviewApunte(ap),
    })
    return vistaLista ? (
      <div className="flex flex-col gap-2">{archivos.map(ap => <FilaApunte key={ap.id} {...props(ap)} />)}</div>
    ) : (
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{archivos.map(ap => <TarjetaApunte key={ap.id} {...props(ap)} />)}</div>
    )
  }

  const FILTROS: { key: FiltroTipo; label: string }[] = [
    { key: 'todos', label: 'Todos' }, { key: 'pdf', label: 'PDF' }, { key: 'imagen', label: 'Imagen' }, { key: 'otro', label: 'Otro' },
  ]

  return (
    <div className="motion-safe:animate-fade-in h-full overflow-y-auto relative"
      {...(p.canManage ? dragProps : {})}>
      {p.canManage && dragOver && (
        <div className="pointer-events-none fixed inset-3 z-40 flex items-center justify-center rounded-2xl border-2 border-dashed border-primary/60 bg-bg/80">
          <p className="flex items-center gap-2 font-bold text-lg text-text-primary"><CloudUpload size={22} aria-hidden="true" /> Suelta para subir</p>
        </div>
      )}

      <div className="max-w-[1100px] mx-auto px-4 md:px-6 pt-6 pb-10 flex flex-col gap-6">

        {/* ── Cabecera ── */}
        <header className="flex justify-between items-start gap-4">
          <div className="min-w-0 flex flex-col">
            {enAsignatura && <VolverAsignaturas onClick={() => { limpiar(); p.onAsignatura(null) }} />}
            <div className="flex items-center gap-2.5 min-w-0">
              <h1 className="font-extrabold text-3xl md:text-4xl tracking-tight text-text-primary truncate">{enAsignatura ? nombreAsignatura : 'Apuntes'}</h1>
              {navidad && <Copo size={18} className="text-gold-light shrink-0" />}
            </div>
            <div className="mt-2 flex items-center gap-x-3 gap-y-1 flex-wrap text-xs text-text-muted">
              <span><b className="font-bold text-text-primary tabular-nums">{cuenta.todos}</b> archivo{cuenta.todos !== 1 ? 's' : ''}</span>
              {enAsignatura
                ? <span><b className="font-bold text-text-primary tabular-nums">{porUt.filter(([ut]) => ut != null).length}</b> UT</span>
                : <span><b className="font-bold text-text-primary tabular-nums">{asignaturas.filter(a => a.total > 0).length}</b> asignaturas con apuntes</span>}
              {cuenta.pdf > 0 && <span style={{ color: tinta(TIPO_CONFIG.pdf.color) }} className="font-semibold">{cuenta.pdf} PDF</span>}
              {cuenta.imagen > 0 && <span style={{ color: tinta(TIPO_CONFIG.imagen.color) }} className="font-semibold">{cuenta.imagen} img</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={p.onRefresh} disabled={p.refreshing} aria-label="Actualizar"
              className={cn('w-10 h-10 flex items-center justify-center rounded-xl transition-colors hover:bg-ov/5 bg-ov/[0.03] text-text-secondary', FOCO)}>
              <RefreshCw size={15} className={p.refreshing ? 'animate-spin' : ''} aria-hidden="true" />
            </button>
            {p.canManage && (
              <label className={cn(
                'bg-gradient-to-br from-primary to-primary-dark text-white font-semibold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-all duration-200 shadow-primary px-4 py-2.5 text-sm cursor-pointer focus-within:ring-2 focus-within:ring-primary/60 focus-within:ring-offset-2 focus-within:ring-offset-bg',
                p.subiendo && 'opacity-60 pointer-events-none',
              )}>
                {p.subiendo ? <Spinner size="sm" className="text-white" /> : <Upload size={16} aria-hidden="true" />}
                <span className="hidden sm:inline">{p.subiendo ? 'Subiendo...' : 'Subir archivo'}</span>
                <span className="sm:hidden">{p.subiendo ? 'Subiendo' : 'Subir'}</span>
                <input type="file" accept={ACCEPT} onChange={onInput} className="sr-only" disabled={p.subiendo} />
              </label>
            )}
          </div>
        </header>

        {/* ── Búsqueda y filtros ── */}
        {apuntes.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex gap-3">
              <div className="relative flex-1 min-w-0">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" aria-hidden="true" />
                <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
                  placeholder={enAsignatura ? `Buscar en ${nombreAsignatura}…` : 'Buscar en todos los apuntes…'} aria-label="Buscar archivos"
                  className="bg-input border border-ov/[0.08] rounded-xl pl-10 pr-10 py-2.5 text-text-primary text-sm placeholder:text-text-muted w-full outline-none transition-[border-color,box-shadow] duration-200 focus:border-primary/50 focus:shadow-[0_0_0_3px_rgb(var(--c-primary)/0.12)]" />
                {busqueda && (
                  <button onClick={() => setBusqueda('')} aria-label="Borrar búsqueda"
                    className={cn('absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary', FOCO)}>
                    <X size={14} aria-hidden="true" />
                  </button>
                )}
              </div>
              <div role="group" aria-label="Vista" className="grid grid-cols-2 gap-0.5 p-0.5 rounded-xl bg-ov/[0.06] border border-ov/[0.08] shrink-0">
                {([[false, LayoutGrid, 'Vista en cuadrícula'], [true, LayoutList, 'Vista en lista']] as const).map(([lista, Icon, label]) => (
                  <button key={label} onClick={() => setVistaLista(lista)} aria-pressed={vistaLista === lista} aria-label={label} title={label}
                    className={cn('w-9 flex items-center justify-center rounded-[10px] transition-colors duration-200', FOCO,
                      vistaLista === lista ? 'bg-surface text-text-primary shadow-card' : 'text-text-muted hover:text-text-secondary')}>
                    <Icon size={16} aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto sm:flex-wrap sm:overflow-visible -mx-4 px-4 sm:mx-0 sm:px-0 pb-1 sm:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {(enAsignatura || buscando) && <div role="group" aria-label="Filtrar por tipo" className="flex items-center gap-2">
                {FILTROS.map(f => {
                  const activo = filtroTipo === f.key
                  const color = f.key === 'todos' ? null : TIPO_CONFIG[f.key as TipoApunte].color
                  return (
                    <button key={f.key} onClick={() => setFiltroTipo(f.key)} aria-pressed={activo}
                      className={cn(CHIP, FOCO, activo
                        ? (color ? 'border-transparent' : 'bg-text-primary text-bg border-transparent')
                        : 'bg-surface border-ov/[0.1] text-text-secondary hover:bg-ov/[0.04]')}
                      style={activo && color ? { background: `color-mix(in srgb, ${color} 16%, transparent)`, color: tinta(color) } : undefined}>
                      {f.label}
                      <span className="tabular-nums text-2xs font-bold opacity-70">{cuenta[f.key]}</span>
                    </button>
                  )
                })}
              </div>}
              {hayFiltros && (
                <button onClick={limpiar} className={cn('shrink-0 rounded-md text-xs font-semibold text-primary-light hover:underline underline-offset-4 px-1', FOCO)}>
                  Limpiar filtros
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Contenido ── */}
        {apuntes.length === 0 ? (
          <label className="cursor-pointer block" {...dragProps}>
            <div className={cn('py-14 px-6 flex flex-col items-center gap-3 text-center rounded-2xl border-2 border-dashed transition-colors duration-200 focus-within:ring-2 focus-within:ring-primary/60',
              dragOver ? 'border-primary/60 bg-primary/[0.06]' : 'border-ov/[0.14] bg-surface hover:bg-ov/[0.02]')}>
              <span className="w-14 h-14 flex items-center justify-center rounded-full bg-gold/15 text-gold-light">
                <CloudUpload size={26} aria-hidden="true" />
              </span>
              <div className="flex flex-col gap-1.5">
                <p className="font-bold text-lg text-text-primary">{dragOver ? 'Suelta para subir' : 'Sin apuntes todavía'}</p>
                <p className="text-sm leading-relaxed max-w-xs text-text-muted">Arrastra un archivo aquí o pulsa para seleccionarlo.</p>
              </div>
              <span className="mt-1 text-sm font-semibold px-5 py-2.5 rounded-xl bg-ov/[0.06] text-text-primary">Seleccionar archivo</span>
            </div>
            <input type="file" accept={ACCEPT} onChange={onInput} className="sr-only" />
          </label>
        ) : !enAsignatura && !buscando ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {asignaturas.filter(a => a.clave !== SIN_ASIGNATURA || a.total > 0).map(a => (
              <CarpetaAsignatura key={a.clave} nombre={a.nombre} colorKey={a.clave} total={a.total} uts={a.uts}
                unidad={['archivo', 'archivos']} onClick={() => { limpiar(); p.onAsignatura(a.clave) }} />
            ))}
          </div>
        ) : filtrados.length === 0 ? (
          hayFiltros ? (
            <Vacio Icon={SearchX} titulo="Sin resultados"
              mensaje={buscando ? `No hay archivos para «${busqueda}».` : 'No hay archivos con ese filtro.'}
              accion={<button onClick={limpiar} className={cn('mt-1 text-sm font-semibold px-5 py-2.5 rounded-xl bg-ov/[0.06] text-text-primary hover:bg-ov/[0.09] transition-colors', FOCO)}>Limpiar filtros</button>} />
          ) : (
            <Vacio Icon={Inbox} titulo="Aún no hay apuntes de esta asignatura"
              mensaje={p.canManage ? 'Usa «Subir archivo» o arrastra un archivo aquí: se guardará en esta asignatura.' : 'Cuando se suba material aparecerá aquí.'} />
          )
        ) : !enAsignatura ? (
          <Seccion titulo="Resultados" extra={<span className="text-xs font-semibold tabular-nums text-text-muted">{filtrados.length}</span>}>
            {lista(filtrados, true)}
          </Seccion>
        ) : (
          <div className="flex flex-col gap-7">
            {porUt.map(([ut, archivos]) => (
              <CabeceraUt key={ut ?? 'sin'} ut={ut} cuenta={archivos.length}>
                {lista(archivos)}
              </CabeceraUt>
            ))}
          </div>
        )}
      </div>

      {previewApunte && <VistaPrevia apunte={previewApunte} onClose={() => setPreviewApunte(null)} />}
    </div>
  )
}
