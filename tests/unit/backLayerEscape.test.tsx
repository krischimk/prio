import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { BackLayerProvider } from '../../src/app/BackLayerProvider'
import { useBackLayer } from '../../src/app/useBackLayer'

/**
 * Escape ist der Weg zurück auf dem Rechner.
 *
 * Anlass: Der Wiederherstellen-Dialog behauptete in seinem Kommentar, Escape
 * schließe ihn – tatsächlich kannte nur das Menü der mobilen Ansicht die
 * Taste, und in der breiten Ansicht ließ sich kein Dialog damit schließen.
 * Deshalb liegt die Tastatur jetzt im `BackLayerProvider`: Android-Zurück und
 * Escape arbeiten denselben Stapel ab, und es schließt immer nur die **oberste**
 * Ebene.
 *
 * Dass Escape die App nicht beendet (`minimizeApp`), ist hier mitgeprüft: Ohne
 * Ebene darf nichts passieren.
 */
function Ebene({ name, anfangsOffen = true }: { name: string; anfangsOffen?: boolean }) {
  const [offen, setOffen] = useState(anfangsOffen)
  useBackLayer(offen, () => setOffen(false))
  return <p>{offen ? `${name}: offen` : `${name}: zu`}</p>
}

describe('Escape und der Zurück-Stapel', () => {
  it('schließt eine offene Ebene', async () => {
    const user = userEvent.setup()
    render(
      <BackLayerProvider>
        <Ebene name="Erste" />
      </BackLayerProvider>,
    )

    expect(screen.getByText('Erste: offen')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.getByText('Erste: zu')).toBeInTheDocument()
  })

  it('schließt nur die zuletzt geöffnete Ebene', async () => {
    const user = userEvent.setup()
    render(
      <BackLayerProvider>
        <Ebene name="Erste" />
        <Ebene name="Zweite" />
      </BackLayerProvider>,
    )

    await user.keyboard('{Escape}')
    expect(screen.getByText('Zweite: zu')).toBeInTheDocument()
    expect(screen.getByText('Erste: offen')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.getByText('Erste: zu')).toBeInTheDocument()
  })

  it('tut nichts, wenn keine Ebene offen ist', async () => {
    const user = userEvent.setup()
    render(
      <BackLayerProvider>
        <Ebene name="Erste" anfangsOffen={false} />
      </BackLayerProvider>,
    )

    await user.keyboard('{Escape}')
    expect(screen.getByText('Erste: zu')).toBeInTheDocument()
  })
})
