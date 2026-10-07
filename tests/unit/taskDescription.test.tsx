import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { TaskDescription } from '../../src/ui/TaskDescription'

/**
 * Die Beschreibung in der Übersicht.
 *
 * Geprüft wird das Verhalten – zugeklappt eine Zeile, aufgeklappt vollständig
 * lesbar. Wie eine Zeile aussieht und wann genau gekürzt wird, hängt an
 * Schriftgröße und Fensterbreite; das wird angesehen, nicht zugesichert.
 */
const TEXT = 'Erster Absatz.\n\nZweiter Absatz.'

describe('Beschreibung in der Übersicht', () => {
  it('ist zugeklappt und lässt sich aufklappen', async () => {
    render(<TaskDescription text={TEXT} />)

    const mehr = screen.getByRole('button', { name: 'Mehr' })
    expect(mehr).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByTestId('task-description')).toHaveTextContent('Erster Absatz.')

    await userEvent.click(mehr)

    const weniger = screen.getByRole('button', { name: 'Weniger' })
    expect(weniger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByTestId('task-description')).toHaveTextContent('Zweiter Absatz.')
  })

  it('lässt sich wieder zuklappen', async () => {
    render(<TaskDescription text={TEXT} />)

    await userEvent.click(screen.getByRole('button', { name: 'Mehr' }))
    await userEvent.click(screen.getByRole('button', { name: 'Weniger' }))

    expect(screen.getByRole('button', { name: 'Mehr' })).toHaveAttribute('aria-expanded', 'false')
  })
})
