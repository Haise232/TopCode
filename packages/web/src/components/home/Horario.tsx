import { useEffect, useState } from 'react'
import { CalendarDays, Check, CalendarOff } from 'lucide-react'
import type { HorarioClase } from '@topcode/shared'
import { cn } from '../ui/cn'
import { EnlaceAccion, Seccion } from '../ui/Seccion'
import { SUPERFICIE, materiaColor, mez, varsColor } from '../ui/estilos'

function enMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

/** Hora actual, refrescada cada `cadaMs` y al volver a la pestaña. */
function useAhora(cadaMs: number) {
  const [ahora, setAhora] = useState(() => new Date())
  useEffect(() => {
    const tic = () => setAhora(new Date())
    const id = setInterval(tic, cadaMs)
    const alVolver = () => { if (document.visibilityState === 'visible') tic() }
    document.addEventListener('visibilitychange', alVolver)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', alVolver) }
  }, [cadaMs])
  return ahora
}

const DIAS_LECTIVOS = [
  { dia: 1, nombre: 'Lunes' },
  { dia: 2, nombre: 'Martes' },
  { dia: 3, nombre: 'Miércoles' },
  { dia: 4, nombre: 'Jueves' },
  { dia: 5, nombre: 'Viernes' },
]

const DIAS_NOMBRE = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

function Descanso({ compacto = false }: { compacto?: boolean }) {
  return (
    <div className={cn('flex items-center gap-3 text-2xs font-medium text-text-faint', compacto ? 'px-3 py-1' : 'px-4 py-1.5 md:px-5')}>
      <div className="flex-1 h-px bg-ov/[0.07]" />
      Descanso
      <div className="flex-1 h-px bg-ov/[0.07]" />
    </div>
  )
}

/** Resalte de la clase que toca ahora o, si no hay, de la siguiente. */
function ClaseDestacada({
  clase, enCurso, minutosAhora,
}: { clase: HorarioClase; enCurso: boolean; minutosAhora: number }) {
  const ini = enMinutos(clase.hora_inicio)
  const fin = enMinutos(clase.hora_fin)
  const progreso = enCurso ? Math.min(100, Math.max(0, ((minutosAhora - ini) / (fin - ini)) * 100)) : 0
  const restante = Math.ceil(enCurso ? fin - minutosAhora : ini - minutosAhora)
  const textoTiempo = enCurso
    ? `Quedan ${restante} min`
    : restante >= 60
      ? `Empieza a las ${clase.hora_inicio}`
      : `Empieza en ${restante} min`

  return (
    <div className="relative px-4 py-4 md:px-5 md:py-5" style={{ ...varsColor(materiaColor(clase.materia)), background: 'var(--c-suave)' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wider text-[color:var(--c-ink)]">
            <span className="relative flex h-2 w-2">
              {enCurso && <span className="absolute inset-0 rounded-full bg-[var(--c)] opacity-60 motion-safe:animate-ping" />}
              <span className="relative h-2 w-2 rounded-full bg-[var(--c)]" />
            </span>
            {enCurso ? 'En curso' : 'Siguiente clase'}
          </span>
          <p className="mt-1.5 text-lg md:text-xl font-bold leading-snug text-text-primary">{clase.materia}</p>
          <p className="mt-1 text-sm text-text-secondary">
            <span className="font-mono">{clase.hora_inicio}–{clase.hora_fin}</span>
            <span className="mx-1.5 text-text-faint" aria-hidden="true">·</span>
            {textoTiempo}
          </p>
        </div>
        <span className="shrink-0 text-xs font-bold px-2.5 py-1 rounded-lg bg-surface/70 text-[color:var(--c-ink)]">
          {clase.codigo}
        </span>
      </div>
      {enCurso && (
        <div className="mt-3.5 h-1 rounded-full overflow-hidden" style={{ background: mez('var(--c)', 18) }} role="progressbar" aria-label="Progreso de la clase" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progreso)}>
          <div className="h-full rounded-full bg-[var(--c)] motion-safe:transition-[width] motion-safe:duration-1000 motion-safe:ease-linear" style={{ width: `${progreso}%` }} />
        </div>
      )}
    </div>
  )
}

function ClasesTerminadas() {
  return (
    <div className="flex items-center gap-3 px-4 py-4 md:px-5 bg-primary/[0.07]">
      <span className="w-8 h-8 flex items-center justify-center rounded-full bg-primary/15 text-primary-light">
        <Check size={16} aria-hidden="true" />
      </span>
      <p className="text-sm font-semibold text-text-primary">Has terminado las clases de hoy</p>
    </div>
  )
}

