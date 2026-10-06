/**
 * Text für das Datenziel, mit dem die App gerade spricht.
 *
 * Die App kann gegen zwei Ziele laufen (siehe `AGENTS.md`, „Prüfen im
 * Emulator"): gegen den lokalen Mock – das ist der Standardweg – oder gegen
 * das echte Supabase-Projekt. Die beiden zu verwechseln ist teuer: Ein grüner
 * Lauf gegen den Mock beweist nichts über die echten Zugriffsregeln, und ein
 * Lauf gegen das echte Projekt legt Daten an, die man später für Testdaten
 * hält. Deshalb steht das Ziel sichtbar in der Oberfläche – in beiden
 * Ansichten, mit demselben Text aus dieser Funktion.
 */

/** Adressen, die auf demselben Rechner liegen – im Emulator der Mock. */
const MOCK_ADRESSEN = ['127.0.0.1', 'localhost', '10.0.2.2', '::1']

/**
 * Der Host der Konfiguration. Eine unbrauchbare Adresse wird unverändert
 * zurückgegeben – lieber roh anzeigen als das Ziel verschweigen.
 */
function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

/**
 * Die Beschriftung: der Host, und bei einem lokalen Ziel mit dem Zusatz
 * „Mock". Gibt `null` zurück, wenn keine Adresse konfiguriert ist.
 */
export function formatBackendLabel(url: string | undefined | null): string | null {
  const roh = url?.trim()
  if (!roh) return null

  const host = hostOf(roh)
  const lokal = MOCK_ADRESSEN.some((adresse) => host.includes(adresse))
  return lokal ? `Mock · ${host}` : host
}
