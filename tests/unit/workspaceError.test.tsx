import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { WorkspaceError } from '../../src/ui/WorkspaceError'

/**
 * Der Fehlerzustand beim Öffnen der lokalen Datenbank.
 *
 * Vorher blieb die Ladeanzeige für immer stehen: Der Fehler wurde verschluckt
 * (`setRuntime(null)`), und die Oberfläche wartete auf etwas, das nie kommt.
 * Der Zustand ist einer der vier, die jeder Bildschirm haben soll (P34).
 */
describe('WorkspaceError', () => {
  it('benennt den Fehler und sagt, was zu tun ist', () => {
    render(<WorkspaceError onRetry={() => {}} />)

    const meldung = screen.getByRole('alert')
    expect(meldung.textContent).toContain('ließen sich nicht öffnen')
    expect(meldung.textContent).toContain('noch einmal')
  })

  it('bietet einen Weg zurück', async () => {
    const onRetry = vi.fn()
    render(<WorkspaceError onRetry={onRetry} />)

    await userEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }))

    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
