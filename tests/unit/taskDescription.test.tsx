import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { useState } from 'react'
import { TaskDescription } from '../../src/ui/TaskDescription'

/**
 * Die Beschreibung in der Übersicht.
 *
 * Geprüft wird das Verhalten – zugeklappt eine Zeile, aufgeklappt vollständig
 * lesbar. Wie eine Zeile aussieht und wann genau gekürzt wird, hängt an
 * Schriftgröße und Fensterbreite; das wird angesehen, nicht zugesichert.
 */
function Description({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  return <TaskDescription text={text} open={open} onToggle={() => setOpen(value => !value)} />
}

const TEXT = 'Erster Absatz.\n\nZweiter Absatz.'

describe('Beschreibung in der Übersicht', () => {
  it('ist zugeklappt und lässt sich aufklappen', async () => {
    render(<Description text={TEXT} />)

    const mehr = screen.getByRole('button', { name: 'Notiz aufklappen' })
    expect(mehr).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByTestId('task-description')).toHaveTextContent('Erster Absatz.')
    expect(screen.getByTestId('task-description')).not.toHaveTextContent('Zweiter Absatz.')

    await userEvent.click(mehr)

    const weniger = screen.getByRole('button', { name: 'Notiz einklappen' })
    expect(weniger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByTestId('task-description')).toHaveTextContent('Zweiter Absatz.')
  })

  it('klappt beim Klick auf den Vorschautext auf', async () => {
    render(<Description text={TEXT} />)
    await userEvent.click(screen.getByTestId('task-description'))
    expect(screen.getByRole('button', { name: 'Notiz einklappen' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByTestId('task-description')).toHaveTextContent('Zweiter Absatz.')
  })

  it('lässt sich wieder zuklappen', async () => {
    render(<Description text={TEXT} />)

    await userEvent.click(screen.getByRole('button', { name: 'Notiz aufklappen' }))
    await userEvent.click(screen.getByRole('button', { name: 'Notiz einklappen' }))

    expect(screen.getByRole('button', { name: 'Notiz aufklappen' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByTestId('task-description')).not.toHaveTextContent('Zweiter Absatz.')
  })

  it('beendet auch bei Windows-Zeilenumbrüchen die Vorschau am ersten Absatz', () => {
    render(<Description text={'Erste Zeile.\r\nZweite Zeile.'} />)
    expect(screen.getByTestId('task-description').textContent).toBe('Erste Zeile.…')
  })
})
