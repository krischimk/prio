import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Markdown } from '../../src/ui/Markdown'

/** Was der Nutzer liest: keine Sternchen, keine Rauten. */
describe('Anmerkungen anzeigen', () => {
  it('zeigt Auszeichnungen als Text, nicht als Zeichen', () => {
    const { container } = render(
      <Markdown text={'## Neu\n* **Fett** und `Code`\n* Zweiter Punkt'} />,
    )

    expect(screen.getByText('Neu')).toBeVisible()
    expect(screen.getByText('Fett')).toBeVisible()
    expect(screen.getByText('Code')).toBeVisible()
    expect(screen.getByText('Zweiter Punkt')).toBeVisible()

    const sichtbar = container.textContent ?? ''
    expect(sichtbar).not.toContain('**')
    expect(sichtbar).not.toContain('`')
    expect(sichtbar).not.toContain('##')
  })
})
