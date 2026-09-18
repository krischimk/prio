import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { App } from '../../src/App'
import type { AppServices } from '../../src/app/services'
import { FakeAuthPort, FakeNetworkMonitor } from '../support/fakeAuth'
import { createFakeServer, createLazyGateway } from '../support/fakeGateway'

/**
 * Integrationstests der Oberfläche.
 *
 * Hier wird die echte App gerendert – mit Dexie (fake-indexeddb), der echten
 * Sync-Engine und der echten Geschäftslogik. Nur Supabase Auth und Supabase
 * selbst sind durch Fakes ersetzt. Damit sind die geforderten Abläufe
 * (Anmelden, Listen laden, Aufgabe anlegen, Sync auslösen, Serveränderungen
 * übernehmen) ohne Cloud-Zugriff prüfbar.
 */

function createServices() {
  const server = createFakeServer()
  const auth = new FakeAuthPort()
  const network = new FakeNetworkMonitor(true)
  const services: AppServices = {
    auth,
    network,
    gateway: createLazyGateway(server, () => auth.currentUser?.id ?? ''),
  }
  return { server, auth, network, services }
}

afterEach(() => {
  window.localStorage.clear()
})

describe('App-Integration', () => {
  it('meldet an, lädt Listen, speichert eine Aufgabe lokal und synchronisiert', async () => {
    const user = userEvent.setup()
    const { server, services } = createServices()

    render(<App services={services} />)

    // --- Registrierung -------------------------------------------------------
    await user.click(await screen.findByRole('button', { name: 'Registrieren' }))
    await user.type(screen.getByLabelText('E-Mail'), 'test@example.com')
    await user.type(screen.getByLabelText('Passwort'), 'geheim123')
    await user.click(screen.getByRole('button', { name: 'Konto erstellen' }))

    expect(await screen.findByText('Noch keine Liste vorhanden.')).toBeInTheDocument()
    expect(screen.getByTestId('current-user')).toHaveTextContent('test@example.com')

    // --- Liste anlegen -------------------------------------------------------
    await user.type(screen.getByLabelText('Name der neuen Liste'), 'Arbeit')
    await user.click(screen.getByRole('button', { name: 'Liste anlegen' }))

    expect(await screen.findByTestId('list-title')).toHaveTextContent('Arbeit')

    // --- Aufgabe anlegen (wirkt sofort, ohne Serverantwort) ------------------
    await user.type(screen.getByLabelText('Neue Aufgabe'), 'Bericht schreiben')
    await user.click(screen.getByRole('button', { name: 'Hinzufügen' }))

    expect(await screen.findByText('Bericht schreiben')).toBeInTheDocument()

    // --- Sync läuft automatisch und lädt hoch --------------------------------
    await waitFor(() => expect(server.tasks.size).toBe(1), { timeout: 5000 })
    expect(server.lists.size).toBe(1)
    expect([...server.tasks.values()][0]?.title).toBe('Bericht schreiben')

    // --- Serveränderung wird beim nächsten Sync übernommen -------------------
    const remoteTask = [...server.tasks.values()][0]
    expect(remoteTask).toBeDefined()
    server.tasks.set(remoteTask!.id, {
      ...remoteTask!,
      title: 'Vom Server geändert',
      updated_at: '2030-01-01T00:00:00.000Z',
    })

    await user.click(screen.getByRole('button', { name: 'Jetzt synchronisieren' }))

    expect(await screen.findByText('Vom Server geändert')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('sync-status')).toHaveTextContent('Alles synchronisiert'))
  })

  it('zeigt nach der Anmeldung die bereits auf dem Server vorhandenen Listen', async () => {
    const user = userEvent.setup()
    const { server, auth, services } = createServices()

    // Auf dem Server liegt bereits eine Liste von einem anderen Gerät.
    const account = auth.seed('bestand@example.com', 'geheim123')
    server.registerAccount('bestand@example.com', account.id)
    server.lists.set('liste-1', {
      id: 'liste-1',
      owner_id: account.id,
      name: 'Vom anderen Gerät',
      is_shared: false,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      deleted_at: null,
    })
    server.tasks.set('task-1', {
      id: 'task-1',
      list_id: 'liste-1',
      title: 'Vorhandene Aufgabe',
      description: null,
      due_at: null,
      completed: false,
      position: 0,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      deleted_at: null,
    })

    render(<App services={services} />)

    await user.type(await screen.findByLabelText('E-Mail'), 'bestand@example.com')
    await user.type(screen.getByLabelText('Passwort'), 'geheim123')
    await user.click(screen.getByRole('button', { name: 'Anmelden' }))

    expect(await screen.findByTestId('list-title')).toHaveTextContent('Vom anderen Gerät')
    expect(await screen.findByText('Vorhandene Aufgabe')).toBeInTheDocument()
  })

  it('bleibt offline vollständig bedienbar und meldet den Zustand', async () => {
    const user = userEvent.setup()
    const { server, network, services } = createServices()

    render(<App services={services} />)

    await user.click(await screen.findByRole('button', { name: 'Registrieren' }))
    await user.type(screen.getByLabelText('E-Mail'), 'offline@example.com')
    await user.type(screen.getByLabelText('Passwort'), 'geheim123')
    await user.click(screen.getByRole('button', { name: 'Konto erstellen' }))
    await screen.findByText('Noch keine Liste vorhanden.')

    // Netzwerk abschalten …
    network.setOnline(false)
    await user.type(screen.getByLabelText('Name der neuen Liste'), 'Offline-Liste')
    await user.click(screen.getByRole('button', { name: 'Liste anlegen' }))
    await user.type(await screen.findByLabelText('Neue Aufgabe'), 'Offline-Aufgabe')
    await user.click(screen.getByRole('button', { name: 'Hinzufügen' }))

    // … die Aufgabe erscheint trotzdem.
    expect(await screen.findByText('Offline-Aufgabe')).toBeInTheDocument()
    expect(server.lists.size).toBe(0)

    await user.click(screen.getByRole('button', { name: 'Jetzt synchronisieren' }))
    expect(await screen.findByTestId('sync-status')).toHaveTextContent(
      'Offline – Änderungen werden später synchronisiert.',
    )

    // Wieder online: der nächste Sync lädt alles hoch.
    network.setOnline(true)
    await waitFor(() => expect(server.tasks.size).toBe(1), { timeout: 5000 })
  })

  it('weist auf eine fehlende Supabase-Konfiguration hin, statt abzustürzen', () => {
    render(<App services={null} />)
    expect(screen.getByText('Supabase ist nicht konfiguriert')).toBeInTheDocument()
  })
})
