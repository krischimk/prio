import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Bewegungsreduktion (P46, P56).
 *
 * Sie ist eine Funktion des Systems, kein Medienmerkmal der App: Wer
 * „Bewegung reduzieren" eingestellt hat – aus Gewohnheit, wegen
 * Übelkeit oder weil ein Vorleseprogramm sonst ausgebremst wird –, bekommt
 * keine Übergänge mehr.
 */
function css(): string {
  return readFileSync(join(process.cwd(), 'src', 'index.css'), 'utf8')
}

describe('Bewegungsreduktion', () => {
  it('schaltet Übergänge und Animationen ab, wenn das System es verlangt', () => {
    const quelle = css()
    const block = quelle.match(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n\}/)

    expect(block, 'Der Block fehlt in src/index.css.').not.toBeNull()
    expect(block?.[0]).toContain('transition-duration: 0.01ms')
    expect(block?.[0]).toContain('animation-duration: 0.01ms')
  })
})
