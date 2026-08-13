import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'system')

  useEffect(() => {
    const root = document.documentElement
    const applyTheme = (t) => {
      const isDark =
        t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      root.classList.toggle('dark', isDark)
    }

    applyTheme(theme)
    localStorage.setItem('theme', theme)

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const listener = () => applyTheme('system')
      mq.addEventListener('change', listener)
      return () => mq.removeEventListener('change', listener)
    }
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
