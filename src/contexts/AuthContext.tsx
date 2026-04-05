import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { Usuario } from '../lib/types'

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

  const fetchUsuario = useCallback(async (userId: string) => {
    try {
      const { data } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', userId)
        .single()
      setUsuario(data)
    } catch {
      setUsuario(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // getSession() resuelve la sesión inicial de forma fiable y rápida.
    // onAuthStateChange se ignora para INITIAL_SESSION (ya cubierto arriba)
    // y solo maneja cambios posteriores: login, logout, token refresh.
    supabase.auth.getSession()
      .then(({ data: { session: initialSession } }) => {
        setSession(initialSession)
        if (initialSession?.user) {
          fetchUsuario(initialSession.user.id)
        } else {
          setLoading(false)
        }
      })
      .catch(() => {
        setLoading(false)
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, sess) => {
        if (event === 'INITIAL_SESSION') return
        setSession(sess)
        if (sess?.user) {
          await fetchUsuario(sess.user.id)
        } else {
          setUsuario(null)
          setLoading(false)
        }
      },
    )
    return () => subscription.unsubscribe()
  }, [fetchUsuario])

  const refreshUsuario = useCallback(async () => {
    const { data: { session: sess } } = await supabase.auth.getSession()
    if (!sess?.user) return
    await fetchUsuario(sess.user.id)
  }, [fetchUsuario])

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
