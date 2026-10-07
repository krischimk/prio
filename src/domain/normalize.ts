import { normalizeIso } from './clock'
import { parseReminders } from './reminder'
import { parseSections } from './sections'
import type { LocalList, LocalListMember, LocalTask, RemoteList, RemoteListMember, RemoteTask } from './types'

/**
 * Der **Leserand**: Jede Zeile, die in die App kommt, geht hier durch.
 *
 * Ein neues Feld erreicht nicht alle Zeilen gleichzeitig:
 *
 *  - Zeilen in der lokalen Datenbank stammen aus einer früheren Fassung der App
 *    und kennen es nicht.
 *  - Zeilen vom Server können von einem älteren Gerät stammen (oder die
 *    Migration ist noch nicht eingespielt).
 *
 * Vorher gab es dafür **drei** Mechanismen: `?? null` je Feld in
 * `mapping.fromRemote*`, `parseSections` in `repositories` – aber nur für
 * Listen – und zusätzliche Vorsicht an jeder Stelle, die `task.reminders`
 * anfasste („eine Zeile aus einer älteren Fassung hat das Feld womöglich gar
 * nicht"). Wer ein Feld vergaß, merkte es erst, wenn eine alte Zeile die
 * Ansicht unlesbar machte – genau so ist 0.18.0 mit einem schwarzen Bildschirm
 * veröffentlicht worden.
 *
 * Jetzt gibt es **eine** Stelle je Entität, und zwar an beiden Rändern: beim
 * Anwenden einer Serverantwort (`mapping`) und beim Lesen aus der lokalen
 * Datenbank (`repositories`). Was in der App unterwegs ist, ist vollständig.
 */

/** Was aus einer älteren Quelle kommen kann: Felder dürfen fehlen. */
type Vielleicht<T> = { [K in keyof T]?: T[K] | null }

export function normalisiereListe(zeile: LocalList | RemoteList): LocalList {
  const roh = zeile as Vielleicht<LocalList>
  return {
    id: zeile.id,
    name: zeile.name,
    owner_id: roh.owner_id ?? '',
    is_shared: roh.is_shared ?? false,
    // Ältere Zeilen kennen die Felder noch nicht.
    icon: roh.icon ?? null,
    sections: parseSections(roh.sections),
    created_at: normalizeIso(zeile.created_at),
    updated_at: normalizeIso(zeile.updated_at),
    deleted_at: normalizeIso(roh.deleted_at ?? null),
    dirty: roh.dirty ?? 0,
  }
}

export function normalisiereAufgabe(zeile: LocalTask | RemoteTask): LocalTask {
  const roh = zeile as Vielleicht<LocalTask>
  return {
    id: zeile.id,
    list_id: roh.list_id ?? '',
    title: zeile.title,
    description: roh.description ?? '',
    due_at: normalizeIso(roh.due_at ?? null),
    completed: roh.completed ?? false,
    completed_at: normalizeIso(roh.completed_at ?? null),
    recurrence: roh.recurrence ?? null,
    successor_id: roh.successor_id ?? null,
    // `parseReminders` kommt mit allem zurecht und lässt Unbrauchbares still
    // fallen – eine verbogene Zeile darf die Aufgabe nicht unlesbar machen.
    reminders: parseReminders(roh.reminders),
    section_id: roh.section_id ?? null,
    position: Number.isFinite(roh.position) ? (roh.position as number) : 0,
    created_at: normalizeIso(zeile.created_at),
    updated_at: normalizeIso(zeile.updated_at),
    deleted_at: normalizeIso(roh.deleted_at ?? null),
    dirty: roh.dirty ?? 0,
  }
}

export function normalisiereMitglied(zeile: LocalListMember | RemoteListMember): LocalListMember {
  const roh = zeile as Vielleicht<LocalListMember>
  return {
    list_id: roh.list_id ?? '',
    user_id: roh.user_id ?? '',
    created_at: normalizeIso(zeile.created_at),
    updated_at: normalizeIso(zeile.updated_at),
    deleted_at: normalizeIso(roh.deleted_at ?? null),
    dirty: roh.dirty ?? 0,
  }
}
