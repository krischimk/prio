/**
 * Back-Stack für die Android-Zurück-Taste und Escape.
 *
 * Problem: In einer Capacitor-App beendet die Zurück-Taste ohne Behandlung
 * sofort die App – auch wenn gerade ein Bearbeitungsformular oder ein Panel
 * offen ist. Der Benutzer erwartet, dass zuerst das Offene geschlossen wird.
 *
 * Lösung: Die Oberfläche meldet "Ebenen" an (offene Formulare, Panels,
 * Bestätigungen). Die Zurück-Taste arbeitet die zuletzt geöffnete Ebene ab;
 * ist keine offen, wird die App in den Hintergrund geschickt.
 *
 * Jede Ebene hat einen **Namen** (`aufgabe-bearbeiten`, `liste-verwalten`,
 * `blatt` …). Er ändert nichts am Ablauf, macht den Zustand aber lesbar: Wer
 * wissen will, was gerade offen ist, fragt `top()` statt sieben Booleans
 * zusammenzusuchen. Ein späterer Router kann an diesen Namen seine Adressen
 * aufhängen; vorher waren es anonyme Rückrufe.
 *
 * Diese Datei ist bewusst React-frei und damit direkt testbar.
 */

export type BackHandler = () => void

export interface BackStack {
  /** Meldet eine Ebene an. Gibt die Abmelde-Funktion zurück. */
  push(handler: BackHandler, name?: string): () => void
  /**
   * Schließt die zuletzt geöffnete Ebene.
   * `true`, wenn eine Ebene behandelt wurde – sonst `false`.
   */
  handle(): boolean
  /** Anzahl offener Ebenen (für Tests und Diagnose). */
  size(): number
  /** Der Name der obersten Ebene – `null`, wenn keine offen ist. */
  top(): string | null
  /** Alle Namen von unten nach oben. */
  names(): string[]
  clear(): void
}

export function createBackStack(): BackStack {
  const ebenen: Array<{ handler: BackHandler; name: string | null }> = []

  return {
    push(handler, name) {
      const ebene = { handler, name: name ?? null }
      ebenen.push(ebene)
      let entfernt = false
      return () => {
        // Doppeltes Abmelden darf nicht die falsche Ebene entfernen.
        if (entfernt) return
        entfernt = true
        const index = ebenen.lastIndexOf(ebene)
        if (index >= 0) ebenen.splice(index, 1)
      }
    },

    handle() {
      const ebene = ebenen.pop()
      if (!ebene) return false
      ebene.handler()
      return true
    },

    size: () => ebenen.length,

    top: () => ebenen[ebenen.length - 1]?.name ?? null,

    names: () => ebenen.map((ebene) => ebene.name ?? '(ohne Namen)'),

    clear: () => {
      ebenen.length = 0
    },
  }
}
