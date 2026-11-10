import { Calendar, ChevronRight, ClipboardCheck, Clock, MessageCircle } from 'lucide-react'
import type { ElementType } from 'react'
import { fechaLimiteEvento as fechaLimite, type EventoCalendario } from '@topcode/shared'
import { TipoEventoBadge } from '../../lib/tiposEvento'
import { Copo } from '../Navidad'
import { cn } from '../ui/cn'
import { tinta } from '../../lib/tinta'
import { EnlaceAccion, Seccion } from './comun'
import { SUPERFICIE, SUPERFICIE_PULSABLE, FOCO, mez, varsColor } from './estilos'

export type DudaInicio = {
  id: string
  titulo: string
  autor: string
  created_at: string
  foro_respuestas?: { id: string }[]
}

/** Tarjeta de fecha (mes + día) con título, común a actividad y evento. */
function TarjetaFecha({
  fecha, color, Icon, etiqueta, titulo, linea, extra, resaltada, onClick,
}: {
  fecha: Date
  color: string
  Icon: ElementType
  etiqueta: string
  titulo: string
  linea: React.ReactNode
  extra?: React.ReactNode
  resaltada?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{ ...varsColor(color), ...(resaltada ? { borderColor: mez(color, 40) } : null) }}
      className={cn('group w-full text-left flex items-stretch overflow-hidden', SUPERFICIE_PULSABLE)}
    >
      <div className="shrink-0 w-[68px] flex flex-col items-center justify-center gap-0.5 py-3 bg-[color:var(--c-suave)] text-[color:var(--c-ink)]">
        <span className="text-2xs font-extrabold uppercase tracking-wider leading-none">
          {fecha.toLocaleDateString('es', { month: 'short' })}
        </span>
        <span className="text-2xl font-black leading-none">{fecha.getDate()}</span>
      </div>
      <div className="flex-1 min-w-0 flex items-center gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 text-2xs font-bold px-2 py-0.5 rounded-full bg-[color:var(--c-medio)] text-[color:var(--c-ink)]">
              <Icon size={11} aria-hidden="true" />
              {etiqueta}
            </span>
            {extra}
          </div>
          <p className="mt-1.5 text-sm font-semibold leading-snug line-clamp-2 text-text-primary">{titulo}</p>
          <p className="mt-0.5 text-xs flex items-center gap-1 text-text-muted">{linea}</p>
        </div>
        <ChevronRight size={16} className="shrink-0 text-text-faint transition-transform motion-safe:group-hover:translate-x-0.5" aria-hidden="true" />
      </div>
    </button>
  )
}

