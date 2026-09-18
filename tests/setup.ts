/**
 * Globale Testeinrichtung.
 *
 * `fake-indexeddb` stellt eine IndexedDB-Implementierung im Speicher bereit.
 * Dadurch laufen alle Datenbank- und Sync-Tests gegen echtes Dexie – ohne
 * Browser und ohne Cloud.
 */
import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Ohne `globals: true` registriert Testing Library sein automatisches
// Aufräumen nicht selbst – ohne diesen Aufruf würden sich gerenderte
// Komponenten zwischen Tests ansammeln.
afterEach(() => {
  cleanup()
})

// jsdom implementiert `crypto.randomUUID` nicht in allen Versionen; die App
// nutzt es für Datensatz-IDs.
if (typeof globalThis.crypto === 'undefined') {
  throw new Error('WebCrypto fehlt – Node-Version zu alt für die Tests.')
}
if (typeof globalThis.crypto.randomUUID !== 'function') {
  let counter = 0
  Object.defineProperty(globalThis.crypto, 'randomUUID', {
    configurable: true,
    value: () => {
      counter += 1
      const suffix = String(counter).padStart(12, '0')
      return `00000000-0000-4000-8000-${suffix}`
    },
  })
}
