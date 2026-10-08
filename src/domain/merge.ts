/**
 * Konfliktauflösung für Version 0.1: Last Write Wins anhand von `updated_at`.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * BEWUSSTE VEREINFACHUNG FÜR VERSION 0.1
 *
 * Es gibt bewusst KEINE CRDTs, KEIN 3-Wege-Merge und KEINE Feld-für-Feld-
 * Zusammenführung. Pro Datensatz gewinnt schlicht der jüngere `updated_at`.
 * Folge: Bearbeiten zwei Geräte denselben Datensatz, geht die ältere Änderung
 * verloren.
 *
 * Ebenso bewusst: Die Uhren der Clients sind die Konfliktquelle. Geht die Uhr
 * eines Geräts falsch, gewinnt dieses Gerät dauerhaft. Für einen Prototyp ist
 * das akzeptabel, weil jede Zeile ohnehin ein `updated_at` besitzt und ein
 * späterer Wechsel auf einen Server-Zeitstempel (oder eine Versionsnummer)
 * nur diese Datei betrifft.
 * ────────────────────────────────────────────────────────────────────────────
 */
import { timeOf } from './clock'
import type { LocalOnly, SyncableRow } from './types'

export type MergeOutcome = 'inserted' | 'local-wins' | 'remote-wins' | 'unchanged'

export interface MergeResult<T> {
  row: T
  outcome: MergeOutcome
}

/**
 * Entscheidet, welche Version eines Datensatzes lokal gespeichert wird.
 *
 * Regeln:
 *  1. Kein lokaler Datensatz               ⇒ Serverversion übernehmen.
 *  2. Lokale Version echt jünger           ⇒ lokal behalten und hochladen.
 *  3. Serverversion echt jünger            ⇒ Serverversion übernehmen.
 *  4. Gleicher Zeitstempel + lokal schmutzig ⇒ lokal behalten und hochladen.
 *  5. Gleicher Zeitstempel + lokal sauber  ⇒ Serverversion übernehmen.
 *
 * Fall 4 sorgt dafür, dass eine lokale Änderung nicht dadurch verschwindet,
 * dass der eigene Push den Server-Zeitstempel auf exakt denselben Wert setzt.
 */
/**
 * `L` ist der lokale Datensatz (mit `dirty`), `remote` die Serverfassung ohne
 * `dirty` – also genau `Omit<L, 'dirty'>`, siehe `RemoteTask` und Konsorten.
 */
/**
 * Übernimmt die Serverfassung als lokalen Datensatz.
 *
 * `L` und `Omit<L, 'dirty'>` unterscheiden sich in **genau einem** Feld:
 * `dirty` gibt es nur lokal. TypeScript kann daraus kein `L` ableiten – es weiß
 * nicht, dass `LocalOnly` nichts weiter hinzufügt –, deshalb steht die
 * Umwandlung hier, an **einer** Stelle, mit dieser Begründung. Dreimal dieselbe
 * Zeile an drei Rückgaben war zweimal zu viel: Wer `LocalOnly` erweitert,
 * ändert sonst drei Stellen statt einer (und vergisst die dritte).
 */
function uebernehmeVonServer<L extends SyncableRow & LocalOnly>(remote: Omit<L, 'dirty'>): L {
  return { ...remote, dirty: 0 } as unknown as L
}
export function resolveMerge<L extends SyncableRow & LocalOnly>(
  local: L | undefined,
  remote: Omit<L, 'dirty'>,
): MergeResult<L> {
  if (!local) {
    return { row: uebernehmeVonServer<L>(remote), outcome: 'inserted' }
  }

  const localTime = timeOf(local.updated_at)
  const remoteTime = timeOf(remote.updated_at)

  if (localTime > remoteTime) {
    return { row: { ...local, dirty: 1 }, outcome: 'local-wins' }
  }

  if (remoteTime > localTime) {
    return { row: uebernehmeVonServer<L>(remote), outcome: 'remote-wins' }
  }

  if (local.dirty === 1) {
    return { row: local, outcome: 'local-wins' }
  }

  return { row: uebernehmeVonServer<L>(remote), outcome: 'unchanged' }
}
