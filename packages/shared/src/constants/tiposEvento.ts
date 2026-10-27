export type TipoEvento =
  | 'actividad'
  | 'trabajo'
  | 'examen_teorico'
  | 'examen_practico'
  | 'presentacion'
  | 'especial'

export const TIPOS_EVENTO: { id: TipoEvento; label: string; descripcion: string }[] = [
  { id: 'actividad',       label: 'Actividad',        descripcion: 'Entrega o tarea' },
  { id: 'trabajo',          label: 'Trabajo',          descripcion: 'Trabajo o proyecto' },
  { id: 'examen_teorico',  label: 'Examen teórico',   descripcion: 'Prueba escrita' },
  { id: 'examen_practico', label: 'Examen práctico',  descripcion: 'Prueba en ordenador' },
  { id: 'presentacion',    label: 'Presentación',     descripcion: 'Exposición oral' },
  { id: 'especial',        label: 'Especial',         descripcion: 'Charla, taller u otro' },
]

/** Tipos que se muestran en la vista "Actividades" (con seguimiento de completado). */
export const TIPOS_ACTIVIDAD: TipoEvento[] = ['actividad', 'trabajo']
/** Tipos que se muestran en la vista "Exámenes". */
export const TIPOS_EXAMEN: TipoEvento[] = ['examen_teorico', 'examen_practico', 'presentacion', 'especial']

export function esTipoActividad(tipo: string | null | undefined): boolean {
  return tipo == null || tipo === 'actividad' || tipo === 'trabajo'
}

/** Fecha límite de un evento: su fecha + hora (o final del día si no tiene hora). */
export function fechaLimiteEvento(ev: { fecha: string; hora: string | null }): Date {
  return new Date(`${ev.fecha}T${ev.hora ? ev.hora.slice(0, 5) : '23:59'}:00`)
}
