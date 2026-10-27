// Acceso a datos con service_role (se salta la RLS). Por eso las comprobaciones
// de permisos de la RLS de `eventos` se replican en la RPC `crear_evento_telegram`
// (atomica) y, para los mensajes de texto, en `obtenerAutorizacion`.

import { createClient } from 'npm:@supabase/supabase-js@2.101.1'
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.101.1'

import { esTipoEvento } from './tipos.ts'
import type { TipoEvento } from './tipos.ts'

const PENDIENTE_MINUTOS = 30

let cliente: SupabaseClient | null = null

export function getDb(): SupabaseClient {
  if (cliente) return cliente
  const url = Deno.env.get('SUPABASE_URL')
  const clave = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !clave) throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  cliente = createClient(url, clave, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cliente
}

export type Paso = 'tipo' | 'materia' | 'fecha' | 'confirmar' | 'descripcion'

export interface PayloadPendiente {
  titulo: string
  tipo: TipoEvento | null
  materia: string | null
  fecha: string | null
  hora: string | null
  /** Opcional; se añade desde el resumen final */
  descripcion: string | null
  paso: Paso
}

const PASOS: readonly Paso[] = ['tipo', 'materia', 'fecha', 'confirmar', 'descripcion']

/** Normaliza un payload leido de la BD; null si esta corrupto. */
function leerPayload(raw: unknown): PayloadPendiente | null {
  const p = raw as Partial<Record<keyof PayloadPendiente, unknown>> | null
  if (!p || typeof p.titulo !== 'string' || !PASOS.includes(p.paso as Paso)) return null
  return {
    titulo: p.titulo,
    tipo: esTipoEvento(p.tipo) ? p.tipo : null,
    materia: typeof p.materia === 'string' ? p.materia : null,
    fecha: typeof p.fecha === 'string' ? p.fecha : null,
    hora: typeof p.hora === 'string' ? p.hora : null,
    descripcion: typeof p.descripcion === 'string' ? p.descripcion : null,
    paso: p.paso as Paso,
  }
}

export type Autorizacion =
  | { estado: 'no_vinculado' }
  | { estado: 'sin_permiso'; usuarioId: string }
  | { estado: 'admin'; usuarioId: string; clase: string }

/** Devuelve el usuario vinculado y si puede crear eventos (admin + clase + aprobado). */
export async function obtenerAutorizacion(telegramId: number): Promise<Autorizacion> {
  const db = getDb()
  const { data: vinculo, error: e1 } = await db
    .from('telegram_vinculos')
    .select('usuario_id')
    .eq('telegram_user_id', telegramId)
    .maybeSingle()
  if (e1) throw e1
  if (!vinculo) return { estado: 'no_vinculado' }

  const usuarioId = vinculo.usuario_id as string
  const { data: usuario, error: e2 } = await db
    .from('usuarios')
    .select('rol, clase, estado_acceso')
    .eq('id', usuarioId)
    .maybeSingle()
  if (e2) throw e2

  if (
    !usuario ||
    usuario.rol !== 'admin' ||
    !usuario.clase ||
    usuario.estado_acceso !== 'aprobado'
  ) {
    return { estado: 'sin_permiso', usuarioId }
  }
  return { estado: 'admin', usuarioId, clase: usuario.clase as string }
}

/** Clase de un usuario vinculado y aprobado (para /proximos); null si no aplica. */
export async function claseDeVinculado(telegramId: number): Promise<string | null> {
  const db = getDb()
  const { data: vinculo, error: e1 } = await db
    .from('telegram_vinculos')
    .select('usuario_id')
    .eq('telegram_user_id', telegramId)
    .maybeSingle()
  if (e1) throw e1
  if (!vinculo) return null
  const { data: usuario, error: e2 } = await db
    .from('usuarios')
    .select('clase, estado_acceso')
    .eq('id', vinculo.usuario_id)
    .maybeSingle()
  if (e2) throw e2
  if (!usuario || !usuario.clase || usuario.estado_acceso !== 'aprobado') return null
  return usuario.clase as string
}

export interface ResultadoVinculo {
  /** Telegram ID del vinculo previo del usuario, si era otro; null si no. */
  telegramAnterior: number | null
}

/** Canjea un codigo de vinculacion. null si falla; si acierta, datos del vinculo. */
export async function consumirCodigo(
  codigo: string,
  telegramId: number,
  username: string | null,
): Promise<ResultadoVinculo | null> {
  const { data, error } = await getDb().rpc('consumir_codigo_telegram', {
    p_codigo: codigo,
    p_telegram_id: telegramId,
    p_telegram_username: username,
  })
  if (error) throw error
  const fila = Array.isArray(data) ? data[0] : data
  if (!fila || typeof fila.usuario_id !== 'string') return null
  const ant = fila.telegram_anterior
  return { telegramAnterior: ant === null || ant === undefined ? null : Number(ant) }
}

/** Borra el vinculo y sus pendientes. */
export async function desvincular(telegramId: number): Promise<void> {
  const db = getDb()
  const { error: e1 } = await db.from('telegram_pendientes').delete().eq('telegram_user_id', telegramId)
  if (e1) throw e1
  const { error: e2 } = await db.from('telegram_vinculos').delete().eq('telegram_user_id', telegramId)
  if (e2) throw e2
}

