import { describe, expect, it } from 'vitest'
import { parseInline, parseMarkdown } from '../../src/ui/markdown'

/**
 * Die Anmerkungen einer Veröffentlichung sind Markdown und wurden als reiner
 * Text angezeigt – man las die Sternchen mit.
 */
const BEISPIEL = `Prio 0.16.0 – neue Aufgaben oben

Neu
* **Neue Aufgaben landen oben.** Bisher standen sie am Ende der Liste –
  dort, wo man gerade nicht hinsieht.
* Die Beschreibung ist einzeilig.

Geändert
* Nichts.
`

describe('Anmerkungen zerlegen', () => {
  it('erkennt Absätze, Listen und ihre Fortsetzungen', () => {
    expect(parseMarkdown(BEISPIEL)).toEqual([
      { art: 'absatz', text: 'Prio 0.16.0 – neue Aufgaben oben' },
      { art: 'absatz', text: 'Neu' },
      {
        art: 'liste',
        punkte: [
          '**Neue Aufgaben landen oben.** Bisher standen sie am Ende der Liste – dort, wo man gerade nicht hinsieht.',
          'Die Beschreibung ist einzeilig.',
        ],
      },
      { art: 'absatz', text: 'Geändert' },
      { art: 'liste', punkte: ['Nichts.'] },
    ])
  })

  it('erkennt Überschriften', () => {
    expect(parseMarkdown('## Neu\n### Kleiner\nText')).toEqual([
      { art: 'ueberschrift', stufe: 2, text: 'Neu' },
      { art: 'ueberschrift', stufe: 3, text: 'Kleiner' },
      { art: 'absatz', text: 'Text' },
    ])
  })

  it('verbindet umbrochene Absatzzeilen', () => {
    expect(parseMarkdown('Erste Zeile\nzweite Zeile')).toEqual([
      { art: 'absatz', text: 'Erste Zeile zweite Zeile' },
    ])
  })

  it('lässt Unbekanntes stehen', () => {
    expect(parseMarkdown('| Tabelle |\n> Zitat')).toEqual([
      { art: 'absatz', text: '| Tabelle | > Zitat' },
    ])
  })
})

describe('Auszeichnungen in einer Zeile', () => {
  it('trennt fett und Code vom Text', () => {
    expect(parseInline('Ein **fettes** Wort und `Code`.')).toEqual([
      { art: 'text', text: 'Ein ' },
      { art: 'fett', text: 'fettes' },
      { art: 'text', text: ' Wort und ' },
      { art: 'code', text: 'Code' },
      { art: 'text', text: '.' },
    ])
  })

  it('lässt einzelne Sternchen in Ruhe', () => {
    expect(parseInline('2 * 3 = 6')).toEqual([{ art: 'text', text: '2 * 3 = 6' }])
  })
})
