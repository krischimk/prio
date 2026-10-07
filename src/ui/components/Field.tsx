import type { ReactNode } from 'react'

export interface FieldProps {
  /** Die `id` des Feldes – verbindet Beschriftung und Bedienelement. */
  id: string
  label: string
  /** Ein Hinweis **unter** dem Feld. Nicht der Platzhalter: Der verschwindet
   *  beim Tippen, also genau dann, wenn die Information gebraucht wird (P59). */
  hint?: ReactNode
  children: ReactNode
}

/**
 * Ein Feld mit Beschriftung.
 *
 * Die Zeile `<label className="mb-1 block text-meta text-ink-muted">` stand
 * vorher **fünfzehnmal** im Code – in den drei Aufgabenformularen, in der
 * Erinnerungsliste und in der Wiederholungs-Auswahl. Deshalb gab es auch keinen
 * Ort, an dem ein Hinweis, eine Pflichtfeld-Kennzeichnung oder eine
 * Fehleranzeige einmal definiert gewesen wäre; sie fehlten folglich überall.
 *
 * Die Beschriftung bleibt eine echte `<label>` mit `htmlFor` – Vorleseprogramme
 * und `getByLabel` in den Tests hängen daran.
 */
export function Field({ id, label, hint, children }: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-meta text-ink-muted">
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1 text-meta text-ink-faint">{hint}</p> : null}
    </div>
  )
}
