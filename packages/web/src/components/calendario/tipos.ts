import type { TipoEvento } from '@topcode/shared'

export type Vista = 'examenes' | 'actividades'
export type FiltroEstado = 'todas' | 'pendientes' | 'hechas'

export type FormState = {
  titulo: string
  descripcion: string
  materia: string
  fecha: string
  hora: string
  tipo: TipoEvento
}

/** Estado de una actividad para el alumno (y recuento para el admin). */
export type EstadoActividad = {
  completada: boolean
  toggling: boolean
  onToggle: () => void
  adminCount: number | null
  totalAlumnos: number
}

export const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]
export const MESES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

export function formatFecha(fecha: string) {
  const [y, m, d] = fecha.split('-')
  return `${parseInt(d)} de ${MESES[parseInt(m) - 1]} de ${y}`
}

export function formatFechaPreview(fecha: string) {
  if (!fecha) return ''
  const [y, m, d] = fecha.split('-')
  const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
  return `${DIAS[date.getDay()]}, ${parseInt(d)} de ${MESES[parseInt(m) - 1]} de ${y}`
}

export function fechaRelativa(fecha: string) {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const ev = new Date(fecha + 'T00:00:00')
  const diff = Math.round((ev.getTime() - hoy.getTime()) / 86400000)
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Mañana'
  if (diff === -1) return 'Ayer'
  if (diff > 1) return `En ${diff} días`
  return `Hace ${Math.abs(diff)} días`
}

export function primerDiaMes(year: number, month: number): number {
  const d = new Date(year, month, 1).getDay()
  return d === 0 ? 6 : d - 1
}

export function diasEnMes(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}
