import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { aplicarTema, guardarModo, modoGuardado, temaDeTemporada, type Modo, type Tema } from '../lib/temporada'

interface ThemeContextValue {
  /** Tema de temporada activo ('navidad' entre el 1 nov y el 7 ene). */
  tema: Tema
  /** Atajo: hay decoración navideña (nieve, guirnalda, gorro…). */
  navidad: boolean
  /** Claro (por defecto) u oscuro; lo elige cada usuario y se recuerda en el navegador. */
  modo: Modo
  setModo: (modo: Modo) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  tema: 'clasico', navidad: false, modo: 'claro', setModo: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [tema, setTema] = useState<Tema>(() => temaDeTemporada())
  const [modo, setModoState] = useState<Modo>(() => modoGuardado())

  // Una pestaña abierta varios días cambia de tema sola al entrar o salir de la temporada.
  useEffect(() => {
    const id = setInterval(() => setTema(temaDeTemporada()), 60 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => { aplicarTema(tema, modo) }, [tema, modo])

  const setModo = useCallback((m: Modo) => {
    guardarModo(m)
    setModoState(m)
  }, [])

  return (
    <ThemeContext.Provider value={{ tema, navidad: tema === 'navidad', modo, setModo }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
