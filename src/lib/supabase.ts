import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ── Environment validation ────────────────────────────────────────────────────
// Validate at module-load time so a missing variable fails loudly in both dev
// and CI rather than producing cryptic runtime errors later.
function requireEnv(key: string): string {
  const value = import.meta.env[key] as string | undefined
  if (!value) {
    throw new Error(
      `Missing environment variable: ${key}\n` +
      'Create a .env.local file at the project root based on .env.example.',
    )
  }
  return value
}

const supabaseUrl     = requireEnv('VITE_SUPABASE_URL')
const supabaseAnonKey = requireEnv('VITE_SUPABASE_ANON_KEY')

// ── Singleton guard ───────────────────────────────────────────────────────────
// Vite HMR re-executes modules on every hot-update.  Without this guard, each
// save would create a new Supabase client, leaking realtime subscriptions and
// triggering duplicate auth-lock acquisitions (the 5-second timeout visible in
// dev tools).  We attach the singleton to `globalThis` so it survives module
// re-evaluations while remaining type-safe.
declare global {
  // eslint-disable-next-line no-var
  var __supabaseClient: SupabaseClient | undefined
}

function getSupabaseClient(): SupabaseClient {
  if (globalThis.__supabaseClient) return globalThis.__supabaseClient

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      // Forzar localStorage explícitamente para garantizar persistencia
      // entre sesiones del navegador (no se borra al cerrar pestaña).
      storage: window.localStorage,
      storageKey: 'topcode-session',
      // Bypasa navigator.locks para evitar bloqueos de 5s en HMR / dev
      // y cuando hay locks huérfanos de tabs/instancias anteriores.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      lock: (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => fn(),
    },
  })

  globalThis.__supabaseClient = client
  return client
}

export const supabase = getSupabaseClient()

// actualizarPromedio — usa una función RPC que ejecuta SELECT AVG + UPDATE
// en una sola round-trip al servidor, en lugar de dos queries separadas.
// La función SQL correspondiente está en supabase/setup.sql (recalcular_promedio).
export async function actualizarPromedio(userId: string): Promise<void> {
  await supabase.rpc('recalcular_promedio', { p_usuario_id: userId })
}

export async function subirArchivo(
  file: File,
  path: string,
): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from('apuntes')
      .upload(path, file, { contentType: file.type, upsert: false })

    if (error) throw error

    const { data: publicUrl } = supabase.storage
      .from('apuntes')
      .getPublicUrl(data.path)

    return publicUrl.publicUrl
  } catch {
    return null
  }
}

export async function subirAvatar(
  file: File,
  path: string,
): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from('avatars')
      .upload(path, file, { contentType: file.type, upsert: true })

    if (error) throw error

    const { data: publicUrl } = supabase.storage
      .from('avatars')
      .getPublicUrl(data.path)

    return publicUrl.publicUrl
  } catch {
    return null
  }
}

export async function eliminarArchivoStorage(
  bucket: 'apuntes' | 'avatars',
  path: string,
): Promise<void> {
  await supabase.storage.from(bucket).remove([path])
}
