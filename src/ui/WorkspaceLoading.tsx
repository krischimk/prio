import { appBackground } from './styles'

/**
 * Die Anzeige, während die lokale Datenbank geöffnet wird.
 *
 * Sie stand vorher in `WorkspaceProvider` – die Anwendungsschicht trug damit
 * Tailwind-Klassen und einen deutschen Satz der Oberfläche mit.
 */
export function WorkspaceLoading() {
  return (
    <div className={`flex min-h-screen items-center justify-center ${appBackground} text-ink-muted`}>
      Lokale Daten werden geladen…
    </div>
  )
}
