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
  | { art: 'liste'; punkte: string[]; ordered?: boolean; start?: number }

export type MdTeil =
  | { art: 'text'; text: string }
  | { art: 'fett'; text: string }
  | { art: 'code'; text: string }
  | { art: 'kursiv'; text: string }
  | { art: 'unterstrichen'; text: string }
  | { art: 'link'; text: string; href: string }

const UEBERSCHRIFT = /^(#{1,6})\s+(.*)$/
const PUNKT = /^\s*[-*+]\s+(.*)$/
const NUMMER = /^\s*(\d+)[.)]\s+(.*)$/
/** Fortsetzung eines Aufzählungspunkts: eingerückt und kein neuer Punkt. */
const FORTSETZUNG = /^\s+\S/

/**
 * Zerlegt den Text in Blöcke.
 *
 * Zeilen eines Absatzes und Fortsetzungen eines Punkts werden mit einem
 * Leerzeichen verbunden – in Markdown ist ein einfacher Zeilenumbruch Fließtext,
 * und die Tag-Texte sind von Hand umbrochen.
 */
export function parseMarkdown(rohtext: string, preserveLineBreaks = false): MdBlock[] {
  const bloecke: MdBlock[] = []
  let absatz: string[] = []
  let punkte: string[] = []
  let ordered = false
  let start = 1

  const absatzSchliessen = () => {
    if (absatz.length > 0) {
      bloecke.push({ art: 'absatz', text: absatz.join(preserveLineBreaks ? '\n' : ' ') })
      absatz = []
    }
  }
  const listeSchliessen = () => {
    if (punkte.length > 0) {
      bloecke.push(ordered ? { art: 'liste', punkte, ordered: true, start } : { art: 'liste', punkte })
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
    const nummer = NUMMER.exec(zeile)
    if (punkt || nummer) {
      absatzSchliessen()
      if (punkte.length && ordered !== Boolean(nummer)) listeSchliessen()
      if (!punkte.length) { ordered = Boolean(nummer); start = nummer ? Number(nummer[1]) : 1 }
      punkte.push((nummer ? nummer[2] : punkt![1]).trim())
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

/** Ausschließlich bewusst unterstützte Protokolle; HTML bleibt immer Text. */
export function markdownHref(href: string): string | null {
  try {
    const url = new URL(href)
    return ['https:', 'http:', 'mailto:'].includes(url.protocol) ? url.href : null
  } catch { return null }
}

function closing(text: string, delimiter: string, from: number): number {
  for (let at = text.indexOf(delimiter, from); at >= 0; at = text.indexOf(delimiter, at + 1)) {
    let escapes = 0
    for (let before = at - 1; before >= 0 && text[before] === '\\'; before--) escapes++
    if (escapes % 2) continue
    if (delimiter === '*' || delimiter === '**') {
      let count = 1
      while (text[at + count] === '*') count++
      if (delimiter === '*' && count === 2) { at++; continue }
      if (count === 3) return at + (delimiter === '*' ? 2 : 1)
    }
    return at
  }
  return -1
}

/** Kleine, sichere Markdown-Teilmenge, gemeinsam für Notizen und Patchnotes. */
export function parseInline(text: string): MdTeil[] {
  const result: MdTeil[] = []
  let plain = ''
  const flush = () => { if (plain) { result.push({ art: 'text', text: plain }); plain = '' } }
  for (let at = 0; at < text.length;) {
    if (text[at] === '\\' && /[\\*_`[\]<>]/.test(text[at + 1] ?? '')) { plain += text[at + 1]; at += 2; continue }
    const link = /^\[([^\]\n]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)/.exec(text.slice(at))
    const href = link && markdownHref(link[2])
    if (link && href) { flush(); result.push({ art: 'link', text: link[1], href }); at += link[0].length; continue }
    const token = text.startsWith('++', at) ? '++' : text.startsWith('***', at) ? '***' : text.startsWith('**', at) ? '**'
      : text.startsWith('<u>', at) ? '<u>' : ['*', '_', '`'].includes(text[at]) ? text[at] : null
    if (token && !(token === '_' && /\w/.test(text[at - 1] ?? ''))) {
      const endToken = token === '<u>' ? '</u>' : token
      const end = closing(text, endToken, at + token.length)
      if (end > at + token.length) {
        flush()
        const inner = text.slice(at + token.length, end)
        result.push({ art: token === '`' ? 'code' : token === '<u>' || token === '++' ? 'unterstrichen' : token.startsWith('**') ? 'fett' : 'kursiv', text: token === '***' ? `*${inner}*` : inner })
        at = end + endToken.length
        continue
      }
    }
    plain += text[at++]
  }
  flush()
  return result
}

export function plainInline(text: string, depth = 0): string {
  if (depth > 16) return text
  return parseInline(text).map(part => part.art === 'text' || part.art === 'code' ? part.text : plainInline(part.text, depth + 1)).join('')
}
