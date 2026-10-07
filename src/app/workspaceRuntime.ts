import { createRepositories, type Repositories } from '../db/repositories'
import { openLocalDatabase } from '../db/localDb'
import { countAbgelehnt, countDirty } from '../sync/syncStore'
import { createSyncEngine, type SyncResult } from '../sync/syncEngine'
import { createShareListAction } from '../sync/shareList'
import { createCapacitorNotificationsPort } from '../reminders/capacitorNotifications'
import {
  createReminderService,
  type ReminderStatus,
} from '../reminders/reminderService'
import type { NetworkMonitor } from '../sync/network'
import type { RemoteGateway } from '../sync/remoteGateway'
import { withChangeTracking } from './trackedRepositories'

/** Wie lange eine lokale Änderung gesammelt wird, bevor abgeglichen wird. */
const LOKALE_AENDERUNG_ENTPRELLUNG_MS = 400
/** Der regelmäßige Abgleich im Hintergrund. */
const REGELMAESSIGER_ABGLEICH_MS = 30_000

/**
 * Was die Oberfläche vom Arbeitsbereich braucht – als eine Momentaufnahme.
 *
 * Alles, was sich ändern kann, steht hier drin; die Oberfläche abonniert sie
 * (`abonnieren`) statt einzelne Zustandszellen zu halten.
 */
export interface WorkspaceZustand {
  /** Zähler für die Lese-Hooks: erhöht sich bei jeder Änderung der lokalen DB. */
  datenVersion: number
  syncStatus: SyncResult | null
  syncing: boolean
  /** Offene Änderungen, die noch übertragen werden können. */
  pendingCount: number
  /** Änderungen, die der Server dauerhaft ablehnt (Ablagefach). */
  rejectedCount: number
  reminderStatus: ReminderStatus | null
}

/**
 * Die Laufzeit eines angemeldeten Benutzers – **ohne React**.
 *
 * Hier wird alles zusammengesteckt, was nur mit einem Benutzer existiert:
 * lokale Datenbank, Geschäftslogik, Sync-Engine, Erinnerungen und die
 * Zeitsteuerung (Entprellung, regelmäßiger Abgleich, „wieder online“).
 *
 * Warum getrennt von der Komponente: Vorher lag das alles in
 * `WorkspaceProvider` – Datenbankaufbau, Cloud-Aufruf, Timer, Fehlerbehandlung
 * und eine Ladeansicht in einer Datei. Ein Test dafür brauchte React, und jede
 * Änderung an der Oberfläche musste diese Datei anfassen. Die Laufzeit ist
 * jetzt eine Funktion mit klarem Anfang und Ende (`schliessen`).
 *
 * Nebenläufigkeit: Ein Abgleich läuft nie zweimal gleichzeitig (siehe
 * `syncEngine.ts`). Lokale Änderungen lösen einen entprellten Abgleich aus,
 * damit schnelles Tippen nicht viele Anfragen erzeugt.
 */
export interface WorkspaceRuntime {
  repositories: Repositories
  shareListByEmail: ReturnType<typeof createShareListAction>
  /** Die aktuelle Momentaufnahme (stabil, solange sich nichts ändert). */
  zustand: () => WorkspaceZustand
  /** Abonniert Änderungen; gibt die Abmelde-Funktion zurück. */
  abonnieren: (hoerer: () => void) => () => void
  synchronisieren: () => Promise<void>
  erinnerungenAuffrischen: () => Promise<void>
  erinnerungenErlauben: () => Promise<void>
  /** Beendet Timer und Abonnements. Die Datenbankverbindung bleibt bestehen. */
  schliessen: () => void
}

