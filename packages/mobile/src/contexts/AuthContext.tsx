import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { Session, User } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '../lib/supabase'
import type { Usuario } from '@topcode/shared'

const AUTH_TIMEOUT_MS = 8000
const USUARIO_CACHE_KEY = 'topcode-usuario-cache'

async function getCachedUsuario(): Promise<Usuario | null> {
  try {
    const raw = await AsyncStorage.getItem(USUARIO_CACHE_KEY)
    return raw ? (JSON.parse(raw) as Usuario) : null
  } catch {
    return null
  }
}

async function setCachedUsuario(u: Usuario | null): Promise<void> {
  try {
    if (u) await AsyncStorage.setItem(USUARIO_CACHE_KEY, JSON.stringify(u))
    else await AsyncStorage.removeItem(USUARIO_CACHE_KEY)
  } catch { /* ignore */ }
}

interface AuthContextValue {
  session: Session | null
  user: User | null
  usuario: Usuario | null
  loading: boolean
  refreshUsuario: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  usuario: null,
  loading: true,
  refreshUsuario: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)
  const fetchCountRef = useRef(0)

  const fetchUsuario = useCallback(async (
    userId: string,
    userEmail?: string,
    userMeta?: Record<string, unknown>,
  ) => {
    const currentFetch = ++fetchCountRef.current

    const getPerfil = async () => {
      try {
        const { data, error } = await supabase.rpc('get_mi_perfil')
        return { data: (data as Usuario[] | null)?.[0] ?? null, error }
      } catch (err) {
        return { data: null as Usuario | null, error: err }
      }
    }

    try {
      const { data, error } = await getPerfil()
      if (currentFetch !== fetchCountRef.current) return

      if (data && !error) {
        await setCachedUsuario(data)
        setUsuario(data)
        return
      }

      if (!data && !error) {
        const nombre = (userMeta?.nombre as string | undefined)
          ?? (userMeta?.full_name as string | undefined)
          ?? (userEmail?.split('@')[0] ?? 'Usuario')

        const { error: upsertError } = await supabase
          .from('usuarios')
          .upsert({
            id: userId,
            nombre,
            email: userEmail ?? '',
            promedio: 0,
            avatar_url: null,
            rol: 'alumno',
            estado_acceso: 'pendiente',
          })

        if (currentFetch !== fetchCountRef.current) return

        if (!upsertError) {
          const { data: result } = await getPerfil()
          if (currentFetch !== fetchCountRef.current) return
          await setCachedUsuario(result)
          setUsuario(result)
          return
        }

        const { data: result } = await getPerfil()
        if (currentFetch !== fetchCountRef.current) return
        await setCachedUsuario(result)
        setUsuario(result)
        return
      }

      const { data: result } = await getPerfil()
      if (currentFetch !== fetchCountRef.current) return
      await setCachedUsuario(result)
      setUsuario(result)
    } finally {
      if (currentFetch === fetchCountRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    // Cargar cache inicial
    getCachedUsuario().then(cached => {
      if (cached) { setUsuario(cached); setLoading(false) }
    })

    timeoutId = setTimeout(() => setLoading(false), AUTH_TIMEOUT_MS)

    // El callback no puede esperar llamadas a Supabase: auth-js lo ejecuta dentro
    // de su lock interno y cualquier query dentro produce un deadlock (todas las
    // peticiones posteriores se quedan colgadas). Se difiere con setTimeout.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, sess) => {
        setSession(sess)
        setTimeout(async () => {
          try {
            if (sess?.user) {
              await fetchUsuario(
                sess.user.id,
                sess.user.email,
                sess.user.user_metadata as Record<string, unknown>,
              )
            } else {
              await setCachedUsuario(null)
              setUsuario(null)
              setLoading(false)
            }
          } finally {
            if (timeoutId) { clearTimeout(timeoutId); timeoutId = null }
          }
        }, 0)
      },
    )

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
      subscription.unsubscribe()
    }
  }, [fetchUsuario])

  const refreshUsuario = useCallback(async () => {
    const { data: { session: sess } } = await supabase.auth.getSession()
    if (!sess?.user) return
    const { data } = await supabase.rpc('get_mi_perfil')
    const perfil = (data as Usuario[] | null)?.[0] ?? null
    if (perfil) { await setCachedUsuario(perfil); setUsuario(perfil) }
  }, [])

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, usuario, loading, refreshUsuario }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