function expiraEn(): string {
  return new Date(Date.now() + PENDIENTE_MINUTOS * 60_000).toISOString()
}

/** Empieza un asistente nuevo: borra los pendientes anteriores del usuario. */
export async function iniciarAsistente(telegramId: number, titulo: string): Promise<string> {
  const db = getDb()
  const { error: e0 } = await db.from('telegram_pendientes').delete().eq('telegram_user_id', telegramId)
  if (e0) throw e0
  const payload: PayloadPendiente = {
    titulo, tipo: null, materia: null, fecha: null, hora: null, descripcion: null, paso: 'tipo',
  }
  const { data, error } = await db
    .from('telegram_pendientes')
    .insert({ telegram_user_id: telegramId, payload, expira_en: expiraEn() })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

/** Pendiente mas reciente del usuario que espera texto (paso 'fecha' o 'descripcion') y sin caducar. */
export async function pendienteEsperandoTexto(
  telegramId: number,
): Promise<{ id: string; payload: PayloadPendiente } | null> {
  const { data, error } = await getDb()
    .from('telegram_pendientes')
    .select('id, payload')
    .eq('telegram_user_id', telegramId)
    .in('payload->>paso', ['fecha', 'descripcion'])
    .gt('expira_en', new Date().toISOString())
    .order('expira_en', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const payload = leerPayload(data.payload)
  return payload ? { id: data.id as string, payload } : null
}

/**
 * Avanza el pendiente: solo si es de quien pulsa, no ha caducado y esta en el
 * paso esperado (el UPDATE repite esos filtros). Renueva la caducidad.
 * 'otro_paso' = boton viejo (se ignora); null = no existe, ajeno o caducado.
 */
export async function avanzarPendiente(
  id: string,
  telegramId: number,
  pasoEsperado: Paso,
  cambios: Partial<Omit<PayloadPendiente, 'titulo'>>,
): Promise<PayloadPendiente | 'otro_paso' | null> {
  const db = getDb()
  const { data, error } = await db
    .from('telegram_pendientes')
    .select('payload')
    .eq('id', id)
    .eq('telegram_user_id', telegramId)
    .gt('expira_en', new Date().toISOString())
    .maybeSingle()
  if (error) throw error
  const actual = data ? leerPayload(data.payload) : null
  if (!actual) return null
  if (actual.paso !== pasoEsperado) return 'otro_paso'
  const nuevo: PayloadPendiente = { ...actual, ...cambios }
  const { data: upd, error: e2 } = await db
    .from('telegram_pendientes')
    .update({ payload: nuevo, expira_en: expiraEn() })
    .eq('id', id)
    .eq('telegram_user_id', telegramId)
    .eq('payload->>paso', pasoEsperado)
    .gt('expira_en', new Date().toISOString())
    .select('id')
    .maybeSingle()
  if (e2) throw e2
  return upd ? nuevo : null
}

/**
 * Consume el pendiente de forma atomica (DELETE ... RETURNING), solo si esta en
 * paso 'confirmar'. Filtra por id Y por quien pulsa. null si no existe, no es
 * suyo, ha caducado o no esta en ese paso.
 */
export async function consumirPendiente(id: string, telegramId: number): Promise<PayloadPendiente | null> {
  const { data, error } = await getDb()
    .from('telegram_pendientes')
    .delete()
    .eq('id', id)
    .eq('telegram_user_id', telegramId)
    .eq('payload->>paso', 'confirmar')
    .gt('expira_en', new Date().toISOString())
    .select('payload')
    .maybeSingle()
  if (error) throw error
  return data ? leerPayload(data.payload) : null
}

/** Descarta un pendiente (boton cancelar), solo si es del usuario. */
export async function descartarPendiente(id: string, telegramId: number): Promise<void> {
  const { error } = await getDb()
    .from('telegram_pendientes')
    .delete()
    .eq('id', id)
    .eq('telegram_user_id', telegramId)
  if (error) throw error
}

/**
 * Crea el evento de forma atomica via RPC (revalida admin, clase y aprobado).
 * Devuelve el id del evento o null si no esta autorizado.
 */
export async function crearEventoTelegram(
  telegramId: number,
  p: {
    titulo: string
    fecha: string
    hora: string | null
    materia: string | null
    tipo: TipoEvento
    descripcion: string | null
  },
): Promise<string | null> {
  const { data, error } = await getDb().rpc('crear_evento_telegram', {
    p_telegram_id: telegramId,
    p_titulo: p.titulo,
    p_fecha: p.fecha,
    p_hora: p.hora,
    p_materia: p.materia,
    p_tipo: p.tipo,
    p_descripcion: p.descripcion,
  })
  if (error) throw error
  return typeof data === 'string' && data.length > 0 ? data : null
}

export interface EventoResumen {
  titulo: string
  fecha: string
  hora: string | null
  materia: string | null
  tipo: string | null
}

export async function proximosEventos(clase: string, desdeIso: string, limite = 10): Promise<EventoResumen[]> {
  const { data, error } = await getDb()
    .from('eventos')
    .select('titulo, fecha, hora, materia, tipo')
    .eq('clase', clase)
    .gte('fecha', desdeIso)
    .order('fecha', { ascending: true })
    .order('hora', { ascending: true, nullsFirst: true })
    .limit(limite)
  if (error) throw error
  return (data ?? []) as EventoResumen[]
}
