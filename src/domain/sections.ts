import type { ListSection } from './types'

/**
 * Abschnitte innerhalb einer Liste.
 *
 * Alles hier ist eine reine Funktion: Der Abschnittsplan ist ein Array in der
 * Liste (`lists.sections`), die Zugehörigkeit einer Aufgabe ein Feld
 * (`tasks.section_id`). Damit lässt sich das Ordnen ohne Datenbank und ohne
 * Oberfläche prüfen.
 */

/** Längster erlaubter Name – so lang ist kein Bereich, und die Liste bleibt lesbar. */
export const SECTION_NAME_MAX = 40

/**
 * Wie viele Abschnitte eine Liste haben darf.
 *
 * Eine Grenze muss sein: Der Plan hängt als ein Feld an der Liste und wird als
 * Ganzes abgeglichen. Zwanzig Abschnitte sind in einer Einkaufsliste reichlich.
 */
export const SECTIONS_MAX = 20

/** Kennung eines neuen Abschnitts. */
export function newSectionId(): string {
  return crypto.randomUUID()
}

/**
 * Liest den Abschnittsplan aus einem gespeicherten Wert.
 *
 * Verträgt alles: fehlende Spalte (vor der Migration), `null`, Text statt
 * Array, Einträge ohne Namen. Unbrauchbares fällt still heraus – ein verbogener
 * Eintrag darf nicht die ganze Liste unlesbar machen.
 */
export function parseSections(wert: unknown): ListSection[] {
  if (!Array.isArray(wert)) return []
  const gesehen = new Set<string>()
  const sections: ListSection[] = []

  for (const eintrag of wert) {
    if (typeof eintrag !== 'object' || eintrag === null) continue
    const { id, name } = eintrag as { id?: unknown; name?: unknown }
    if (typeof id !== 'string' || id === '' || typeof name !== 'string') continue
    const bereinigt = name.trim()
    if (bereinigt === '' || bereinigt.length > SECTION_NAME_MAX) continue
    if (gesehen.has(id)) continue
    gesehen.add(id)
    sections.push({ id, name: bereinigt })
    if (sections.length >= SECTIONS_MAX) break
  }
  return sections
}

/** Legt einen Abschnitt an. `null`, wenn kein Platz oder kein Name mehr ist. */
export function withNewSection(
  sections: ListSection[],
  name: string,
): { sections: ListSection[]; id: string } | null {
  const bereinigt = name.trim().slice(0, SECTION_NAME_MAX)
  if (bereinigt === '' || sections.length >= SECTIONS_MAX) return null
  const id = newSectionId()
  return { sections: [...sections, { id, name: bereinigt }], id }
}

/** Benennt einen Abschnitt um. Unbekannte Kennung: unverändert. */
export function withRenamedSection(
  sections: ListSection[],
  id: string,
  name: string,
): ListSection[] {
  const bereinigt = name.trim().slice(0, SECTION_NAME_MAX)
  if (bereinigt === '') return sections
  return sections.map((section) => (section.id === id ? { ...section, name: bereinigt } : section))
}

/**
 * Entfernt einen Abschnitt.
 *
 * Die Aufgaben bleiben – sie fallen nach „ohne Bereich". Das Aufräumen ihrer
 * Verweise macht die Datenbankschicht, weil es die Aufgaben mit anfasst.
 */
export function withoutSection(sections: ListSection[], id: string): ListSection[] {
  return sections.filter((section) => section.id !== id)
}

export interface TaskGroup<T> {
  /** `null` ist die Gruppe „ohne Bereich" – sie steht oben. */
  section: ListSection | null
  tasks: T[]
  /** Zugeklappt ist eine Ansichtssache; sie gehört nicht in die Daten. */
  id: string
}

/**
 * Teilt Aufgaben nach Abschnitten auf.
 *
 * Reihenfolge der Gruppen: **erst „ohne Bereich", dann die Abschnitte in ihrer
 * Reihenfolge.** Was noch keinem Bereich zugeordnet ist, steht damit dort, wo
 * man es sieht, statt unter einem Abschnitt zu verschwinden – **ohne eigene
 * Überschrift**: Ein Kopf „Ohne Bereich" über den ersten Aufgaben wäre nur Lärm.
 * Leere Abschnitte bleiben enthalten – eben angelegt wären sie sonst unsichtbar.
 *
 * Innerhalb einer Gruppe bleibt die übergebene Reihenfolge (also `position`)
 * unverändert. Eine Aufgabe, deren Abschnitt es nicht mehr gibt, zählt zu
 * „ohne Bereich".
 */
export function groupTasks<T extends { section_id: string | null }>(
  tasks: T[],
  sections: ListSection[],
): TaskGroup<T>[] {
  const bekannt = new Set(sections.map((section) => section.id))
  const ohne: T[] = []
  const nachAbschnitt = new Map<string, T[]>(sections.map((section) => [section.id, []]))

  for (const task of tasks) {
    const ziel = task.section_id !== null && bekannt.has(task.section_id) ? task.section_id : null
    if (ziel === null) {
      ohne.push(task)
    } else {
      nachAbschnitt.get(ziel)?.push(task)
    }
  }

  return [
    { section: null, tasks: ohne, id: 'ohne-bereich' },
    ...sections.map((section) => ({
      section,
      tasks: nachAbschnitt.get(section.id) ?? [],
      id: section.id,
    })),
  ]
}

/**
 * Die Aufgaben flach in Anzeigereihenfolge.
 *
 * Genau die Reihenfolge, die das Ziehen auf dem Telefon sieht: erst „ohne
 * Bereich", dann die Abschnitte. Wird eine Aufgabe an eine andere Stelle
 * gezogen, ergibt sich ihr Zielabschnitt aus den Nachbarn.
 */
export function flattenGroups<T extends { id: string; section_id: string | null }>(
  groups: TaskGroup<T>[],
): T[] {
  return groups.flatMap((gruppe) => gruppe.tasks)
}
