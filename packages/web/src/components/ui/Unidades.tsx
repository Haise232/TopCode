import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Folder, Layers } from 'lucide-react'
import { tinta } from '../../lib/tinta'
import { cn } from './cn'
import { FOCO, SUPERFICIE_PULSABLE, materiaColor, mez } from './estilos'

/** Unidades de trabajo que se ofrecen en los selectores. */
export const UTS = Array.from({ length: 15 }, (_, i) => i + 1)

export function utLabel(ut: number | null | undefined) {
  return ut == null ? 'Sin UT' : `UT ${ut}`
}

/** Agrupa por UT en orden ascendente; lo que no tiene UT va al final. */
export function agruparPorUt<T>(items: T[], getUt: (item: T) => number | null | undefined): [number | null, T[]][] {
  const mapa = new Map<number | null, T[]>()
  for (const it of items) {
    const ut = getUt(it) ?? null
    if (!mapa.has(ut)) mapa.set(ut, [])
    mapa.get(ut)!.push(it)
  }
  return [...mapa.entries()].sort(([a], [b]) => (a ?? 999) - (b ?? 999))
}

/** Selector de UT para formularios. Valor '' = sin UT. */
export function UtSelect({ id, value, onChange, className }: {
  id: string; value: number | null; onChange: (ut: number | null) => void; className: string
}) {
  return (
    <select id={id} value={value ?? ''} onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
      className={cn(className, value == null && 'text-text-muted')}>
      <option value="">Sin UT</option>
      {UTS.map(n => <option key={n} value={n}>UT {n}</option>)}
    </select>
  )
}

/** Carpeta de asignatura (primer nivel de Apuntes y Documentación). */
export function CarpetaAsignatura({ nombre, colorKey, total, uts, unidad, onClick }: {
  nombre: string
  colorKey: string
  total: number
  uts: number
  /** Nombre de lo que se cuenta: ['archivo', 'archivos'] */
  unidad: [string, string]
  onClick: () => void
}) {
  const color = materiaColor(colorKey)
  const vacia = total === 0
  return (
    <button onClick={onClick}
      className={cn(SUPERFICIE_PULSABLE, 'group text-left flex items-center gap-3 p-4', vacia && 'opacity-60 hover:opacity-100')}>
      <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: mez(color, 16), color: tinta(color) }}>
        <Folder size={20} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 flex flex-col gap-0.5">
        <span className="font-bold leading-snug text-text-primary truncate">{nombre}</span>
        <span className="text-xs text-text-muted">
          {vacia ? 'Vacía' : (
            <>
              <b className="tabular-nums font-semibold text-text-secondary">{total}</b> {total === 1 ? unidad[0] : unidad[1]}
              {uts > 0 && <> · <span className="tabular-nums">{uts}</span> {uts === 1 ? 'UT' : 'UTs'}</>}
            </>
          )}
        </span>
      </span>
      <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-text-muted transition-transform motion-safe:group-hover:translate-x-0.5" />
    </button>
  )
}

/** Cabecera de una UT dentro de una asignatura. */
export function CabeceraUt({ ut, cuenta, children }: { ut: number | null; cuenta: number; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 min-w-0" aria-label={utLabel(ut)}>
      <div className="flex items-center gap-2.5">
        <span className={cn('inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg',
          ut == null ? 'bg-ov/[0.06] text-text-muted' : 'bg-primary/[0.12] text-primary-light')}>
          <Layers size={12} aria-hidden="true" />
          {utLabel(ut)}
        </span>
        <span className="h-px flex-1 bg-ov/[0.08]" aria-hidden="true" />
        <span className="text-xs font-semibold tabular-nums text-text-muted">{cuenta}</span>
      </div>
      {children}
    </section>
  )
}

/** Enlace «← Asignaturas» para volver al primer nivel. */
export function VolverAsignaturas({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={cn('self-start -ml-1 flex items-center gap-1 rounded-md px-1 text-xs font-semibold text-text-muted hover:text-text-primary transition-colors', FOCO)}>
      <ChevronLeft size={14} aria-hidden="true" /> Asignaturas
    </button>
  )
}
