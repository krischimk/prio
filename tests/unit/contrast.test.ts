import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Kontrast ist eine Zahl, keine Meinung (P9, P10, P11).
 *
 * WCAG 2.2 verlangt 4,5:1 für Text und 3:1 für große Schrift und
 * Bedienelemente. Beides ist rechenbar – also prüfbar. Vorher war der Kontrast
 * nirgends geprüft: Die Rollen in `src/index.css` waren von Hand gewählt, und
 * ein zu leiser Ton fiel erst auf, wenn jemand ihn nicht lesen konnte.
 */

/** Liest die Farbrollen aus `@theme`. */
function rollen(): Record<string, string> {
  const css = readFileSync(join(process.cwd(), 'src', 'index.css'), 'utf8')
  const farben: Record<string, string> = {}
  for (const treffer of css.matchAll(/--color-([a-z-]+):\s*(#[0-9a-fA-F]{6});/g)) {
    farben[treffer[1]] = treffer[2]
  }
  return farben
}

function kanal(wert: number): number {
  const anteil = wert / 255
  return anteil <= 0.03928 ? anteil / 12.92 : ((anteil + 0.055) / 1.055) ** 2.4
}

/** Relative Helligkeit nach WCAG. */
function helligkeit(hex: string): number {
  const zahl = Number.parseInt(hex.slice(1), 16)
  const r = kanal((zahl >> 16) & 0xff)
  const g = kanal((zahl >> 8) & 0xff)
  const b = kanal(zahl & 0xff)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Kontrastverhältnis zweier Farben (1 … 21). */
export function kontrast(a: string, b: string): number {
  const [hell, dunkel] = [helligkeit(a), helligkeit(b)].sort((x, y) => y - x)
  return (hell + 0.05) / (dunkel + 0.05)
}

const FARBEN = rollen()

/** Alle Textrollen, die auf einer Fläche stehen können. */
const TEXTROLLEN = ['ink-strong', 'ink', 'ink-soft', 'ink-muted', 'ink-faint']
const FLAECHEN = ['page', 'surface', 'raised']

/** Bedienelemente und Rahmen: 3:1 gegen die Fläche, auf der sie liegen. */
const RAHMEN = ['line-strong']

function runde(zahl: number): string {
  return zahl.toFixed(2)
}


/** Alle Textrollen, die in der Oberfläche wirklich vorkommen. */
function genutzteTextrollen(): string[] {
  const ordner = join(process.cwd(), 'src')
  const rollen = new Set<string>()
  const durchlaufe = (pfad: string) => {
    for (const eintrag of readdirSync(pfad, { withFileTypes: true })) {
      const voll = join(pfad, eintrag.name)
      if (eintrag.isDirectory()) {
        durchlaufe(voll)
        continue
      }
      if (!/\.tsx?$/.test(eintrag.name)) continue
      for (const treffer of readFileSync(voll, 'utf8').matchAll(/\btext-ink-([a-z]+)\b/g)) {
        rollen.add(`ink-${treffer[1]}`)
      }
    }
  }
  durchlaufe(ordner)
  return [...rollen]
}

describe('Kontrast', () => {
  it('findet die Farbrollen', () => {
    expect(Object.keys(FARBEN).length).toBeGreaterThan(20)
    expect(FARBEN.page).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('Text erreicht 4,5:1 auf jeder Fläche', () => {
    const verstoesse: string[] = []
    for (const text of TEXTROLLEN) {
      for (const flaeche of FLAECHEN) {
        const wert = kontrast(FARBEN[text], FARBEN[flaeche])
        if (wert < 4.5) {
          verstoesse.push(`${text} auf ${flaeche}: ${runde(wert)}:1`)
        }
      }
    }

    expect(verstoesse, 'WCAG 2.2, 1.4.3 verlangt 4,5:1 für Text.').toEqual([])
  })

  it('Rahmen von Bedienelementen erreichen 3:1', () => {
    const verstoesse: string[] = []
    for (const rahmen of RAHMEN) {
      for (const flaeche of ['surface', 'page']) {
        const wert = kontrast(FARBEN[rahmen], FARBEN[flaeche])
        if (wert < 3) {
          verstoesse.push(`${rahmen} auf ${flaeche}: ${runde(wert)}:1`)
        }
      }
    }

    expect(verstoesse, 'WCAG 2.2, 1.4.11 verlangt 3:1 für Bedienelemente.').toEqual([])
  })

  it('unterscheidet benachbarte Flächen sichtbar', () => {
    // P11: Flächen, die sich zu ähnlich sind, wirken unsauber statt dezent.
    expect(kontrast(FARBEN.surface, FARBEN.page)).toBeGreaterThan(1.1)
    expect(kontrast(FARBEN.raised, FARBEN.surface)).toBeGreaterThan(1.1)
  })

  it('hält Statusfarben lesbar', () => {
    for (const rolle of ['danger', 'ok', 'warn', 'brand-soft']) {
      expect(kontrast(FARBEN[rolle], FARBEN.surface), rolle).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('prüft jede Textrolle, die in der Oberfläche vorkommt', () => {
    // F2: Der Test kannte fünf Rollen; `text-ink-dim` gab es zusätzlich, und
    // sie wurde als Text benutzt (3,0:1 – nicht lesbar). Eine neue Textrolle
    // muss hier auftauchen, sonst ist sie ungeprüft.
    const fehlend = genutzteTextrollen().filter((rolle) => !TEXTROLLEN.includes(rolle))

    expect(
      fehlend,
      'Neue Textrolle: in TEXTROLLEN aufnehmen und prüfen (4,5:1), oder sie ist keine Textrolle.',
    ).toEqual([])
  })

  it('hält die Ink-Rampe unterscheidbar', () => {
    // P18/P2: Die Rampe ist eine Hierarchie. Zwei Stufen, die sich kaum
    // unterscheiden, sind keine zwei Stufen. `ink-strong` und `ink` sind die
    // bewusste Ausnahme: beide sind „weiß", der Unterschied ist die Härte, und
    // beide tragen Text.
    const rampe = ['ink-strong', 'ink', 'ink-soft', 'ink-muted', 'ink-faint']
    const stufen = rampe.map((rolle) => helligkeit(FARBEN[rolle]))
    for (let i = 1; i < stufen.length; i += 1) {
      expect(stufen[i], `${rampe[i]} muss dunkler sein als ${rampe[i - 1]}`).toBeLessThan(stufen[i - 1])
    }
    for (let i = 2; i < rampe.length; i += 1) {
      const abstand = kontrast(FARBEN[rampe[i - 1]], FARBEN[rampe[i]])
      expect(abstand, `${rampe[i - 1]} → ${rampe[i]}: ${runde(abstand)}:1`).toBeGreaterThanOrEqual(1.2)
    }
  })
})
