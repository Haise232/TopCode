import { createContext, useContext } from 'react'

interface ThemeContextValue {
  theme: 'dark'
}

const ThemeContext = createContext<ThemeContextValue>({ theme: 'dark' })

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeContext.Provider value={{ theme: 'dark' }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
