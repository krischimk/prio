import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button } from '../../src/ui/components/Button'
import { IconButton } from '../../src/ui/components/IconButton'

/**
 * Die Bausteine der Oberfläche.
 *
 * Geprüft wird, was die Bausteine **zusichern** – nicht, wie sie aussehen:
 *
 *   * Größe und Art kommen aus der Skala (`styles.ts`), nicht aus angehängten
 *     Klassen. Angehängte Klassen wirken bei Tailwind nicht; genau daran sind
 *     22 „kompakte" Knöpfe gescheitert, die nie kompakt waren.
 *   * Ein Knopf in einem Formular schickt nicht ab, solange `type` nichts
 *     anderes sagt. Der Browser nähme sonst `submit`.
 *   * Ein Symbolknopf hat einen Namen für Vorleseprogramme – der Typ erzwingt
 *     ihn (siehe `@ts-expect-error` unten).
 *   * Der Fokusring kommt aus der gemeinsamen Konstante und fehlt damit auch
 *     den neun Knöpfen nicht mehr, die vorher von Hand geschrieben waren.
 */
describe('Button', () => {
  it('nimmt Größe und Art aus der Skala', () => {
    render(
      <Button variant="ghost" size="sm">
        Speichern
      </Button>,
    )

    const knopf = screen.getByRole('button', { name: 'Speichern' })
    expect(knopf.className).toContain('px-2')
    expect(knopf.className).toContain('text-ink-muted')
    expect(knopf.className).toContain('focus-visible:outline')
  })

  it('schickt ohne ausdrückliches type nicht ab', () => {
    render(<Button>Weiter</Button>)
    expect(screen.getByRole('button', { name: 'Weiter' })).toHaveAttribute('type', 'button')
  })

  it('lässt submit ausdrücklich zu', () => {
    render(<Button type="submit">Speichern</Button>)
    expect(screen.getByRole('button', { name: 'Speichern' })).toHaveAttribute('type', 'submit')
  })

  it('reicht Layout durch und meldet den Klick', async () => {
    const user = userEvent.setup()
    const klick = vi.fn()
    render(
      <Button layout="w-full" onClick={klick}>
        Los
      </Button>,
    )

    const knopf = screen.getByRole('button', { name: 'Los' })
    expect(knopf.className).toContain('w-full')
    await user.click(knopf)
    expect(klick).toHaveBeenCalledOnce()
  })
})

describe('IconButton', () => {
  it('bringt den gemeinsamen Fokusring mit', () => {
    render(<IconButton aria-label="Schließen">×</IconButton>)
    expect(screen.getByRole('button', { name: 'Schließen' }).className).toContain(
      'focus-visible:outline',
    )
  })

  it('verlangt einen Namen für Vorleseprogramme', () => {
    // @ts-expect-error Ohne `aria-label` ist das Symbol für Vorleseprogramme nicht vorhanden (DESIGN.md P53) – der Typ lässt es nicht zu.
    render(<IconButton>×</IconButton>)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })
})
