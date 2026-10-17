import { describe, expect, it } from 'vitest'
import { markdownHref, parseInline, parseMarkdown, plainInline } from '../../src/ui/markdown'

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
  it('erkennt Kursivschrift, Unterstreichung und Links ohne beliebiges HTML freizugeben', () => {
    expect(parseInline('*kursiv* <u>Linie</u> [Seite](https://example.org)')).toEqual([
      { art: 'kursiv', text: 'kursiv' }, { art: 'text', text: ' ' },
      { art: 'unterstrichen', text: 'Linie' }, { art: 'text', text: ' ' },
      { art: 'link', text: 'Seite', href: 'https://example.org/' },
    ])
    expect(parseInline('<img src=x onerror=alert(1)>')).toEqual([{ art: 'text', text: '<img src=x onerror=alert(1)>' }])
    expect(markdownHref('javascript:alert(1)')).toBeNull()
    expect(markdownHref('data:text/html,test')).toBeNull()
    expect(markdownHref('mailto:test@example.org')).toBe('mailto:test@example.org')
    expect(parseInline('[Seite](javascript:alert(1))').some(part => part.art === 'link')).toBe(false)
  })
  it('erhält Code und Escape-Zeichen und verschachtelt einfache Formatierungen', () => {
    expect(plainInline('***beides*** und **fett *kursiv***')).toBe('beides und fett kursiv')
    expect(plainInline('*kursiv **fett** weiter*')).toBe('kursiv fett weiter')
    expect(plainInline('`**Code**` und \\*Text\\*')).toBe('**Code** und *Text*')
    expect(plainInline('datei_name_test')).toBe('datei_name_test')
  })
  it('erkennt nummerierte Listen und erhält in Notizen einzelne Zeilenumbrüche', () => {
    expect(parseMarkdown('3. Erstens\n4. Zweitens\n- Punkt')).toEqual([
      { art: 'liste', ordered: true, start: 3, punkte: ['Erstens', 'Zweitens'] },
      { art: 'liste', punkte: ['Punkt'] },
    ])
    expect(parseMarkdown('Zeile\nUmbruch', true)).toEqual([{ art: 'absatz', text: 'Zeile\nUmbruch' }])
  })
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