function ProximaActividad({ actividad, onClick }: { actividad: EventoCalendario; onClick: () => void }) {
  const fechaEvento = fechaLimite(actividad)
  const diff = fechaEvento.getTime() - Date.now()
  const dias = diff / 86400000
  const urgColor = dias < 1 ? '#f43f5e' : dias < 3 ? '#f59e0b' : 'rgb(var(--c-primary-light))'
  const label = diff < 0 ? 'Vence hoy' : dias < 1
    ? `${Math.floor(diff / 3600000)}h restantes`
    : dias < 2 ? 'Mañana'
    : `En ${Math.floor(dias)} días`
  return (
    <TarjetaFecha
      fecha={fechaEvento}
      color={urgColor}
      Icon={ClipboardCheck}
      etiqueta={label}
      resaltada={dias < 3}
      titulo={actividad.titulo}
      extra={actividad.materia ? <span className="text-2xs font-medium text-text-muted truncate">{actividad.materia}</span> : undefined}
      linea={<><Clock size={11} aria-hidden="true" />{fechaEvento.toLocaleDateString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</>}
      onClick={onClick}
    />
  )
}

function ProximoEvento({ evento, onClick }: { evento: EventoCalendario; onClick: () => void }) {
  const fechaEvt = new Date(evento.fecha + 'T00:00:00')
  const diffDias = Math.ceil((fechaEvt.getTime() - Date.now()) / 86400000)
  const label = diffDias <= 0 ? 'Hoy' : diffDias === 1 ? 'Mañana' : `En ${diffDias} días`
  return (
    <TarjetaFecha
      fecha={fechaEvt}
      color="#f59e0b"
      Icon={Calendar}
      etiqueta={label}
      titulo={evento.titulo}
      extra={<TipoEventoBadge tipo={evento.tipo} />}
      linea={<span className="first-letter:uppercase">{fechaEvt.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}</span>}
      onClick={onClick}
    />
  )
}

/** Cuenta atrás navideña: una franja cálida y breve, sin competir con las entregas. */
function CuentaAtras({ texto, especial }: { texto: string; especial: boolean }) {
  return (
    <div
      className="flex items-center gap-3 rounded-2xl px-4 py-3"
      style={{
        background: 'linear-gradient(120deg, rgb(var(--c-gold) / 0.16), rgb(var(--c-primary) / 0.07))',
        boxShadow: 'inset 0 0 0 1px rgb(var(--c-gold) / 0.28)',
      }}
    >
      <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-gold/20 text-gold-light">
        <Copo size={18} className={especial ? 'motion-safe:animate-twinkle' : undefined} />
      </span>
      <p className="text-sm font-semibold text-gold-light">{texto}</p>
    </div>
  )
}

export function Proximamente({
  actividad, evento, cuentaAtras, onActividad, onEvento,
}: {
  actividad: EventoCalendario | null
  evento: EventoCalendario | null
  cuentaAtras: { texto: string; especial: boolean } | null
  onActividad: () => void
  onEvento: () => void
}) {
  if (!actividad && !evento && !cuentaAtras) return null
  const contenido = (
    <div className="flex flex-col gap-2.5">
      {actividad && <ProximaActividad actividad={actividad} onClick={onActividad} />}
      {evento && <ProximoEvento evento={evento} onClick={onEvento} />}
      {cuentaAtras && <CuentaAtras {...cuentaAtras} />}
    </div>
  )
  if (!actividad && !evento) return contenido
  return <Seccion titulo="Próximamente">{contenido}</Seccion>
}

export function Dudas({ dudas, onNavigate }: { dudas: DudaInicio[]; onNavigate: (to: string) => void }) {
  const azul = '#60a5fa'
  return (
    <Seccion
      titulo="Dudas de la comunidad"
      subtitulo="Ayuda a un compañero o lanza tu pregunta"
      extra={<EnlaceAccion onClick={() => onNavigate('/foro')}>Ver foro <ChevronRight size={13} className="inline" aria-hidden="true" /></EnlaceAccion>}
    >
      {dudas.length === 0 ? (
        <button
          onClick={() => onNavigate('/foro')}
          className={cn('rounded-2xl border border-dashed border-ov/[0.15] px-4 py-5 text-left transition-colors hover:bg-ov/[0.03]', FOCO)}
        >
          <p className="text-sm font-semibold text-text-primary">No hay dudas abiertas ahora mismo</p>
          <p className="mt-1 text-xs text-text-muted">Sé el primero en preguntar algo al grupo.</p>
        </button>
      ) : (
        <ul className={cn(SUPERFICIE, 'divide-y divide-ov/[0.06] overflow-hidden')}>
          {dudas.map(duda => (
            <li key={duda.id}>
              <button
                onClick={() => onNavigate(`/foro/${duda.id}`)}
                className={cn('group w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-ov/[0.04] focus-visible:bg-ov/[0.04]', FOCO, 'focus-visible:ring-inset focus-visible:ring-offset-0')}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold leading-snug text-text-primary line-clamp-2 group-hover:text-primary-light">{duda.titulo}</p>
                  <p className="mt-1 flex items-center gap-2 text-xs text-text-muted">
                    <span>Por {duda.autor}</span>
                    <span className="text-text-faint" aria-hidden="true">·</span>
                    <span className="flex items-center gap-1" style={{ color: tinta(azul) }}>
                      <MessageCircle size={12} aria-hidden="true" />
                      {duda.foro_respuestas?.length ?? 0} respuestas
                    </span>
                  </p>
                </div>
                <ChevronRight size={15} className="shrink-0 text-text-faint transition-transform motion-safe:group-hover:translate-x-0.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Seccion>
  )
}
