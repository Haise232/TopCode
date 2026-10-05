// Supabase singleton
export { initSupabase, getSupabase, actualizarPromedio } from './lib/supabase'

// Types
export type {
  Usuario,
  UsuarioPublico,
  Nota,
  Mensaje,
  MensajePrivado,
  Apunte,
  EventoCalendario,
  Actividad,
  ActividadEstado,
  Anuncio,
  HorarioClase,
  Recurso,
  ForoPost,
  ForoRespuesta,
} from './lib/types'

// Cache
export { cacheGet, cacheSet, cacheInvalidate, cacheInvalidatePrefix } from './lib/cache'

// Constants
export type { ClaseId, ClaseInfo } from './constants/clases'
export { CLASES, CLASE_UNICA, claseInfo } from './constants/clases'
export type { TipoEvento } from './constants/tiposEvento'
export { TIPOS_EVENTO, TIPOS_ACTIVIDAD, TIPOS_EXAMEN, esTipoActividad, fechaLimiteEvento } from './constants/tiposEvento'
export type { Materia } from './constants/materias'
export { MATERIAS } from './constants/materias'

// Hooks
export { useDataInit } from './hooks/useDataInit'
export { useEventos } from './hooks/useEventos'
export { useEventosEstado } from './hooks/useEventosEstado'
export type { UseEventosEstadoReturn } from './hooks/useEventosEstado'
export { useTelegramVinculo } from './hooks/useTelegramVinculo'
export type { CodigoTelegram } from './hooks/useTelegramVinculo'
export { useActividades } from './hooks/useActividades'
export { useHomeDatos } from './hooks/useHomeDatos'
export { useHorario } from './hooks/useHorario'
export { usePublicMensajes, usePrivateMensajes } from './hooks/useMensajes'
export { useNotas } from './hooks/useNotas'
export { useRecursos } from './hooks/useRecursos'
export { useForoPosts, useForoPost } from './hooks/useForo'
