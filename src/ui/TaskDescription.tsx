import { useState } from 'react'
import { mutedText } from './styles'

/**
 * Die Beschreibung einer Aufgabe in der Übersicht.
 *
 * Zugeklappt ist sie **eine** Zeile – auch wenn Absätze darin stehen. Ein
 * Absatzumbruch in einer Listenzeile macht die Liste unruhig und schiebt die
 * nächste Aufgabe aus dem Blick; wer die Beschreibung ganz lesen will, klappt
 * sie auf.
 *
 * Aufgeklappt bleibt die Höhe begrenzt (rund 15 Zeilen), danach wird gescrollt:
 * Eine sehr lange Beschreibung soll die Liste nicht in eine Textseite
 * verwandeln.
 *
 * Der Schalter ist bewusst immer da, wenn es eine Beschreibung gibt – statt
 * erst nachzumessen, ob der Text wirklich abgeschnitten wird. Eine Messung
 * hinge an Schriftgröße und Fensterbreite und wäre in Tests nicht prüfbar.
 */
export function TaskDescription({ text, className = '' }: { text: string; className?: string }) {
  const [offen, setOffen] = useState(false)

  return (
    <div className={className}>
      <span
        data-testid="task-description"
        className={`block break-words text-xs ${
          offen
            ? 'max-h-60 overflow-y-auto whitespace-pre-wrap'
            : 'truncate'
        } ${mutedText}`}
      >
        {text}
      </span>
      <button
        type="button"
        aria-expanded={offen}
        onClick={(event) => {
          // In der mobilen Zeile liegt die Beschreibung in der Nähe des Knopfes
          // „Aufgabe öffnen" – der Klick darf nicht beides auslösen.
          event.stopPropagation()
          setOffen((vorher) => !vorher)
        }}
        className={`text-xs underline-offset-2 hover:underline ${mutedText}`}
      >
        {offen ? 'Weniger' : 'Mehr'}
      </button>
    </div>
  )
}
