import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { Usuario } from '../lib/types'

const AUTH_TIMEOUT_MS = 8000
const USUARIO_CACHE_KEY = 'topcode-usuario-cache'

function getCachedUsuario(): Usuario | null {
  try {
    const raw = sessionStorage.getItem(USUARIO_CACHE_KEY)
    return raw ? (JSON.parse(raw) as Usuario) : null
  } catch {
    return null
  }
}

function setCachedUsuario(u: Usuario | null) {
  try {
    if (u) sessionStorage.setItem(USUARIO_CACHE_KEY, JSON.stringify(u))
    else sessionStorage.removeItem(USUARIO_CACHE_KEY)
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
  // Servir el perfil cacheado inmediatamente para eliminar el parpadeo de carga
  const [usuario, setUsuario] = useState<Usuario | null>(getCachedUsuario)
  const [loading, setLoading] = useState(() => getCachedUsuario() === null)

  // Evita race conditions: si fetchUsuario se llama dos veces concurrentemente,
  // solo la última respuesta actualiza el estado.
  const fetchCountRef = useRef(0)

  const fetchUsuario = useCallback(async (
    userId: string,
    userEmail?: string,
    userMeta?: Record<string, unknown>,
  ) => {
    const currentFetch = ++fetchCountRef.current

    // get_mi_perfil() es SECURITY DEFINER: devuelve email y es_superadmin
    // que el rol `authenticated` no puede leer directamente por column-level REVOKE.
    const getPerfil = async () => {
      const { data, error } = await supabase.rpc('get_mi_perfil')
      return {
        data: (data as Usuario[] | null)?.[0] ?? null,
        error,
      }
    }

    const { data, error } = await getPerfil()
    if (currentFetch !== fetchCountRef.current) return

    if (data && !error) {
      setCachedUsuario(data)
      setUsuario(data)
      setLoading(false)
      return
    }

    // Sin fila = usuario nuevo. Solo hacemos upsert en este caso.
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
        })

      if (currentFetch !== fetchCountRef.current) return

      if (!upsertError) {
        const { data: result } = await getPerfil()
        if (currentFetch !== fetchCountRef.current) return
        setCachedUsuario(result)
        setUsuario(result)
        setLoading(false)
        return
      }

      // El upsert falló: reintentar por si la fila ya existía (race condition)
      const { data: result } = await getPerfil()
      if (currentFetch !== fetchCountRef.current) return
      setCachedUsuario(result)
      setUsuario(result)
      setLoading(false)
      return
    }

    // Cualquier otro error (red, RLS transitorio, etc.): reintento único antes de rendir
    const { data: result } = await getPerfil()
    if (currentFetch !== fetchCountRef.current) return
    setCachedUsuario(result)
    setUsuario(result)
    setLoading(false)
  }, [])

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    // Timeout de seguridad: si Supabase no responde en 8s (variables de entorno
    // incorrectas, proyecto pausado, red caída), liberar el loading igualmente.
    timeoutId = setTimeout(() => {
      setLoading(false)
    }, AUTH_TIMEOUT_MS)

    // Usar onAuthStateChange como única fuente de verdad para la sesión inicial.
    // INITIAL_SESSION se dispara al montar, equivale al getSession() anterior
    // pero sin la race condition de tener dos fuentes concurrentes.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, sess) => {
        if (timeoutId) {
          clearTimeout(timeoutId)
          timeoutId = null
        }

        setSession(sess)

        if (sess?.user) {
          await fetchUsuario(
            sess.user.id,
            sess.user.email,
            sess.user.user_metadata as Record<string, unknown>,
          )
        } else {
          setCachedUsuario(null)
          setUsuario(null)
          setLoading(false)
        }
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
    if (perfil) {
      setCachedUsuario(perfil)
      setUsuario(perfil)
    }
  }, [])

  return (
    <AuthContext.Provider value={{
      session,
      user: session?.user ?? null,
      usuario,
      loading,
      refreshUsuario,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
