import { createClient } from '@supabase/supabase-js'

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
    // Forzar localStorage explícitamente para garantizar persistencia
    // entre sesiones del navegador (no se borra al cerrar pestaña).
    storage: window.localStorage,
    storageKey: 'topcode-session',
    // Bypasa navigator.locks para evitar bloqueos de 5s en HMR / dev
    // y cuando hay locks huérfanos de tabs/instancias anteriores.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    lock: (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => fn(),
  },
  global: {
    // Timeout explícito de 8s para todas las queries. Sin esto, una query
    // colgada (proyecto pausado, red inestable) bloquea la UI indefinidamente.
    fetch: (url: RequestInfo | URL, options?: RequestInit) =>
      fetch(url, { ...options, signal: AbortSignal.timeout(8000) }),
  },
})


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
