// IMPORTANTE: copia de packages/shared/src/constants/tiposEvento.ts.
// Deno no resuelve `@topcode/shared`, asi que se duplica aqui.
// El orden importa (el handler usa el indice). MANTENER SINCRONIZADO con ese archivo: si cambia alli, cambiarlo tambien aqui.

export type TipoEvento = 'actividad' | 'trabajo' | 'examen_teorico' | 'examen_practico' | 'presentacion' | 'especial'

export const TIPOS_EVENTO: readonly { id: TipoEvento; label: string; emoji: string }[] = [
  { id: 'actividad', label: 'Actividad', emoji: '📝' },
  { id: 'trabajo', label: 'Trabajo', emoji: '📁' },
  { id: 'examen_teorico', label: 'Examen teórico', emoji: '📖' },
  { id: 'examen_practico', label: 'Examen práctico', emoji: '💻' },
  { id: 'presentacion', label: 'Presentación', emoji: '🎤' },
  { id: 'especial', label: 'Especial', emoji: '⭐' },
]

export function esTipoEvento(x: unknown): x is TipoEvento {
  return typeof x === 'string' && TIPOS_EVENTO.some((t) => t.id === x)
}

export function etiquetaTipo(t: TipoEvento): string {
  return TIPOS_EVENTO.find((x) => x.id === t)?.label ?? t
}
