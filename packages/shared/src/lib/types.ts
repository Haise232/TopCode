import { ClaseId } from '../constants/clases'

export interface Usuario {
  id: string
  nombre: string
  email: string
  promedio: number
  avatar_url: string | null
  banner_url: string | null
  rol: 'alumno' | 'admin'
  clase: ClaseId | null
  es_superadmin: boolean
  created_at: string
}

// Perfil público: solo los campos expuestos por la vista usuarios_publicos
export interface UsuarioPublico {
  id: string
  nombre: string
  avatar_url: string | null
  rol: 'alumno' | 'admin'
}

export interface Nota {
  id: string
  usuario_id: string
  materia: string
  tema: string
  teorica: number
  practica: number
  media: number
  created_at: string
}

export interface Noticia {
  id: string
  titulo: string
  descripcion: string
  url_fuente: string
  url_imagen: string | null
  created_by: string
  created_at: string
}

export interface Mensaje {
  id: string
  usuario_id: string
  autor: string
  texto: string
  editado: boolean
  eliminado: boolean
  created_at: string
}

export interface MensajePrivado {
  id: string
  de_id: string
  de_nombre: string
  para_id: string
  texto: string
  created_at: string
}

export interface Apunte {
  id: string
  usuario_id: string
  nombre: string
  url: string
  tipo: 'pdf' | 'imagen' | 'otro'
  materia: string | null
  created_at: string
}

export interface EventoCalendario {
  id: string
  titulo: string
  descripcion: string | null
  materia: string | null
  fecha: string
  hora: string | null
  created_by: string
  created_at: string
}

export interface Actividad {
  id: string
  titulo: string
  descripcion: string | null
  materia: string | null
  fecha_entrega: string
  created_by: string | null
  created_at: string
}

export interface ActividadEstado {
  actividad_id: string
  usuario_id: string
  completada: boolean
  updated_at: string
}

export interface Anuncio {
  id: string
  titulo: string
  contenido: string
  activo: boolean
  created_at: string
  created_by: string
}

export interface HorarioClase {
  id: string
  clase: ClaseId
  dia_semana: number // 1=lunes .. 5=viernes
  hora_inicio: string // 'HH:MM'
  hora_fin: string // 'HH:MM'
  materia: string
  codigo: string
  created_at: string
}
