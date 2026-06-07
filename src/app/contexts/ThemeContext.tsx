import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

type Theme = 'day' | 'night'

interface ThemeContextType {
  theme: Theme
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextType>({ theme: 'day', toggle: () => {} })

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'day'
    return (localStorage.getItem('jornal-theme') as Theme) || 'day'
  })

  useEffect(() => {
    localStorage.setItem('jornal-theme', theme)
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const toggle = () => setTheme(prev => (prev === 'day' ? 'night' : 'day'))

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  return useContext(ThemeContext)
}
