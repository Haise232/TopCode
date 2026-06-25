// Supabase singleton
export { initSupabase, getSupabase, actualizarPromedio } from './lib/supabase'

// Types
export type {
  Usuario,
  UsuarioPublico,
  Nota,
  Noticia,
  Mensaje,
  MensajePrivado,
  Apunte,
  EventoCalendario,
  Actividad,
  ActividadEstado,
  Anuncio,
  HorarioClase,
} from './lib/types'

// Cache
export { cacheGet, cacheSet, cacheInvalidate, cacheInvalidatePrefix } from './lib/cache'

// Constants
export type { Ciclo, Grupo, ClaseId, ClaseInfo } from './constants/clases'
export { CLASES, CLASE_GROUPS, claseInfo } from './constants/clases'
export type { Materia } from './constants/materias'
export { MATERIAS } from './constants/materias'

// Hooks
export { useDataInit } from './hooks/useDataInit'
export { useEventos } from './hooks/useEventos'
export { useActividades } from './hooks/useActividades'
export { useHomeDatos } from './hooks/useHomeDatos'
export { useHorario } from './hooks/useHorario'
export { usePublicMensajes, usePrivateMensajes } from './hooks/useMensajes'
export { useNotas } from './hooks/useNotas'