export async function createWorkspaceRuntime({
  userId,
  gateway,
  network,
}: {
  userId: string
  gateway: RemoteGateway
  network: NetworkMonitor
}): Promise<WorkspaceRuntime> {
  const database = await openLocalDatabase(userId)
  const engine = createSyncEngine({
    db: database,
    gateway,
    currentUserId: userId,
    isOnline: () => network.isOnline(),
  })
  const reminders = createReminderService({
    db: database,
    port: createCapacitorNotificationsPort(),
    viewerId: userId,
  })

  let zustand: WorkspaceZustand = {
    datenVersion: 0,
    syncStatus: null,
    syncing: false,
    pendingCount: 0,
    rejectedCount: 0,
    reminderStatus: null,
  }
  const hoerer = new Set<() => void>()
  let geschlossen = false
  let entprellung: ReturnType<typeof setTimeout> | null = null

  /** Setzt einen Teil der Momentaufnahme und benachrichtigt die Oberfläche. */
  const melde = (teil: Partial<WorkspaceZustand>) => {
    zustand = { ...zustand, ...teil }
    for (const hoererEintrag of hoerer) hoererEintrag()
  }

  /**
   * Nach jeder schreibenden Operation: neu zeichnen **und** abgleichen.
   *
   * Zwei getrennte Zähler sind wichtig: `datenVersion` erhöht sich bei jeder
   * Änderung (auch durch einen Pull), der Abgleich hängt aber nur an lokalen
   * Benutzeränderungen. Liefe der Pull ebenfalls in den Abgleich, entstünde eine
   * Endlosschleife (Pull → Zähler → Abgleich → Pull → …).
   */
  function lokaleAenderung() {
    if (geschlossen) return
    melde({ datenVersion: zustand.datenVersion + 1 })
    if (entprellung) clearTimeout(entprellung)
    entprellung = setTimeout(() => {
      entprellung = null
      void synchronisieren()
      // Lokale Änderungen wirken sofort auf die Erinnerungen – auch offline.
      void erinnerungenAuffrischen()
    }, LOKALE_AENDERUNG_ENTPRELLUNG_MS)
    void offeneAenderungenZaehlen()
  }

  /**
   * Für lokale Eingabehilfen (vorgemerkte Vorlaufzeiten, schon geteilte
   * Adressen): neu zeichnen, aber **keinen** Abgleich auslösen.
   *
   * Diese Daten kennt der Server nicht und braucht sie nicht. Zählte man sie
   * wie Datenänderungen, löst der Abgleich, der sie auffrischt, gleich den
   * nächsten aus – die App synchronisiert dann im Sekundentakt.
   */
  function nurLokaleAenderung() {
    if (geschlossen) return
    melde({ datenVersion: zustand.datenVersion + 1 })
  }

  async function offeneAenderungenZaehlen() {
    const [pending, abgelehnt] = await Promise.all([
      countDirty(database),
      countAbgelehnt(database),
    ])
    if (!geschlossen) melde({ pendingCount: pending, rejectedCount: abgelehnt })
  }

  async function erinnerungenAuffrischen() {
    if (geschlossen) return
    const status = await reminders.sync()
    if (!geschlossen) melde({ reminderStatus: status })
  }

  async function erinnerungenErlauben() {
    const status = await reminders.enable()
    if (!geschlossen) melde({ reminderStatus: status })
  }

  async function synchronisieren() {
    if (geschlossen) return
    melde({ syncing: true })
    let pulled = 0
    try {
      const result = await engine.sync()
      pulled = result.pulled
      if (geschlossen) return
      melde({ syncStatus: result })

      /*
       * Vorschläge für das Teilen auffrischen: Wer mit mir eine Liste teilt,
       * soll beim nächsten Teilen vorgeschlagen werden – auch wenn ich die
       * Adresse nie selbst eingetippt habe. Bewusst ohne Wirkung auf den
       * Abgleich: Schlägt es fehl (offline, ältere Serverfassung), bleiben die
       * bisherigen Vorschläge stehen.
       */
      try {
        const kontakte = await gateway.coMemberContacts()
        await repositories.mergeShareContacts(kontakte, new Date().toISOString())
      } catch {
        // Der Abgleich ist wichtiger als die Vorschläge.
      }

      // Nach einem Pull kann sich lokal etwas geändert haben – die Anzeige muss
      // neu lesen, aber ohne einen weiteren Abgleich auszulösen.
      if (result.pulled > 0) melde({ datenVersion: zustand.datenVersion + 1 })
    } finally {
      if (!geschlossen) melde({ syncing: false })
      await offeneAenderungenZaehlen()
      // Nur wenn wirklich neue Daten angekommen sind: Erinnerungen nachziehen.
      if (pulled > 0) await erinnerungenAuffrischen()
    }
  }

  const repositories = withChangeTracking(
    createRepositories(database),
    lokaleAenderung,
    nurLokaleAenderung,
  )

  const shareListByEmail = createShareListAction({
    gateway,
    repositories,
    sync: synchronisieren,
  })

  // Erster Abgleich nach dem Anmelden, danach regelmäßig und bei „wieder online“.
  void synchronisieren()
  // Erinnerungen einmalig aufbauen – unabhängig davon, ob der Abgleich etwas
  // bewegt hat (etwa beim Start mit bereits vorhandenen Aufgaben).
  void erinnerungenAuffrischen()
  const interval = setInterval(() => {
    if (network.isOnline()) void synchronisieren()
  }, REGELMAESSIGER_ABGLEICH_MS)
  const netzAbmelden = network.subscribe((online) => {
    if (online) void synchronisieren()
  })

  return {
    repositories,
    shareListByEmail,
    zustand: () => zustand,
    abonnieren: (hoererEintrag) => {
      hoerer.add(hoererEintrag)
      return () => {
        hoerer.delete(hoererEintrag)
      }
    },
    synchronisieren,
    erinnerungenAuffrischen,
    erinnerungenErlauben,
    schliessen: () => {
      geschlossen = true
      if (entprellung) clearTimeout(entprellung)
      clearInterval(interval)
      netzAbmelden()
      hoerer.clear()
      // Die Datenbankverbindung bleibt bewusst offen: Die Daten liegen lokal,
      // und ein erneutes Anmelden soll sie sofort wiederfinden (README,
      // „Bekannte Kleinigkeiten“).
    },
  }
}
