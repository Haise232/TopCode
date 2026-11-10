import { useState } from 'react'
import { BookOpen, ChevronDown, ChevronUp, Plus, RefreshCw, Trash2, User } from 'lucide-react'
import type { Nota, UsuarioPublico } from '@topcode/shared'
import { useTheme } from '../../contexts/ThemeContext'
import { Copo } from '../Navidad'
import { Button } from '../ui'
import { cn } from '../ui/cn'
import { FOCO, SUPERFICIE } from '../ui/estilos'
import MediaBadge from './MediaBadge'
import { NIVEL_BARRA, NIVEL_TEXTO, groupByMateria, nivelNota, promedioMateria } from './nota'

export interface NotasViewProps {
  isAdmin: boolean
  targetId: string | undefined
  targetNombre?: string
  alumnos: UsuarioPublico[]
  selectedId: string | undefined
  onSelectAlumno: (id: string | undefined) => void
  notas: Nota[]
  loading: boolean
  refreshing: boolean
  onRefresh: () => void
  onAdd: () => void
  onDelete: (nota: Nota) => void
}

function Vacio({ Icon, titulo, mensaje }: { Icon: typeof BookOpen; titulo: string; mensaje: string }) {
  return (
    <div className={cn(SUPERFICIE, 'flex flex-col items-center gap-3 text-center px-6 py-14')}>
      <span className="w-14 h-14 flex items-center justify-center rounded-full bg-gold/15 text-gold-light">
        <Icon size={26} aria-hidden="true" />
      </span>
      <div className="flex flex-col gap-1.5">
        <p className="font-bold text-lg text-text-primary">{titulo}</p>
        <p className="text-sm leading-relaxed max-w-xs text-text-muted">{mensaje}</p>
      </div>
    </div>
  )
}

export function NotasEsqueleto() {
  return (
    <div className="flex flex-col gap-4 motion-safe:animate-fade-in" aria-hidden="true">
      <div className="rounded-2xl shimmer h-[132px] border border-ov/[0.07]" />
      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2, 3, 4].map(i => <div key={i} className="rounded-2xl shimmer h-[200px] border border-ov/[0.07]" />)}
      </div>
    </div>
  )
}

