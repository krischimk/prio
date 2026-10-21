import { useSyncExternalStore } from 'react'
import { applyTheme, subscribeTheme, themePreference, type ThemePreference } from '../app/theme'
import { MoonIcon, SunIcon, ThemeIcon } from './icons'
import { Select } from './components/Select'

export function ThemeSelect() {
  const preference = useSyncExternalStore(subscribeTheme, themePreference)
  return <Select label="Farbschema" icon={<ThemeIcon />} value={preference} onChange={value => applyTheme(value as ThemePreference)} options={[
    { value: 'system', label: 'Gerätestandard', icon: <ThemeIcon /> },
    { value: 'light', label: 'Hell', icon: <SunIcon /> },
    { value: 'dark', label: 'Dunkel', icon: <MoonIcon /> },
  ]} />
}
