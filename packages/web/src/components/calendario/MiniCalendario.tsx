import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { EventoCalendario } from '@topcode/shared'
import { useTheme } from '../../contexts/ThemeContext'
import { tipoEventoConfig } from '../../lib/tiposEvento'
import { Copo } from '../Navidad'
import { cn } from '../ui/cn'
import { FOCO, SUPERFICIE, mez } from '../ui/estilos'
import { MESES, diasEnMes, primerDiaMes } from './tipos'

const DIAS_SEMANA = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do']

const BOTON_MES = cn(
  'w-9 h-9 flex items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-ov/[0.06] hover:text-text-primary',
  FOCO,
)

/** Fechas señaladas en temporada navideña: 24, 25 y 31 de diciembre y 6 de enero. */
function esFestivo(mes: number, dia: number) {
  return (mes === 11 && (dia === 24 || dia === 25 || dia === 31)) || (mes === 0 && dia === 6)
}

export default function MiniCalendario({
  eventos, onDiaClick, diaHighlight, viewYear, viewMonth, onPrevMonth, onNextMonth, onHoy,
}: {
  eventos: EventoCalendario[]
  onDiaClick: (fecha: string) => void
  diaHighlight: string | null
  viewYear: number
  viewMonth: number
  onPrevMonth: () => void
  onNextMonth: () => void
  /** Vuelve al mes actual (solo se ofrece si no estás en él). */
  onHoy?: () => void
}) {
  const { navidad } = useTheme()
  const hoy = new Date()
  const esMesActual = hoy.getFullYear() === viewYear && hoy.getMonth() === viewMonth

  const offset = primerDiaMes(viewYear, viewMonth)
  const totalDias = diasEnMes(viewYear, viewMonth)

  const diasConEvento = new Map<number, { colores: string[]; total: number }>()
  eventos.forEach(ev => {
    const [y, m, d] = ev.fecha.split('-').map(Number)
    if (y !== viewYear || m - 1 !== viewMonth) return
    const info = diasConEvento.get(d) ?? { colores: [], total: 0 }
    const color = tipoEventoConfig(ev.tipo).color
    if (!info.colores.includes(color) && info.colores.length < 3) info.colores.push(color)
    info.total += 1
    diasConEvento.set(d, info)
  })

  const celdas: (number | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: totalDias }, (_, i) => i + 1),
  ]
  const fechaStr = (d: number) =>
    `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

  return (
    <div className={cn(SUPERFICIE, 'p-4')}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <button onClick={onPrevMonth} className={BOTON_MES} aria-label="Mes anterior">
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <div className="flex flex-col items-center min-w-0">
          <h3 className="font-bold text-sm capitalize text-text-primary" aria-live="polite">
            {MESES[viewMonth]} {viewYear}
          </h3>
          {!esMesActual && onHoy && (
            <button onClick={onHoy} className={cn('rounded text-2xs font-semibold text-primary-light hover:underline underline-offset-2', FOCO)}>
              Ir a hoy
            </button>
          )}
        </div>
        <button onClick={onNextMonth} className={BOTON_MES} aria-label="Mes siguiente">
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1" aria-hidden="true">
        {DIAS_SEMANA.map(d => (
          <div key={d} className="text-center text-2xs font-bold uppercase tracking-wide py-1 text-text-faint">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {celdas.map((dia, idx) => {
          if (dia === null) return <div key={`vacio-${idx}`} />
          const esHoy = esMesActual && dia === hoy.getDate()
          const info = diasConEvento.get(dia)
          const fs = fechaStr(dia)
          const resaltado = diaHighlight === fs
          const festivo = navidad && !esHoy && esFestivo(viewMonth, dia)

          const contenido = (
            <>
              <span
                className={cn(
                  'w-8 h-8 flex items-center justify-center rounded-full text-xs tabular-nums transition-colors',
                  esHoy ? 'bg-primary text-white font-bold'
                    : info ? 'font-bold text-text-primary' : 'font-medium text-text-muted',
                )}
                style={
                  resaltado && !esHoy ? { background: mez('var(--color-primary)', 18), boxShadow: `inset 0 0 0 1.5px ${mez('var(--color-primary)', 55)}` }
                  : festivo ? { background: 'rgb(var(--c-gold) / 0.16)', color: 'rgb(var(--c-gold-light))' }
                  : undefined
                }
              >
                {dia}
              </span>
              {festivo && <Copo size={8} className="absolute top-0.5 right-1.5 text-gold-light" />}
              {info && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 flex gap-0.5" aria-hidden="true">
                  {info.colores.map(c => <span key={c} className="w-1 h-1 rounded-full" style={{ background: c }} />)}
                </span>
              )}
            </>
          )

          return info ? (
            <button
              key={dia}
              onClick={() => onDiaClick(fs)}
              aria-current={esHoy ? 'date' : undefined}
              aria-label={`${dia} de ${MESES[viewMonth]}${esHoy ? ', hoy' : ''}: ${info.total} ${info.total === 1 ? 'evento' : 'eventos'}`}
              className={cn('relative flex flex-col items-center justify-center h-10 rounded-lg hover:bg-ov/[0.05]', FOCO)}
            >
              {contenido}
            </button>
          ) : (
            <div
              key={dia}
              aria-current={esHoy ? 'date' : undefined}
              className="relative flex flex-col items-center justify-center h-10"
            >
              {contenido}
            </div>
          )
        })}
      </div>
    </div>
  )
}
