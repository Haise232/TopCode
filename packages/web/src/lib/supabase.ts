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
    // Sin `lock` propio: supabase-js usa el LockManager del navegador y renueva la sesión de una en una, también entre
    // pestañas. Con un lock vacío varias renovaciones salían a la vez con el mismo token; Supabase lo toma como un
    // token reutilizado y cierra la sesión (pasó el 20/10/2026 con Supabase lento: echó a la gente de TopCode).
  },
  global: {
    fetch: (url: RequestInfo | URL, options?: RequestInit) => {
      // Las subidas a Storage (apuntes de hasta 20 MB) necesitan mucho más de 8s
      // en conexiones lentas; el resto de peticiones mantiene el timeout corto.
      // Auth tampoco se corta a los 8 s: si se aborta una renovación de sesión que el servidor ya hizo, el reintento
      // llega con el token viejo y Supabase cierra la sesión. Mejor esperar a que conteste.
      const ruta = String(url instanceof Request ? url.url : url)
      const esStorage = ruta.includes('/storage/v1/')
      const esAuth = ruta.includes('/auth/v1/')
      const timeout = AbortSignal.timeout(esStorage ? 120_000 : esAuth ? 30_000 : 8000)
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
