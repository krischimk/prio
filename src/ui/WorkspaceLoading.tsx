import { StartupScreen } from './StartupScreen'

/**
 * Die Anzeige, während die lokale Datenbank geöffnet wird.
 *
 * Sie stand vorher in `WorkspaceProvider` – die Anwendungsschicht trug damit
 * Tailwind-Klassen und einen deutschen Satz der Oberfläche mit.
 */
export function WorkspaceLoading() {
  return <StartupScreen text="Lokale Daten werden geladen …" />
}
