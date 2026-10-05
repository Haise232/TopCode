import { FileText, Briefcase, BookOpen, Terminal, Presentation, Sparkles, type LucideIcon } from 'lucide-react'
import type { TipoEvento } from '@topcode/shared'

export interface TipoEventoVisual {
  label: string
  color: string
  bg: string
  border: string
  Icon: LucideIcon
}

function visual(label: string, color: string, Icon: LucideIcon): TipoEventoVisual {
  return {
    label,
    color,
    bg: `color-mix(in srgb, ${color} 14%, transparent)`,
    border: `color-mix(in srgb, ${color} 32%, transparent)`,
    Icon,
  }
}

export const TIPO_EVENTO_CONFIG: Record<TipoEvento, TipoEventoVisual> = {
  actividad:       visual('Actividad',       'var(--color-primary)', FileText),
  trabajo:         visual('Trabajo',         '#38bdf8',              Briefcase),
  examen_teorico:  visual('Examen teórico',  'var(--color-rose)',    BookOpen),
  examen_practico: visual('Examen práctico', '#fb923c',              Terminal),
  presentacion:    visual('Presentación',    '#a78bfa',              Presentation),
  especial:        visual('Especial',        'var(--color-warning)', Sparkles),
}

/** Devuelve la config visual; tipos desconocidos/ausentes caen en 'actividad'. */
export function tipoEventoConfig(tipo: string | null | undefined): TipoEventoVisual {
  return TIPO_EVENTO_CONFIG[(tipo ?? 'actividad') as TipoEvento] ?? TIPO_EVENTO_CONFIG.actividad
}

export function TipoEventoBadge({ tipo, className = '' }: { tipo: string | null | undefined; className?: string }) {
  const cfg = tipoEventoConfig(tipo)
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md whitespace-nowrap ${className}`}
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
    >
      <cfg.Icon size={11} aria-hidden="true" />
      {cfg.label}
    </span>
  )
}
