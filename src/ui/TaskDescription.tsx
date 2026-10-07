import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { mutedText } from './styles'

/**
 * Die Beschreibung einer Aufgabe in der Übersicht.
 *
 * Zugeklappt ist sie **eine** Zeile – auch wenn Absätze darin stehen. Ein
 * Absatzumbruch in einer Listenzeile macht die Liste unruhig und schiebt die
 * nächste Aufgabe aus dem Blick.
 *
 * Aufgeklappt bleibt die Höhe begrenzt (rund 15 Zeilen), danach wird gescrollt;
 * die Scrollleiste ist dabei sichtbar (siehe `.scroll-flaeche` in `index.css`),
 * sonst sieht man nicht, dass es weitergeht.
 *
 * Der Schalter erscheint **nur**, wenn es etwas aufzuklappen gibt: bei Absätzen
 * immer, bei einer einzeiligen Beschreibung nur, wenn sie wirklich abgeschnitten
 * wird. Gemessen wird am Element (`scrollWidth` gegen `clientWidth`) und bei
 * jeder Größenänderung erneut.
 */
export function TaskDescription({ text, className = '' }: { text: string; className?: string }) {
  const [offen, setOffen] = useState(false)
  const [abgeschnitten, setAbgeschnitten] = useState(false)
  const textRef = useRef<HTMLSpanElement | null>(null)

  const messen = useCallback(() => {
    const element = textRef.current
    if (!element) return
    setAbgeschnitten(element.scrollWidth > element.clientWidth + 1)
  }, [])

  // Nach dem Zeichnen messen – und erneut, wenn sich die Breite ändert
  // (Drehen des Geräts, anderes Fenster).
  useLayoutEffect(messen, [messen, text, offen])
  useEffect(() => {
    window.addEventListener('resize', messen)
    return () => window.removeEventListener('resize', messen)
  }, [messen])

  // Absätze werden zugeklappt zu einer Zeile zusammengezogen – das ist immer
  // etwas zum Aufklappen, auch wenn die Zeile zufällig hineinpasst.
  const brauchtSchalter = text.includes('\n') || abgeschnitten

  return (
    <div className={className}>
      <span
        ref={textRef}
        data-testid="task-description"
        className={`block break-words text-xs ${
          offen ? 'scroll-flaeche max-h-60 overflow-y-auto whitespace-pre-wrap' : 'truncate'
        } ${mutedText}`}
      >
        {text}
      </span>
      {brauchtSchalter ? (
        <button
          type="button"
          aria-expanded={offen}
          onClick={(event) => {
            // In der mobilen Zeile liegt die Beschreibung neben dem Knopf
            // „Aufgabe öffnen" – der Klick darf nicht beides auslösen.
            event.stopPropagation()
            setOffen((vorher) => !vorher)
          }}
          className={`text-[11px] leading-none underline-offset-2 hover:underline ${mutedText}`}
        >
          {offen ? 'Weniger' : 'Mehr'}
        </button>
      ) : null}
    </div>
  )
}
