import { afterEach, describe, expect, it, vi } from 'vitest'
import { createWorkspaceRuntime, type WorkspaceRuntime } from '../../src/app/workspaceRuntime'
import { FakeNetworkMonitor } from '../support/fakeAuth'
import { createFakeServer } from '../support/fakeGateway'

/**
 * Die Laufzeit des Arbeitsbereichs (Integration).
 *
 * Sie ist bewusst **React-frei**: Datenbank öffnen, Abgleich, Erinnerungen,
 * Entprellung und Zeitgeber stecken in einer Funktion mit klarem Anfang und
 * Ende. Vorher lag das in `WorkspaceProvider`; ein Test dafür brauchte React.
 *
 * Geprüft wird, was die Oberfläche von ihr erwartet: eine Momentaufnahme, die
 * sich bei Änderungen meldet, ein Abgleich nach lokalen Änderungen – und ein
 * sauberes Ende, nach dem nichts mehr nachkommt.
 */
describe('Arbeitsbereich-Laufzeit', () => {
  const laufzeiten: WorkspaceRuntime[] = []

  afterEach(() => {
    for (const laufzeit of laufzeiten.splice(0)) laufzeit.schliessen()
  })

  async function starte() {
    const server = createFakeServer()
    const userId = 'user-laufzeit'
    const laufzeit = await createWorkspaceRuntime({
      userId,
      gateway: server.gatewayFor(userId),
      network: new FakeNetworkMonitor(true),
    })
    laufzeiten.push(laufzeit)
    return { server, laufzeit }
  }

  it('meldet sich bei Änderungen und zählt die Datensicht hoch', async () => {
    const { laufzeit } = await starte()
    const meldungen = vi.fn()
    const abmelden = laufzeit.abonnieren(meldungen)

    expect(laufzeit.zustand().datenVersion).toBe(0)

    await laufzeit.repositories.createList('Haushalt', 'user-laufzeit')

    expect(laufzeit.zustand().datenVersion).toBe(1)
    expect(meldungen).toHaveBeenCalled()

    abmelden()
    const vorher = meldungen.mock.calls.length
    await laufzeit.repositories.createList('Zweite', 'user-laufzeit')
    expect(meldungen.mock.calls.length).toBe(vorher)
  })

  it('zählt eine lokale Eingabehilfe für die Anzeige, aber nicht für den Abgleich', async () => {
    const { laufzeit } = await starte()
    const vorher = laufzeit.zustand().datenVersion

    await laufzeit.repositories.setReminderPresets([10, 60])

    expect(laufzeit.zustand().datenVersion).toBe(vorher + 1)
  })

  it('gleicht nach einer lokalen Änderung entprellt ab', async () => {
    const { server, laufzeit } = await starte()
    const liste = await laufzeit.repositories.createList('Haushalt', 'user-laufzeit')
    await laufzeit.repositories.createTask({ listId: liste.id, title: 'Milch' })

    // Die Entprellung sammelt schnelle Änderungen (400 ms).
    await new Promise((fertig) => setTimeout(fertig, 800))

    // Der Server kennt die Liste: Der entprellte Abgleich hat hochgeladen.
    expect([...server.lists.values()].map((zeile) => zeile.name)).toContain('Haushalt')
    expect(laufzeit.zustand().syncStatus?.kind).toBe('ok')
    expect(laufzeit.zustand().pendingCount).toBe(0)
  })

  it('meldet nach dem Schließen nichts mehr', async () => {
    const { laufzeit } = await starte()
    const meldungen = vi.fn()
    laufzeit.abonnieren(meldungen)

    laufzeit.schliessen()
    const vorher = laufzeit.zustand()
    await laufzeit.repositories.createList('Nach dem Schluss', 'user-laufzeit')

    expect(laufzeit.zustand()).toBe(vorher)
    expect(meldungen).not.toHaveBeenCalled()
  })
})
