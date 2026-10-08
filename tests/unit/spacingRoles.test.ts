import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Die vier benannten Abstandsrollen (P2, §15.2 A2).
 *
 * Sie sind der Unterschied zwischen „p-4 irgendwo" und „das ist das Polster
 * einer Karte". Ohne Prüfung bliebe das eine Absicht: `p-karte` und `p-4`
 * erzeugen dieselben Pixel, und die nächste Karte schreibt wieder `p-4`. Diese
 * Prüfung hält fest, dass die Rollen existieren, auf dem Raster liegen und
 * wirklich benutzt werden.
 */
const ROLLEN = ['karte', 'zeile', 'abschnitt', 'rand'] as const

function css(): string {
  return readFileSync(join(process.cwd(), 'src', 'index.css'), 'utf8')
}

function quelldateien(): Array<{ pfad: string; inhalt: string }> {
  const dateien: Array<{ pfad: string; inhalt: string }> = []
  const durchlaufe = (pfad: string) => {
    for (const eintrag of readdirSync(pfad, { withFileTypes: true })) {
      const voll = join(pfad, eintrag.name)
      if (eintrag.isDirectory()) {
        durchlaufe(voll)
        continue
      }
      if (/\.tsx?$/.test(eintrag.name)) dateien.push({ pfad: voll, inhalt: readFileSync(voll, 'utf8') })
    }
  }
  durchlaufe(join(process.cwd(), 'src'))
  return dateien
}

describe('Abstandsrollen', () => {
  it('definiert die vier Rollen in @theme', () => {
    for (const rolle of ROLLEN) {
      expect(css(), `--spacing-${rolle} fehlt`).toContain(`--spacing-${rolle}:`)
    }
  })

  it('legt die Rollen auf das Tailwind-Raster', () => {
    // Keine zweite Skala: Jede Rolle ist ein Vielfaches von `--spacing`.
    for (const rolle of ROLLEN) {
      const treffer = css().match(new RegExp(`--spacing-${rolle}: ([^;]+);`))
      expect(treffer?.[1], `--spacing-${rolle}`).toContain('var(--spacing)')
    }
  })

  it('benutzt jede Rolle mindestens einmal', () => {
    const alles = quelldateien()
      .map((datei) => datei.inhalt)
      .join('\n')
    for (const [rolle, klasse] of [
      ['karte', 'p-karte'],
      ['zeile', 'space-y-zeile'],
      ['abschnitt', 'space-y-abschnitt'],
      ['rand', 'p-rand'],
    ] as const) {
      expect(alles, `Keine Stelle benutzt ${klasse} (Rolle „${rolle}")`).toContain(klasse)
    }
  })

  it('polstert die Karte über die Rolle statt über einen Schritt', () => {
    const styles = readFileSync(join(process.cwd(), 'src', 'ui', 'styles.ts'), 'utf8')
    const karte = styles.match(/export const card = '([^']+)'/)

    expect(karte?.[1]).toContain('p-karte')
    expect(karte?.[1]).not.toMatch(/\bp-\d/)
  })
})
