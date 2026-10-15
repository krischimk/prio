import { useSyncExternalStore } from 'react'
import { applyTheme, currentTheme, subscribeTheme } from '../app/theme'
import { SunIcon, MoonIcon } from './icons'
import { IconButton } from './components/IconButton'

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeTheme, currentTheme)
  return <IconButton aria-label={theme === 'dark' ? 'Hellen Modus einschalten' : 'Dunklen Modus einschalten'}
    onClick={() => applyTheme(theme === 'dark' ? 'light' : 'dark')}>
    {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
  </IconButton>
}
