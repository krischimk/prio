/**
 * Back-Stack für die Android-Zurück-Taste.
 *
 * Problem: In einer Capacitor-App beendet die Zurück-Taste ohne Behandlung
 * sofort die App – auch wenn gerade ein Bearbeitungsformular oder ein Panel
 * offen ist. Der Benutzer erwartet, dass zuerst das Offene geschlossen wird.
 *
 * Lösung: Die Oberfläche meldet "Ebenen" an (offene Formulare, Panels,
 * Bestätigungen). Die Zurück-Taste arbeitet die zuletzt geöffnete Ebene ab;
 * ist keine offen, wird die App in den Hintergrund geschickt.
 *
 * Diese Datei ist bewusst React-frei und damit direkt testbar.
 */

export type BackHandler = () => void

export interface BackStack {
  /** Meldet eine Ebene an. Gibt die Abmelde-Funktion zurück. */
  push(handler: BackHandler): () => void
  /**
   * Schließt die zuletzt geöffnete Ebene.
   * `true`, wenn eine Ebene behandelt wurde – sonst `false`.
   */
  handle(): boolean
  /** Anzahl offener Ebenen (für Tests und Diagnose). */
  size(): number
  clear(): void
}

export function createBackStack(): BackStack {
  const handlers: BackHandler[] = []

  return {
    push(handler) {
      handlers.push(handler)
      let removed = false
      return () => {
        // Doppeltes Abmelden darf nicht die falsche Ebene entfernen.
        if (removed) return
        removed = true
        const index = handlers.lastIndexOf(handler)
        if (index >= 0) handlers.splice(index, 1)
      }
    },

    handle() {
      const handler = handlers.pop()
      if (!handler) return false
      handler()
      return true
    },

    size: () => handlers.length,

    clear: () => {
      handlers.length = 0
    },
  }
}
