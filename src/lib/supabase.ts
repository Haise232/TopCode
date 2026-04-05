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
    // Bypasa navigator.locks para evitar bloqueos de 5s en HMR / dev
    // y cuando hay locks huérfanos de tabs/instancias anteriores.
    // En producción es seguro: la intranet no necesita sincronización multi-tab.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    lock: (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => fn(),
  },
})

export async function actualizarPromedio(userId: string): Promise<void> {
  const { data: notas, error } = await supabase
    .from('notas')
    .select('media')
    .eq('usuario_id', userId)

  if (error || !notas) return

  const promedio = notas.length > 0
    ? notas.reduce((acc, n) => acc + n.media, 0) / notas.length
    : 0

  await supabase
    .from('usuarios')
    .update({ promedio: Math.round(promedio * 100) / 100 })
    .eq('id', userId)
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
