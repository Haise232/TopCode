import { CalendarDays, Check, CalendarOff } from 'lucide-react'
import type { HorarioClase } from '@topcode/shared'
import { cn } from '../ui/cn'
import { EnlaceAccion, Seccion } from '../ui/Seccion'
import { SUPERFICIE, materiaColor, mez, varsColor } from '../ui/estilos'

function enMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
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
  const restante = enCurso ? fin - minutosAhora : ini - minutosAhora
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
          <div className="h-full rounded-full bg-[var(--c)]" style={{ width: `${progreso}%` }} />
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
  const ahora = new Date()
  const diaSemana = ahora.getDay() // 0=Dom, 1=Lun ... 6=Sáb
  const esFinDeSemana = diaSemana === 0 || diaSemana === 6
  const diaClases = esFinDeSemana ? 1 : diaSemana
  const clases = porDia[diaClases] ?? []
  const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes()

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

/** Horario completo de lunes a viernes (modal), resaltando el día actual y la clase en curso. */
export function HorarioSemana({ porDia }: { porDia: Record<number, HorarioClase[]> }) {
  const ahora = new Date()
  const diaHoy = ahora.getDay()
  const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes()

  return (
    <div className="grid gap-3 md:grid-cols-5">
      {DIAS_LECTIVOS.map(({ dia, nombre }) => {
        const clases = porDia[dia] ?? []
        const esHoy = dia === diaHoy

        return (
          <div
            key={dia}
            className={cn(
              'rounded-2xl overflow-hidden min-w-0 border',
              esHoy ? 'border-primary/40 bg-primary/[0.05]' : 'border-ov/[0.07] bg-surface'
            )}
          >
            <div className="flex items-center justify-between gap-2 px-3 py-2.5">
              <span className={cn('text-xs font-bold uppercase tracking-wider', esHoy ? 'text-primary-light' : 'text-text-secondary')}>
                {nombre}
              </span>
              {esHoy ? (
                <span className="text-2xs font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary-light">Hoy</span>
              ) : (
                <span className="text-2xs text-text-muted">{clases.length} clases</span>
              )}
            </div>

            {clases.length === 0 && (
              <div className="px-3 pb-4 pt-1 text-center text-2xs text-text-muted">Sin clases</div>
            )}

            {clases.map((clase, idx) => {
              const iniMin = enMinutos(clase.hora_inicio)
              const finMin = enMinutos(clase.hora_fin)
              const esCurso = esHoy && minutosAhora >= iniMin && minutosAhora < finMin
              const hayDescanso = idx > 0 && iniMin - enMinutos(clases[idx - 1].hora_fin) > 5

              return (
                <div key={clase.id}>
                  {hayDescanso ? <Descanso compacto /> : idx > 0 && <div className="mx-3 h-px bg-ov/[0.06]" />}
                  <div
                    className="flex items-center gap-2 px-3 py-2"
                    style={{ ...varsColor(materiaColor(clase.materia)), background: esCurso ? 'var(--c-suave)' : undefined }}
                  >
                    <div className="shrink-0 w-1.5 h-1.5 rounded-full bg-[var(--c)]" />
                    <div className="flex-1 min-w-0">
                      <span className={cn('block text-xs truncate', esCurso ? 'text-text-primary font-bold' : 'text-text-secondary')}>
                        {clase.materia}
                      </span>
                      <span className="block text-2xs font-mono text-text-muted">
                        {clase.hora_inicio}–{clase.hora_fin}
                      </span>
                    </div>
                    <span className="shrink-0 text-2xs font-bold px-1.5 py-0.5 rounded-md bg-ov/[0.05] text-text-muted">
                      {clase.codigo}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

