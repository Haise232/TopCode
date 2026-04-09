export interface Usuario {
  id: string
  nombre: string
  email: string
  promedio: number
  avatar_url: string | null
  banner_url: string | null
  rol: 'alumno' | 'admin'
  es_superadmin: boolean
  created_at: string
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
  created_at: string
}

export interface EventoCalendario {
  id: string
  titulo: string
  descripcion: string | null
  materia: string | null
  fecha: string
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
