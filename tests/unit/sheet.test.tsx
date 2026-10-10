import { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BackLayerProvider } from '../../src/app/BackLayerProvider'
import { Screen } from '../../src/ui/components/Screen'
import { Sheet } from '../../src/ui/components/Sheet'

/**
 * Der Dialogvertrag des Blattes.
 *
 * Was hier **einmal** geprüft wird, musste vorher in jedem der vier Dialoge
 * stimmen: Rolle und Name für Vorleseprogramme, Escape über den Zurück-Stapel,
 * der Fokus im Dialog und der Weg zurück zum auslösenden Element.
 *
 * Escape kommt aus `BackLayerProvider` – deshalb wird das Blatt darin gerendert.
 */
function zeige(props: { onBack?: () => void } = {}) {
  const onClose = vi.fn()
  const ergebnis = render(
    <BackLayerProvider>
      <Sheet title="Liste verwalten" onClose={onClose} onBack={props.onBack}>
        <button type="button">Erster</button>
        <button type="button">Letzter</button>
      </Sheet>
    </BackLayerProvider>,
  )
  return { onClose, ...ergebnis }
}

describe('Sheet', () => {
  it('meldet sich als Dialog mit Namen an', () => {
    zeige()
    expect(screen.getByRole('dialog', { name: 'Liste verwalten' })).toBeInTheDocument()
  })

  it('nimmt einen abweichenden Namen an – die Überschrift bleibt sichtbar', () => {
    const onClose = vi.fn()
    render(
      <BackLayerProvider>
        <Sheet label="Aufgabe verschieben" title="Verschieben nach" onClose={onClose}>
          <p>Inhalt</p>
        </Sheet>
      </BackLayerProvider>,
    )

    expect(screen.getByRole('dialog', { name: 'Aufgabe verschieben' })).toBeInTheDocument()
    expect(screen.getByText('Verschieben nach')).toBeInTheDocument()
  })

  it('schließt mit Escape', async () => {
    const user = userEvent.setup()
    const { onClose } = zeige()

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('geht mit Escape eine Stufe zurück, wenn es eine gibt', async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    const { onClose } = zeige({ onBack })

    await user.keyboard('{Escape}')
    expect(onBack).toHaveBeenCalledOnce()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('schließt über den Schließen-Knopf', async () => {
    const user = userEvent.setup()
    const { onClose } = zeige()

    await user.click(screen.getByRole('button', { name: 'Schließen' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('hält den Fokus im Dialog', async () => {
    const user = userEvent.setup()
    zeige()

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveFocus()

    // Zwei Tab-Schritte über den letzten Knopf hinaus bleiben im Dialog.
    await user.tab()
    await user.tab()
    await user.tab()
    expect(dialog.contains(document.activeElement)).toBe(true)
  })

  it('gibt den Fokus beim Schließen zurück', () => {
    const auslöser = document.createElement('button')
    auslöser.textContent = 'Öffnen'
    document.body.append(auslöser)
    auslöser.focus()

    const { unmount } = zeige()
    expect(screen.getByRole('dialog')).toHaveFocus()

    unmount()
    expect(auslöser).toHaveFocus()
    auslöser.remove()
  })

  it('hält den Hintergrund beim Schließen eines verschachtelten Dialogs gesperrt und bewahrt vorherige Sperren', async () => {
    const user = userEvent.setup()
    const zuvorGesperrt = document.createElement('div')
    zuvorGesperrt.inert = true
    document.body.append(zuvorGesperrt)
    function Dialoge() {
      const [nested, setNested] = useState(false)
      return <BackLayerProvider>
        <div data-testid="hintergrund">Liste</div>
        <Sheet title="Außen" onClose={vi.fn()}>
          <button onClick={() => setNested(true)}>Innen öffnen</button>
        </Sheet>
        {nested ? <Sheet title="Innen" onClose={() => setNested(false)}><p>Bestätigung</p></Sheet> : null}
      </BackLayerProvider>
    }
    const { unmount } = render(<Dialoge />)
    const hintergrund = screen.getByTestId('hintergrund')
    expect(hintergrund.inert).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Innen öffnen' }))
    const innen = screen.getByRole('dialog', { name: 'Innen' })
    expect(screen.getByRole('dialog', { name: 'Außen' }).parentElement!.inert).toBe(true)
    await user.click(within(innen).getByRole('button', { name: 'Schließen' }))
    expect(hintergrund.inert).toBe(true)
    expect(screen.getByRole('dialog', { name: 'Außen' }).parentElement!.inert).toBeFalsy()
    expect(screen.getByRole('button', { name: 'Innen öffnen' })).toHaveFocus()
    unmount()
    expect(hintergrund.inert).toBeFalsy()
    expect(zuvorGesperrt.inert).toBe(true)
    zuvorGesperrt.remove()
  })

  it('gibt den Fokus nach einem Austausch des Auslösers seinem fachlichen Gegenpart zurück', () => {
    const hintergrund = document.createElement('div')
    const vorher = document.createElement('button')
    vorher.dataset.focusKey = 'task:123'
    hintergrund.append(vorher)
    document.body.append(hintergrund)
    vorher.focus()
    const { unmount } = zeige()
    const nachher = document.createElement('button')
    nachher.dataset.focusKey = 'task:123'
    vorher.replaceWith(nachher)
    unmount()
    expect(nachher).toHaveFocus()
    hintergrund.remove()
  })

  it('bleibt beim ersten Shift+Tab vom Dialograhmen im Dialog', async () => {
    const user = userEvent.setup()
    zeige()
    expect(screen.getByRole('dialog')).toHaveFocus()

    await user.tab({ shift: true })

    expect(screen.getByRole('button', { name: 'Letzter' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Schließen' })).toHaveFocus()
  })
})

/**
 * Dieselbe Mechanik, andere Form: Die Detailansicht füllt die ganze Fläche.
 * Geprüft wird, dass `Screen` denselben Dialogvertrag erfüllt – dafür sorgt
 * `useDialog`.
 */
describe('Screen', () => {
  it('hält den Fokus auch ohne erreichbare Bedienelemente', async () => {
    const user = userEvent.setup()
    render(
      <BackLayerProvider>
        <Screen label="Warten" onClose={vi.fn()} header={<header>Warten</header>}>
          <p>Wird geladen.</p>
        </Screen>
      </BackLayerProvider>,
    )

    await user.tab({ shift: true })
    expect(screen.getByRole('dialog')).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('dialog')).toHaveFocus()
  })

  it('meldet sich als Dialog mit Namen an und zeigt die Kopfleiste', () => {
    const onClose = vi.fn()
    render(
      <BackLayerProvider>
        <Screen label="Aufgabe" onClose={onClose} header={<header>Kopfleiste</header>}>
          <p>Formular</p>
        </Screen>
      </BackLayerProvider>,
    )

    expect(screen.getByRole('dialog', { name: 'Aufgabe' })).toBeInTheDocument()
    expect(screen.getByText('Kopfleiste')).toBeInTheDocument()
    expect(screen.getByText('Formular')).toBeInTheDocument()
  })

  it('schließt mit Escape', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <BackLayerProvider>
        <Screen label="Aufgabe" onClose={onClose} header={<header>Kopf</header>}>
          <p>Formular</p>
        </Screen>
      </BackLayerProvider>,
    )

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledOnce()
  })
})