/** Horario del día (o del próximo lunes en fin de semana) con la clase en curso destacada. */
export function HorarioHoy({
  porDia, tieneClase, onVerSemana,
}: {
  porDia: Record<number, HorarioClase[]>
  tieneClase: boolean
  onVerSemana: () => void
}) {
  const ahora = useAhora(5_000)
  const diaSemana = ahora.getDay() // 0=Dom, 1=Lun ... 6=Sáb
  const esFinDeSemana = diaSemana === 0 || diaSemana === 6
  const diaClases = esFinDeSemana ? 1 : diaSemana
  const clases = porDia[diaClases] ?? []
  const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes() + ahora.getSeconds() / 60

  const actual = esFinDeSemana ? undefined : clases.find(c => minutosAhora >= enMinutos(c.hora_inicio) && minutosAhora < enMinutos(c.hora_fin))
  const siguiente = esFinDeSemana || actual ? undefined : clases.find(c => enMinutos(c.hora_inicio) > minutosAhora)
  const destacada = actual ?? siguiente
  const terminado = !esFinDeSemana && clases.length > 0 && !destacada

  return (
    <Seccion
      titulo={esFinDeSemana ? 'Próximo lunes' : `Horario — ${DIAS_NOMBRE[diaSemana]}`}
      subtitulo={`${clases.length} clases`}
      extra={tieneClase ? <EnlaceAccion onClick={onVerSemana} Icon={CalendarDays}>Ver semana</EnlaceAccion> : undefined}
    >
      <div className={cn(SUPERFICIE, 'overflow-hidden')}>
        {clases.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <CalendarOff size={22} className="text-text-faint" aria-hidden="true" />
            <p className="text-sm text-text-muted">
              {tieneClase
                ? 'Sin clases programadas para hoy.'
                : 'Configura tu clase en el perfil para ver tu horario.'}
            </p>
          </div>
        )}

        {destacada && <ClaseDestacada clase={destacada} enCurso={!!actual} minutosAhora={minutosAhora} />}
        {terminado && <ClasesTerminadas />}

        {clases.map((clase, idx) => {
          const iniMin = enMinutos(clase.hora_inicio)
          const finMin = enMinutos(clase.hora_fin)
          const esCurso = !esFinDeSemana && minutosAhora >= iniMin && minutosAhora < finMin
          const haPasado = !esFinDeSemana && minutosAhora >= finMin
          const hayDescanso = idx > 0 && iniMin - enMinutos(clases[idx - 1].hora_fin) > 5

          return (
            <div key={clase.id ?? idx}>
              {hayDescanso ? <Descanso /> : idx > 0 && <div className="mx-4 md:mx-5 h-px bg-ov/[0.06]" />}
              <div
                className={cn('relative flex items-center gap-3 px-4 py-3 md:px-5', haPasado && 'opacity-50')}
                style={varsColor(materiaColor(clase.materia))}
              >
                <div className="shrink-0 flex flex-col items-end w-11 font-mono leading-tight">
                  <span className={cn('text-xs font-semibold', esCurso ? 'text-text-primary' : 'text-text-secondary')}>{clase.hora_inicio}</span>
                  <span className="text-2xs text-text-faint">{clase.hora_fin}</span>
                </div>
                <span className="shrink-0 w-1 self-stretch rounded-full" style={{ background: haPasado ? 'rgb(var(--c-ov) / 0.15)' : 'var(--c)' }} aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <span className={cn('block text-sm truncate', esCurso ? 'font-bold text-text-primary' : 'font-medium text-text-secondary')}>
                    {clase.materia}
                  </span>
                </div>
                <span className="shrink-0 text-xs font-bold px-2 py-0.5 rounded-md bg-ov/[0.05] text-text-muted">
                  {clase.codigo}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </Seccion>
  )
}

const DIAS_CORTO = ['', 'L', 'M', 'X', 'J', 'V']
/** Altura en píxeles de cada minuto en la rejilla semanal. */
const PX_MIN = 1.15

/** Minutos desde medianoche, actualizados cada minuto. */
function useMinutosAhora() {
  const d = useAhora(60_000)
  return d.getHours() * 60 + d.getMinutes()
}

const fmtHora = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:00`

/** Bloque de una clase colocado en la rejilla según su hora. */
function BloqueClase({
  clase, inicioRejilla, esCurso, haPasado,
}: { clase: HorarioClase; inicioRejilla: number; esCurso: boolean; haPasado: boolean }) {
  const ini = enMinutos(clase.hora_inicio)
  const fin = enMinutos(clase.hora_fin)
  const alto = (fin - ini) * PX_MIN
  const corto = fin - ini < 50

  return (
    <div
      className="absolute inset-x-1 px-0.5 py-px"
      style={{ top: (ini - inicioRejilla) * PX_MIN, height: alto }}
    >
      <div
        className={cn(
          'h-full rounded-lg border-l-[3px] overflow-hidden flex flex-col transition-shadow',
          corto ? 'px-2 py-1 justify-center' : 'px-2.5 py-1.5',
          esCurso && 'ring-2 ring-[color:var(--c)] shadow-card',
          haPasado && 'opacity-45',
        )}
        style={{
          ...varsColor(materiaColor(clase.materia)),
          borderLeftColor: 'var(--c)',
          background: esCurso ? 'var(--c-medio)' : 'var(--c-suave)',
        }}
        title={`${clase.materia} · ${clase.hora_inicio}–${clase.hora_fin} · ${clase.codigo}`}
      >
        <div className="flex items-start justify-between gap-1.5 min-w-0">
          <span className={cn('text-xs font-semibold leading-tight text-text-primary min-w-0', corto ? 'truncate' : 'line-clamp-2')}>
            {clase.materia}
          </span>
          <span className="shrink-0 text-2xs font-bold leading-tight text-[color:var(--c-ink)]">{clase.codigo}</span>
        </div>
        {!corto && (
          <span className="mt-auto text-2xs font-mono text-text-muted leading-tight">
            {clase.hora_inicio}–{clase.hora_fin}
          </span>
        )}
      </div>
    </div>
  )
}

/** Rejilla de lunes a viernes con las clases a escala de tiempo (escritorio). */
function RejillaSemana({
  porDia, diaHoy, minutosAhora,
}: { porDia: Record<number, HorarioClase[]>; diaHoy: number; minutosAhora: number }) {
  const todas = DIAS_LECTIVOS.flatMap(d => porDia[d.dia] ?? [])
  if (todas.length === 0) return null

  const inicio = Math.floor(Math.min(...todas.map(c => enMinutos(c.hora_inicio))) / 60) * 60
  const fin = Math.ceil(Math.max(...todas.map(c => enMinutos(c.hora_fin))) / 60) * 60
  const alto = (fin - inicio) * PX_MIN
  const horas: number[] = []
  for (let m = inicio; m <= fin; m += 60) horas.push(m)
  const lineaAhora = minutosAhora >= inicio && minutosAhora <= fin

  return (
    <div className="grid grid-cols-[3rem_repeat(5,minmax(0,1fr))]">
      {/* Cabecera */}
      <div />
      {DIAS_LECTIVOS.map(({ dia, nombre }) => {
        const esHoy = dia === diaHoy
        const n = porDia[dia]?.length ?? 0
        return (
          <div key={dia} className="px-1 pb-3 text-center">
            <div
              className={cn(
                'rounded-xl py-2 transition-colors',
                esHoy ? 'bg-primary/[0.12]' : 'bg-ov/[0.03]',
              )}
            >
              <span className={cn('block text-xs font-bold uppercase tracking-wider', esHoy ? 'text-primary-light' : 'text-text-secondary')}>
                {nombre}
              </span>
              <span className={cn('block text-2xs mt-0.5', esHoy ? 'text-primary-light/80 font-semibold' : 'text-text-faint')}>
                {esHoy ? 'Hoy' : n === 0 ? 'Sin clases' : `${n} ${n === 1 ? 'clase' : 'clases'}`}
              </span>
            </div>
          </div>
        )
      })}

      {/* Eje de horas */}
      <div className="relative" style={{ height: alto }}>
        {horas.map(m => (
          <span
            key={m}
            className="absolute right-2 -translate-y-1/2 text-2xs font-mono text-text-faint"
            style={{ top: (m - inicio) * PX_MIN }}
          >
            {fmtHora(m)}
          </span>
        ))}
      </div>

      {/* Columnas de días */}
      {DIAS_LECTIVOS.map(({ dia }) => {
        const clases = porDia[dia] ?? []
        const esHoy = dia === diaHoy
        return (
          <div
            key={dia}
            className={cn('relative border-l border-ov/[0.06]', esHoy && 'bg-primary/[0.035]')}
            style={{ height: alto }}
          >
            {horas.map(m => (
              <div
                key={m}
                className="absolute inset-x-0 h-px bg-ov/[0.06]"
                style={{ top: (m - inicio) * PX_MIN }}
                aria-hidden="true"
              />
            ))}
            {clases.map((clase, idx) => {
              const ini = enMinutos(clase.hora_inicio)
              const finC = enMinutos(clase.hora_fin)
              return (
                <BloqueClase
                  key={clase.id ?? idx}
                  clase={clase}
                  inicioRejilla={inicio}
                  esCurso={esHoy && minutosAhora >= ini && minutosAhora < finC}
                  haPasado={esHoy && minutosAhora >= finC}
                />
              )
            })}
            {esHoy && lineaAhora && (
              <div
                className="absolute -inset-x-px z-10 flex items-center pointer-events-none"
                style={{ top: (minutosAhora - inicio) * PX_MIN }}
                aria-hidden="true"
              >
                <span className="-ml-1 h-2 w-2 rounded-full bg-rose shrink-0" />
                <span className="flex-1 h-0.5 bg-rose" />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/** Selector de día + lista de clases de ese día (móvil). */
function ListaDia({
  porDia, diaHoy, minutosAhora,
}: { porDia: Record<number, HorarioClase[]>; diaHoy: number; minutosAhora: number }) {
  const [dia, setDia] = useState(diaHoy >= 1 && diaHoy <= 5 ? diaHoy : 1)
  const clases = porDia[dia] ?? []
  const esHoy = dia === diaHoy

  return (
    <div>
      <div role="tablist" aria-label="Día de la semana" className="grid grid-cols-5 gap-1 p-1 rounded-xl bg-ov/[0.04]">
        {DIAS_LECTIVOS.map(d => {
          const activo = d.dia === dia
          const hoy = d.dia === diaHoy
          return (
            <button
              key={d.dia}
              role="tab"
              aria-selected={activo}
              aria-label={d.nombre}
              onClick={() => setDia(d.dia)}
              className={cn(
                'relative py-2 rounded-lg text-sm font-bold transition-colors',
                activo ? 'bg-surface text-text-primary shadow-card' : 'text-text-muted hover:text-text-secondary',
              )}
            >
              {DIAS_CORTO[d.dia]}
              {hoy && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-primary" aria-hidden="true" />}
            </button>
          )
        })}
      </div>

      <div className="flex items-baseline justify-between mt-4 mb-2 px-1">
        <span className="text-sm font-bold text-text-primary">
          {DIAS_LECTIVOS[dia - 1].nombre}
          {esHoy && <span className="ml-2 text-2xs font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary-light align-middle">Hoy</span>}
        </span>
        <span className="text-xs text-text-muted">{clases.length} {clases.length === 1 ? 'clase' : 'clases'}</span>
      </div>

      {clases.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <CalendarOff size={20} className="text-text-faint" aria-hidden="true" />
          <p className="text-sm text-text-muted">Sin clases este día.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {clases.map((clase, idx) => {
            const ini = enMinutos(clase.hora_inicio)
            const fin = enMinutos(clase.hora_fin)
            const esCurso = esHoy && minutosAhora >= ini && minutosAhora < fin
            const haPasado = esHoy && minutosAhora >= fin
            const hayDescanso = idx > 0 && ini - enMinutos(clases[idx - 1].hora_fin) > 5
            return (
              <div key={clase.id ?? idx}>
                {hayDescanso && <Descanso compacto />}
                <div
                  className={cn(
                    'flex items-center gap-3 rounded-xl border-l-[3px] px-3 py-2.5',
                    esCurso && 'ring-2 ring-[color:var(--c)]',
                    haPasado && 'opacity-45',
                  )}
                  style={{
                    ...varsColor(materiaColor(clase.materia)),
                    borderLeftColor: 'var(--c)',
                    background: esCurso ? 'var(--c-medio)' : 'var(--c-suave)',
                  }}
                >
                  <div className="shrink-0 flex flex-col items-end w-11 font-mono leading-tight">
                    <span className="text-xs font-semibold text-text-primary">{clase.hora_inicio}</span>
                    <span className="text-2xs text-text-muted">{clase.hora_fin}</span>
                  </div>
                  <span className={cn('flex-1 min-w-0 text-sm truncate text-text-primary', esCurso ? 'font-bold' : 'font-medium')}>
                    {clase.materia}
                  </span>
                  {esCurso && <span className="shrink-0 text-2xs font-bold uppercase tracking-wider text-[color:var(--c-ink)]">Ahora</span>}
                  <span className="shrink-0 text-xs font-bold px-2 py-0.5 rounded-md bg-surface/70 text-[color:var(--c-ink)]">
                    {clase.codigo}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Horario completo de lunes a viernes (modal): rejilla temporal en escritorio y selector de día en móvil. */
export function HorarioSemana({ porDia }: { porDia: Record<number, HorarioClase[]> }) {
  const diaHoy = new Date().getDay()
  const minutosAhora = useMinutosAhora()
  const vacio = DIAS_LECTIVOS.every(d => (porDia[d.dia]?.length ?? 0) === 0)

  if (vacio) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
        <CalendarOff size={22} className="text-text-faint" aria-hidden="true" />
        <p className="text-sm text-text-muted">No hay clases en el horario.</p>
      </div>
    )
  }

  return (
    <>
      <div className="md:hidden">
        <ListaDia porDia={porDia} diaHoy={diaHoy} minutosAhora={minutosAhora} />
      </div>
      <div className="hidden md:block pr-1">
        <RejillaSemana porDia={porDia} diaHoy={diaHoy} minutosAhora={minutosAhora} />
      </div>
    </>
  )
}
