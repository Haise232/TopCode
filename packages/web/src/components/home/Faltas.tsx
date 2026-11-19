import { cn } from '../ui/cn'
import { Seccion } from '../ui/Seccion'
import { SUPERFICIE, materiaColor, varsColor } from '../ui/estilos'

/** Módulos de 2º DAM con sus horas totales (currículo oficial, segundo curso: 1000 h). */
const MODULOS: { codigo: string; nombre: string; horas: number }[] = [
  { codigo: '0486', nombre: 'Acceso a datos', horas: 206 },
  { codigo: '0488', nombre: 'Desarrollo de interfaces', horas: 173 },
  { codigo: '0489', nombre: 'Programación multimedia y dispositivos móviles', horas: 141 },
  { codigo: '0490', nombre: 'Programación de servicios y procesos', horas: 96 },
  { codigo: '0491', nombre: 'Sistemas de gestión empresarial', horas: 96 },
  { codigo: '1708', nombre: 'Sostenibilidad aplicada al sistema productivo', horas: 32 },
  { codigo: '1710', nombre: 'Itinerario personal para la empleabilidad II', horas: 96 },
  { codigo: '0492', nombre: 'Proyecto intermodular de DAM', horas: 64 },
  { codigo: '—', nombre: 'Módulo profesional optativo', horas: 96 },
]

const TOTAL = MODULOS.reduce((s, m) => s + m.horas, 0)
const MAX = Math.max(...MODULOS.map(m => m.horas))

/** Horas con una cifra decimal y coma española («20,6 h»). */
const fmt = (h: number) => `${h.toLocaleString('es', { maximumFractionDigits: 1 })} h`

function Limite({ etiqueta, horas, tono }: { etiqueta: string; horas: number; tono: 'aviso' | 'peligro' }) {
  return (
    <div
      className={cn(
        'flex flex-col items-end rounded-lg px-2.5 py-1 min-w-[4.5rem]',
        tono === 'aviso' ? 'bg-amber-subtle' : 'bg-rose-subtle',
      )}
    >
      <span className={cn('text-2xs font-bold uppercase tracking-wider', tono === 'aviso' ? 'text-amber-dark dark:text-amber-light' : 'text-rose-dark dark:text-rose-light')}>
        {etiqueta}
      </span>
      <span className="text-sm font-bold font-mono text-text-primary leading-tight">{fmt(horas)}</span>
    </div>
  )
}

/** Tabla de horas máximas de faltas por módulo (10 % y 20 % de las horas totales). */
export function Faltas() {
  return (
    <Seccion titulo="Faltas — 2º DAM" subtitulo="Horas máximas de ausencia por módulo (10 % y 20 % del total)">
      <div className={cn(SUPERFICIE, 'overflow-hidden')}>
        <ul>
          {MODULOS.map((m, idx) => (
            <li key={m.codigo + m.nombre} style={varsColor(materiaColor(m.nombre))}>
              {idx > 0 && <div className="mx-4 md:mx-5 h-px bg-ov/[0.06]" />}
              <div className="flex items-center gap-3 px-4 py-3 md:px-5">
                <span className="shrink-0 w-1 self-stretch rounded-full bg-[var(--c)]" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="shrink-0 text-2xs font-bold font-mono px-1.5 py-0.5 rounded-md bg-ov/[0.05] text-[color:var(--c-ink)]">
                      {m.codigo}
                    </span>
                    <span className="text-sm font-semibold text-text-primary truncate" title={m.nombre}>{m.nombre}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex-1 h-1 rounded-full bg-ov/[0.06] overflow-hidden" aria-hidden="true">
                      <div className="h-full rounded-full bg-[var(--c)]" style={{ width: `${(m.horas / MAX) * 100}%` }} />
                    </div>
                    <span className="shrink-0 text-xs font-mono text-text-muted w-12 text-right">{m.horas} h</span>
                  </div>
                </div>
                <div className="shrink-0 flex gap-1.5">
                  <Limite etiqueta="10 %" horas={m.horas * 0.1} tono="aviso" />
                  <Limite etiqueta="20 %" horas={m.horas * 0.2} tono="peligro" />
                </div>
              </div>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-3 px-4 py-3 md:px-5 border-t border-ov/[0.07] bg-ov/[0.025]">
          <span className="flex-1 text-sm font-bold text-text-primary">Total del curso</span>
          <span className="shrink-0 text-xs font-mono text-text-muted">{TOTAL} h</span>
          <div className="shrink-0 flex gap-1.5">
            <Limite etiqueta="10 %" horas={TOTAL * 0.1} tono="aviso" />
            <Limite etiqueta="20 %" horas={TOTAL * 0.2} tono="peligro" />
          </div>
        </div>
      </div>
    </Seccion>
  )
}
