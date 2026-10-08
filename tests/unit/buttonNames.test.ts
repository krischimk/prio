import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Knopfbeschriftungen in Tests müssen es in der App noch geben.
 *
 * Auslöser: Zweimal hintereinander blieb eine Live-/E2E-Prüfung rot, weil sie
 * auf einen Knopf klickte, den es nicht mehr gab („Wirklich löschen",
 * „Löschen"). Beim ersten Mal habe ich nur die E2E-Dateien nachgezogen und die
 * Live-Prüfung vergessen – der Deploy schlug fehl, nachdem alles andere grün
 * war. Diese Prüfung sucht die Namen aus den Tests in `src` und schlägt an,
 * wenn einer verschwunden ist.
 *
 * Geprüft werden nur **wörtliche** Namen aus `getByRole('button'|'link', {
 * name: '…' })`. Dynamische Beschriftungen (aus Daten) sind nicht dabei.
 */
function dateien(verzeichnis: string, endung: string): string[] {
  return readdirSync(verzeichnis).flatMap((eintrag) => {
    const pfad = join(verzeichnis, eintrag)
    if (statSync(pfad).isDirectory()) return dateien(pfad, endung)
    return pfad.endsWith(endung) ? [pfad] : []
  })
}

function namenAusTests(): Map<string, string> {
  const namen = new Map<string, string>()
  for (const datei of dateien('tests', '.ts')) {
    const inhalt = readFileSync(datei, 'utf8')
    const muster = /getByRole\('(?:button|link)',\s*\{\s*name:\s*'([^']+)'/g
    for (const treffer of inhalt.matchAll(muster)) {
      if (treffer[1]) namen.set(treffer[1], datei)
    }
  }
  return namen
}

describe('Knopfbeschriftungen', () => {
  it('kommen alle noch in der App vor', () => {
    const quelle = dateien('src', '.tsx')
      .concat(dateien('src', '.ts'))
      .map((datei) => readFileSync(datei, 'utf8'))
      .join('\n')

    const testQuelle = dateien('tests', '.ts')
      .map((datei) => readFileSync(datei, 'utf8'))
      .join('\n')

    const fehlend = [...namenAusTests().entries()].filter(([name]) => {
      /*
       * Nur **feste** Beschriftungen pruefen. Ausgenommen sind Namen, die aus
       * Daten entstehen: Zahlen („Erinnerung 1 …"), zusammengesetzte
       * („Aufgabe verschieben: Bericht") und solche, die im Test selbst als
       * Aufgabe oder Liste angelegt werden.
       */
      // Feste Beschriftungen beginnen gross; „symbolknopf" aus der Bauteile-
      // Übersicht ist ein Platzhalter.
      if (!/^[A-ZÄÖÜ]/.test(name)) return false
      if (name.includes('${') || /[0-9]/.test(name) || name.includes(':')) return false
      const alsDaten = new RegExp("create(?:Task|List)\\([^)]*'" + name + "'").test(testQuelle)
      if (alsDaten) return false
      return !quelle.includes(name)
    })

    expect(
      fehlend.map(([name, datei]) => `${name} (${datei})`),
      'Diese Beschriftungen stehen in Tests, aber nicht mehr in src',
    ).toEqual([])
  })
})
