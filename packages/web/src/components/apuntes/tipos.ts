import { File, FileText, Image, type LucideIcon } from 'lucide-react'
import type { ApunteConAutor } from '../../hooks/useApuntes'

export type TipoApunte = ApunteConAutor['tipo']
export type FiltroTipo = 'todos' | TipoApunte

export function tipoFromMime(mime: string): TipoApunte {
  if (mime === 'application/pdf') return 'pdf'
  if (mime.startsWith('image/')) return 'imagen'
  return 'otro'
}

/** Color semántico por tipo de archivo (se pinta con tinta()/mez() para ambos modos). */
export const TIPO_CONFIG: Record<TipoApunte, { Icon: LucideIcon; color: string; label: string; nombre: string }> = {
  pdf:    { Icon: FileText, color: '#f43f5e', label: 'PDF',  nombre: 'PDF' },
  imagen: { Icon: Image,    color: '#0ea5e9', label: 'IMG',  nombre: 'Imagen' },
  otro:   { Icon: File,     color: '#818cf8', label: 'FILE', nombre: 'Otro' },
}

export function extension(ap: Pick<ApunteConAutor, 'nombre' | 'tipo'>) {
  const raw = ap.nombre.includes('.') ? ap.nombre.split('.').pop() ?? '' : ''
  return raw.length > 0 && raw.length <= 5 ? raw.toUpperCase() : TIPO_CONFIG[ap.tipo].label
}

export function fechaCorta(iso: string) {
  return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
}
