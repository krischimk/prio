import { useCallback, useState } from 'react'

/**
 * Welche Abschnitte zugeklappt sind.
 *
 * Eine Ansichtssache je Gerät: Sie liegt lokal (`localStorage`) und wird
 * **nicht** abgeglichen – wer am Telefon „Getränke" zuklappt, klappt damit
 * nicht die Ansicht am Rechner zu. Deshalb berührt sie auch keine
 * Datenbankoperation und löst keinen Abgleich aus.
 */
const PRAEFIX = 'prio.sectionsCollapsed.'

function lesen(listId: string): string[] {
  try {
    const roh = globalThis.localStorage?.getItem(PRAEFIX + listId)
    if (roh === null || roh === undefined) return []
    const wert: unknown = JSON.parse(roh)
    return Array.isArray(wert) ? wert.filter((eintrag): eintrag is string => typeof eintrag === 'string') : []
  } catch {
    return []
  }
}

function schreiben(listId: string, zugeklappt: ReadonlySet<string>): void {
  try {
    globalThis.localStorage?.setItem(PRAEFIX + listId, JSON.stringify([...zugeklappt]))
  } catch {
    // Ohne Speicher klappt es eben beim nächsten Start wieder auf.
  }
}

export function useCollapsedSections(listId: string): {
  zugeklappt: ReadonlySet<string>
  umschalten: (gruppeId: string) => void
} {
  const [zugeklappt, setZugeklappt] = useState<ReadonlySet<string>>(() => new Set(lesen(listId)))

  const umschalten = useCallback(
    (gruppeId: string) => {
      setZugeklappt((vorher) => {
        const nachher = new Set(vorher)
        if (nachher.has(gruppeId)) {
          nachher.delete(gruppeId)
        } else {
          nachher.add(gruppeId)
        }
        schreiben(listId, nachher)
        return nachher
      })
    },
    [listId],
  )

  return { zugeklappt, umschalten }
}