/** Media global destacada. */
function Resumen({ notas, nMaterias }: { notas: Nota[]; nMaterias: number }) {
  const { navidad } = useTheme()
  const media = notas.reduce((s, n) => s + n.media, 0) / notas.length
  const nivel = nivelNota(media, navidad)
  const aprobadas = notas.filter(n => n.media >= 5).length
  return (
    <div className={cn(SUPERFICIE, 'p-5 sm:p-6 flex items-center gap-5 sm:gap-8')}>
      <div className="shrink-0">
        <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">Media global</p>
        <p className={cn('mt-1 font-black tabular-nums leading-none text-5xl sm:text-6xl', NIVEL_TEXTO[nivel])}>
          {media.toFixed(2)}
        </p>
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-3">
        <div className="h-2 rounded-full overflow-hidden bg-ov/[0.08]"
          role="progressbar" aria-valuemin={0} aria-valuemax={10} aria-valuenow={Number(media.toFixed(2))} aria-label="Media global sobre 10">
          <div className={cn('h-full rounded-full motion-safe:transition-[width] motion-safe:duration-700', NIVEL_BARRA[nivel])}
            style={{ width: `${Math.min(100, media * 10)}%` }} />
        </div>
        <p className="text-xs text-text-muted leading-relaxed">
          <b className="font-bold text-text-primary tabular-nums">{nMaterias}</b> materia{nMaterias !== 1 ? 's' : ''}
          {' · '}
          <b className="font-bold text-text-primary tabular-nums">{notas.length}</b> tema{notas.length !== 1 ? 's' : ''}
          {' · '}
          <b className="font-bold text-text-primary tabular-nums">{aprobadas}</b> aprobado{aprobadas !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  )
}

function TarjetaMateria({ materia, notas, canDelete, onDelete }: {
  materia: string; notas: Nota[]; canDelete: boolean; onDelete: (n: Nota) => void
}) {
  const { navidad } = useTheme()
  const [abierta, setAbierta] = useState(true)
  const prom = promedioMateria(notas)
  const nivel = prom !== null ? nivelNota(prom, navidad) : 'bien'
  const idLista = `notas-${materia.replace(/\W+/g, '-')}`

  return (
    <section className={cn(SUPERFICIE, 'overflow-hidden break-inside-avoid md:mb-4')}>
      <button onClick={() => setAbierta(v => !v)} aria-expanded={abierta} aria-controls={idLista}
        className={cn('w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-ov/[0.03] rounded-2xl', FOCO)}>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-sm text-text-primary truncate">{materia}</h2>
          <p className="text-xs text-text-muted mt-0.5">{notas.length} tema{notas.length !== 1 ? 's' : ''}</p>
        </div>
        {prom !== null && (
          <div className="text-right shrink-0">
            <p className={cn('text-2xl font-black tabular-nums leading-none', NIVEL_TEXTO[nivel])}>{prom.toFixed(2)}</p>
            <p className="text-2xs font-semibold uppercase tracking-wide text-text-faint mt-1">Promedio</p>
          </div>
        )}
        {abierta
          ? <ChevronUp size={16} className="text-text-muted shrink-0" aria-hidden="true" />
          : <ChevronDown size={16} className="text-text-muted shrink-0" aria-hidden="true" />}
      </button>

      {abierta && (
        <div id={idLista} className="border-t border-ov/[0.07]">
          <div className="grid grid-cols-[minmax(0,1fr)_3.25rem_3.25rem_3.5rem] sm:grid-cols-[minmax(0,1fr)_4rem_4rem_4rem] gap-x-2 px-4 py-2 text-2xs font-bold uppercase tracking-wide text-text-muted bg-ov/[0.03]">
            <span>Tema</span>
            <span className="text-center">Teór.</span>
            <span className="text-center">Prác.</span>
            <span className="text-center">Media</span>
          </div>
          <ul>
            {notas.map(n => (
              <li key={n.id} className="group border-t border-ov/[0.05] first:border-t-0 flex items-center">
                <div className="flex-1 min-w-0 grid grid-cols-[minmax(0,1fr)_3.25rem_3.25rem_3.5rem] sm:grid-cols-[minmax(0,1fr)_4rem_4rem_4rem] gap-x-2 items-center px-4 py-2.5">
                  <span className="text-sm text-text-secondary leading-snug break-words">{n.tema}</span>
                  <span className="text-sm tabular-nums text-center text-text-secondary">{n.teorica.toFixed(2)}</span>
                  <span className="text-sm tabular-nums text-center text-text-secondary">{n.practica.toFixed(2)}</span>
                  <span className="text-center"><MediaBadge value={n.media} className="min-w-0 px-1.5 w-full" /></span>
                </div>
                {canDelete && (
                  <button onClick={() => onDelete(n)} aria-label={`Eliminar nota de ${n.tema}`}
                    className={cn('mr-2 w-9 h-9 shrink-0 flex items-center justify-center rounded-lg text-text-muted hover:text-rose-600 dark:hover:text-rose-300 hover:bg-rose-500/10 transition-colors', FOCO)}>
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

export default function NotasView(p: NotasViewProps) {
  const { navidad } = useTheme()
  const byMateria = groupByMateria(p.notas)
  const materias = Object.keys(byMateria).sort((a, b) => a.localeCompare(b))

  return (
    <div className="motion-safe:animate-fade-in h-full overflow-y-auto">
      <div className="max-w-[1000px] mx-auto px-4 md:px-6 pt-6 pb-10 flex flex-col gap-6">

        <header className="flex flex-col gap-4">
          <div className="flex justify-between items-start gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <h1 className="font-extrabold text-3xl md:text-4xl tracking-tight text-text-primary">
                  {p.isAdmin ? 'Notas' : 'Mis notas'}
                </h1>
                {navidad && <Copo size={18} className="text-gold-light" />}
              </div>
              <p className="mt-2 text-xs text-text-muted">
                {p.isAdmin && p.targetNombre
                  ? <>Calificaciones de <b className="font-bold text-text-primary">{p.targetNombre}</b></>
                  : p.isAdmin ? 'Elige un alumno para ver sus calificaciones' : 'Tus calificaciones por materia'}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={p.onRefresh} disabled={p.refreshing} aria-label="Actualizar"
                className={cn('w-10 h-10 flex items-center justify-center rounded-xl transition-colors hover:bg-ov/5 bg-ov/[0.03] text-text-secondary', FOCO)}>
                <RefreshCw size={15} className={p.refreshing ? 'animate-spin' : ''} aria-hidden="true" />
              </button>
              {p.isAdmin && (
                <Button onClick={p.onAdd} disabled={!p.targetId} icon={<Plus size={16} aria-hidden="true" />} className={cn('shrink-0', FOCO)}>
                  <span className="hidden sm:inline">Añadir nota</span>
                  <span className="sm:hidden">Añadir</span>
                </Button>
              )}
            </div>
          </div>

          {p.isAdmin && (
            <div className="relative sm:w-80">
              <label htmlFor="notas-alumno" className="sr-only">Alumno</label>
              <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" aria-hidden="true" />
              <select id="notas-alumno" value={p.selectedId ?? ''} onChange={e => p.onSelectAlumno(e.target.value || undefined)}
                className="bg-input border border-ov/[0.08] rounded-xl pl-10 pr-4 py-2.5 text-text-primary text-sm w-full outline-none transition-[border-color,box-shadow] duration-200 focus:border-primary/50 focus:shadow-[0_0_0_3px_rgb(var(--c-primary)/0.12)]">
                <option value="">Seleccionar alumno…</option>
                {p.alumnos.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
            </div>
          )}
        </header>

        {p.isAdmin && !p.targetId ? (
          <Vacio Icon={User} titulo="Selecciona un alumno" mensaje="Elige un alumno en el selector de arriba para ver o añadir sus notas." />
        ) : p.loading ? (
          <NotasEsqueleto />
        ) : p.notas.length === 0 ? (
          <Vacio Icon={BookOpen}
            titulo={p.isAdmin ? `${p.targetNombre ?? 'Este alumno'} no tiene notas` : 'Aún no tienes notas registradas'}
            mensaje={p.isAdmin ? 'Pulsa "Añadir nota" para registrar calificaciones.' : 'Las notas las añade el administrador.'} />
        ) : (
          <>
            <Resumen notas={p.notas} nMaterias={materias.length} />
            <div className="md:columns-2 md:gap-4 flex flex-col gap-4 md:block">
              {materias.map(m => (
                <TarjetaMateria key={m} materia={m} notas={byMateria[m]} canDelete={p.isAdmin} onDelete={p.onDelete} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
