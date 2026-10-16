import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { focusRing, mutedText } from './styles'

/**
 * Die Notiz einer Aufgabe in der Übersicht.
 *
 * Zugeklappt endet die einzeilige Vorschau am ersten Zeilenumbruch. Weitere
 * Absätze werden erst beim Aufklappen gezeigt, statt sie aneinanderzuhängen.
 *
 * Aufgeklappt bleibt die Höhe begrenzt (rund 15 Zeilen), danach wird gescrollt;
 * die Scrollleiste ist dabei sichtbar (siehe `.scroll-flaeche` in `index.css`),
 * sonst sieht man nicht, dass es weitergeht.
 *
 * Der Schalter erscheint **nur**, wenn es etwas aufzuklappen gibt: bei Absätzen
 * immer, bei einer einzeiligen Notiz nur, wenn sie wirklich abgeschnitten
 * wird. Gemessen wird am Element (`scrollWidth` gegen `clientWidth`) und bei
 * jeder Größenänderung erneut.
 */
export function TaskDescription({ text, className = '' }: { text: string; className?: string }) {
  const [offen, setOffen] = useState(false)
  const [abgeschnitten, setAbgeschnitten] = useState(false)
  const textRef = useRef<HTMLSpanElement | null>(null)

  const messen = useCallback(() => {
    if (offen) return
    const element = textRef.current
    if (!element) return
    setAbgeschnitten(element.scrollWidth > element.clientWidth + 1)
  }, [offen])

  // Nach dem Zeichnen messen – und erneut, wenn sich die Breite ändert
  // (Drehen des Geräts, anderes Fenster).
  useLayoutEffect(messen, [messen, text, offen])
  useEffect(() => {
    window.addEventListener('resize', messen)
    return () => window.removeEventListener('resize', messen)
  }, [messen])

  const ersteZeile = text.split(/\r\n?|\n/, 1)[0]
  const mehrzeilig = ersteZeile.length < text.length
  const brauchtSchalter = mehrzeilig || abgeschnitten

  return (
    <div className={className}>
      <span
        ref={textRef}
        data-testid="task-description"
        className={`block break-words text-meta ${
          offen ? 'scroll-flaeche max-h-60 overflow-y-auto whitespace-pre-wrap' : 'truncate'
        } ${mutedText}`}
      >
        {offen ? text : mehrzeilig ? `${ersteZeile}…` : ersteZeile}
      </span>
      {brauchtSchalter ? (
        <button
          type="button"
          aria-expanded={offen}
          data-testid="beschreibung-mehr"
          onClick={(event) => {
            // Die Notiz liegt in der Aufgabenfläche; dieser Knopf
            // klappt nur den Text auf und öffnet nicht zusätzlich den Editor.
            event.stopPropagation()
            setOffen((vorher) => !vorher)
          }}
          className={`${focusRing} text-label leading-none underline-offset-2 hover:underline ${mutedText}`}
        >
          {offen ? 'Weniger' : 'Mehr'}
        </button>
      ) : null}
    </div>
  )
}
