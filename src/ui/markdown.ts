/**
 * Eine kleine Auszeichnungssprache für die Update-Beschreibung.
 *
 * Die Anmerkungen zu einer Veröffentlichung entstehen in Markdown (Überschrift,
 * Listen, fett, Code) – im Tag-Text, der zugleich der Changelog ist. Angezeigt
 * wurden sie bisher als reiner Text: Man las die Sternchen und Rauten mit.
 *
 * Bewusst kein vollständiger Markdown-Umsetzer und keine Fremdbibliothek: Es
 * geht um genau die Zeichen, die in den eigenen Tag-Texten vorkommen. Alles
 * andere bleibt schlicht stehen, statt halb umgesetzt zu werden.
 *
 * Der Zerleger ist eine reine Funktion – ohne React und ohne Netz prüfbar.
 */

export type MdBlock =
  | { art: 'ueberschrift'; stufe: number; text: string }
  | { art: 'absatz'; text: string }
  | { art: 'liste'; punkte: string[] }

export type MdTeil =
  | { art: 'text'; text: string }
  | { art: 'fett'; text: string }
  | { art: 'code'; text: string }

const UEBERSCHRIFT = /^(#{1,6})\s+(.*)$/
const PUNKT = /^[*-]\s+(.*)$/
/** Fortsetzung eines Aufzählungspunkts: eingerückt und kein neuer Punkt. */
const FORTSETZUNG = /^\s+\S/

/**
 * Zerlegt den Text in Blöcke.
 *
 * Zeilen eines Absatzes und Fortsetzungen eines Punkts werden mit einem
 * Leerzeichen verbunden – in Markdown ist ein einfacher Zeilenumbruch Fließtext,
 * und die Tag-Texte sind von Hand umbrochen.
 */
export function parseMarkdown(rohtext: string): MdBlock[] {
  const bloecke: MdBlock[] = []
  let absatz: string[] = []
  let punkte: string[] = []

  const absatzSchliessen = () => {
    if (absatz.length > 0) {
      bloecke.push({ art: 'absatz', text: absatz.join(' ') })
      absatz = []
    }
  }
  const listeSchliessen = () => {
    if (punkte.length > 0) {
      bloecke.push({ art: 'liste', punkte })
      punkte = []
    }
  }

  for (const rohzeile of rohtext.split(/\r?\n/)) {
    const zeile = rohzeile.trimEnd()

    if (zeile.trim() === '') {
      absatzSchliessen()
      listeSchliessen()
      continue
    }

    const ueberschrift = UEBERSCHRIFT.exec(zeile)
    if (ueberschrift) {
      absatzSchliessen()
      listeSchliessen()
      bloecke.push({
        art: 'ueberschrift',
        stufe: ueberschrift[1].length,
        text: ueberschrift[2].trim(),
      })
      continue
    }

    const punkt = PUNKT.exec(zeile)
    if (punkt) {
      absatzSchliessen()
      punkte.push(punkt[1].trim())
      continue
    }

    if (punkte.length > 0 && FORTSETZUNG.test(zeile)) {
      punkte[punkte.length - 1] = `${punkte[punkte.length - 1]} ${zeile.trim()}`
      continue
    }

    listeSchliessen()
    absatz.push(zeile.trim())
  }

  absatzSchliessen()
  listeSchliessen()
  return bloecke
}

const AUSZEICHNUNG = /(\*\*[^*]+\*\*|`[^`]+`)/

/** Zerlegt eine Zeile in Text, fett und Code. */
export function parseInline(text: string): MdTeil[] {
  return text
    .split(AUSZEICHNUNG)
    .filter((teil) => teil !== '')
    .map((teil) => {
      if (teil.startsWith('**') && teil.endsWith('**') && teil.length > 4) {
        return { art: 'fett', text: teil.slice(2, -2) }
      }
      if (teil.startsWith('`') && teil.endsWith('`') && teil.length > 2) {
        return { art: 'code', text: teil.slice(1, -1) }
      }
      return { art: 'text', text: teil }
    })
}
