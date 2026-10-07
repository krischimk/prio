import { createContext, useContext } from 'react'

/**
 * Das Datenziel dieser Fassung – für die Anzeige in beiden Ansichten.
 *
 * Es kommt aus der Zusammensetzung (`AppServices.backendUrl`) und nicht aus
 * `import.meta.env`: Eine Komponente, die die Umgebung selbst liest, zeigt in
 * Tests gegen eine Attrappe das echte Projekt an – genau die Verwechslung, die
 * diese Anzeige verhindern soll.
 */
export const BackendContext = createContext<{ url: string | null }>({ url: null })

/** Liest das Datenziel. */
export function useBackendUrl(): string | null {
  return useContext(BackendContext).url
}
