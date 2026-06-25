import type { SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

export function initSupabase(client: SupabaseClient): void {
  _client = client
}

export function getSupabase(): SupabaseClient {
  if (!_client) throw new Error('[TopCode] Llama a initSupabase() antes de usar Supabase')
  return _client
}

export async function actualizarPromedio(usuarioId: string): Promise<void> {
  await getSupabase().rpc('recalcular_promedio', { p_usuario_id: usuarioId })
}
