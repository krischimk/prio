import { readSupabaseConfig } from '../auth/supabaseAuth'
import { formatBackendLabel } from './backendLabel'
import { mutedText } from './styles'

/**
 * Zeigt, welches Supabase die App gerade benutzt.
 *
 * Der Emulator läuft standardmäßig gegen den lokalen Mock; das echte Projekt
 * ist die ausdrückliche Wahl (`npm run android:emu:install --echt`). Ohne
 * sichtbare Anzeige wäre nach einem Wechsel nicht erkennbar, wogegen man
 * gerade prüft – und ein grüner Lauf gegen den Mock sagt nichts über die
 * echten Zugriffsregeln. Beide Ansichten zeigen deshalb dieselbe Beschriftung
 * aus `backendLabel.ts`.
 */
export function BackendLabel() {
  const label = formatBackendLabel(readSupabaseConfig()?.url)
  if (!label) return null

  return (
    <span
      className={`text-meta ${mutedText}`}
      data-testid="backend-label"
      title="Datenziel dieser Fassung"
    >
      {label}
    </span>
  )
}
