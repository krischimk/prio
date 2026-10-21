import { useSyncExternalStore } from 'react'
import { applyTheme, subscribeTheme, themePreference, type ThemePreference } from '../app/theme'
import { ThemeIcon } from './icons'
import { input } from './styles'

export function ThemeSelect() {
  const preference = useSyncExternalStore(subscribeTheme, themePreference)
  return <label className="flex items-center gap-3">
    <ThemeIcon />
    <span className="sr-only">Farbschema</span>
    <select className={`${input} min-w-0 flex-1`} value={preference}
      onChange={event => applyTheme(event.target.value as ThemePreference)}>
      <option value="system">Gerätestandard</option>
      <option value="light">Hell</option>
      <option value="dark">Dunkel</option>
    </select>
  </label>
}
