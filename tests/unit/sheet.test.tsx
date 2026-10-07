import { render, screen } from '@testing-library/react'
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
})

/**
 * Dieselbe Mechanik, andere Form: Die Detailansicht füllt die ganze Fläche.
 * Geprüft wird, dass `Screen` denselben Dialogvertrag erfüllt – dafür sorgt
 * `useDialog`.
 */
describe('Screen', () => {
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
