import { createClient } from '@supabase/supabase-js'
import { initSupabase } from '@topcode/shared'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltan variables de entorno VITE_SUPABASE_URL y/o VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    storageKey: 'topcode-session',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    lock: (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => fn(),
  },
  global: {
    fetch: (url: RequestInfo | URL, options?: RequestInit) => {
      // Las subidas a Storage (apuntes de hasta 20 MB) necesitan mucho más de 8s
      // en conexiones lentas; el resto de peticiones mantiene el timeout corto.
      const esStorage = String(url instanceof Request ? url.url : url).includes('/storage/v1/')
      const timeout = AbortSignal.timeout(esStorage ? 120_000 : 8000)
      // Respetar también el signal del llamador (.abortSignal()) en lugar de pisarlo
      const signal = options?.signal && 'any' in AbortSignal
        ? AbortSignal.any([options.signal, timeout])
        : options?.signal ?? timeout
      return fetch(url, { ...options, signal })
    },
  },
})

// Registrar el cliente en el singleton compartido para los hooks de @topcode/shared
initSupabase(supabase)

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
