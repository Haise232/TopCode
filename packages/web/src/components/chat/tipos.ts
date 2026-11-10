/** Mensaje ya preparado para pintarse (el mismo formato para canal y mensajes privados). */
export interface ItemMensaje {
  id: string
  autorId: string
  autor: string
  avatarUrl?: string | null
  texto: string
  /** Hora ya formateada («14:05»). */
  hora: string
  /** Etiqueta del día («Hoy», «Ayer», «3 de noviembre»): separa y agrupa mensajes. */
  dia: string
  editado?: boolean
  eliminado?: boolean
  mio: boolean
}

export interface UsuarioLista {
  id: string
  nombre: string
  avatar_url: string | null
}
