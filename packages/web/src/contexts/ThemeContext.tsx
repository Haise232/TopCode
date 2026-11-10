import { createContext, useContext, useEffect, useState } from 'react'
import { aplicarTema, temaDeTemporada, type Tema } from '../lib/temporada'

interface ThemeContextValue {
  /** Tema de temporada activo ('navidad' entre el 1 nov y el 7 ene). */
  tema: Tema
  /** Atajo: hay decoración navideña (nieve, guirnalda, gorro…). */
  navidad: boolean
}

const ThemeContext = createContext<ThemeContextValue>({ tema: 'clasico', navidad: false })

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [tema, setTema] = useState<Tema>(() => temaDeTemporada())

  // Una pestaña abierta varios días cambia de tema sola al entrar o salir de la temporada.
  useEffect(() => {
    const id = setInterval(() => setTema(temaDeTemporada()), 60 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => { aplicarTema(tema) }, [tema])

  return (
    <ThemeContext.Provider value={{ tema, navidad: tema === 'navidad' }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
