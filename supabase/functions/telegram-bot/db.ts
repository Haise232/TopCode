// Acceso a datos con service_role (se salta la RLS). Por eso las comprobaciones
// de permisos de la RLS de `eventos` se replican en la RPC `crear_evento_telegram`
// (atomica) y, para los mensajes de texto, en `obtenerAutorizacion`.

import { createClient } from 'npm:@supabase/supabase-js@2.101.1'
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.101.1'

const PENDIENTE_MINUTOS = 10

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

export interface PayloadPendiente {
  titulo: string
  fecha: string
  hora: string | null
  materia: string | null
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

export async function guardarPendiente(telegramId: number, payload: PayloadPendiente): Promise<string> {
  const db = getDb()
  // Limpieza oportunista de pendientes caducados de este usuario.
  await db
    .from('telegram_pendientes')
    .delete()
    .eq('telegram_user_id', telegramId)
    .lt('expira_en', new Date().toISOString())

  const expira = new Date(Date.now() + PENDIENTE_MINUTOS * 60_000).toISOString()
  const { data, error } = await db
    .from('telegram_pendientes')
    .insert({ telegram_user_id: telegramId, payload, expira_en: expira })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

/**
 * Consume el pendiente de forma atomica (DELETE ... RETURNING): solo una
 * llamada concurrente obtiene la fila. Filtra por id Y por quien pulsa.
 * Devuelve null si no existe, no es suyo o ha caducado.
 */
export async function consumirPendiente(id: string, telegramId: number): Promise<PayloadPendiente | null> {
  const { data, error } = await getDb()
    .from('telegram_pendientes')
    .delete()
    .eq('id', id)
    .eq('telegram_user_id', telegramId)
    .gt('expira_en', new Date().toISOString())
    .select('payload')
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const p = data.payload as Partial<PayloadPendiente> | null
  if (!p || typeof p.titulo !== 'string' || typeof p.fecha !== 'string') return null
  return {
    titulo: p.titulo,
    fecha: p.fecha,
    hora: typeof p.hora === 'string' ? p.hora : null,
    materia: typeof p.materia === 'string' ? p.materia : null,
  }
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
export async function crearEventoTelegram(telegramId: number, p: PayloadPendiente): Promise<string | null> {
  const { data, error } = await getDb().rpc('crear_evento_telegram', {
    p_telegram_id: telegramId,
    p_titulo: p.titulo,
    p_fecha: p.fecha,
    p_hora: p.hora,
    p_materia: p.materia,
  })
  if (error) throw error
  return typeof data === 'string' && data.length > 0 ? data : null
}

export interface EventoResumen {
  titulo: string
  fecha: string
  hora: string | null
  materia: string | null
}

export async function proximosEventos(clase: string, desdeIso: string, limite = 10): Promise<EventoResumen[]> {
  const { data, error } = await getDb()
    .from('eventos')
    .select('titulo, fecha, hora, materia')
    .eq('clase', clase)
    .gte('fecha', desdeIso)
    .order('fecha', { ascending: true })
    .order('hora', { ascending: true, nullsFirst: true })
    .limit(limite)
  if (error) throw error
  return (data ?? []) as EventoResumen[]
}
