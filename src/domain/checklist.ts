import { sameData } from './equality'
import { normalizeIso } from './clock'
import { requireText, ValidationError } from './validation'
import { newId } from './ids'

/** Nur Text und Häkchen sind fachlich sichtbar; Kennung und Löschvermerk sichern den Abgleich. */
export interface ChecklistItem {
  id: string
  text: string
  completed: boolean
  deleted_at: string | null
}

export function createChecklistItem(text: string): ChecklistItem {
  return { id: newId(), text: requireText(text, 'Der Checklistenpunkt'), completed: false, deleted_at: null }
}

export function parseChecklist(value: unknown): ChecklistItem[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  return value.flatMap(item => {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !item.id.trim()
      || typeof item.text !== 'string' || seen.has(item.id)) return []
    const deletedAt = typeof item.deleted_at === 'string' && Number.isFinite(Date.parse(item.deleted_at)) ? normalizeIso(item.deleted_at) : null
    if (!item.text.trim() && deletedAt === null) return []
    seen.add(item.id)
    return [{ id: item.id, text: item.text, completed: item.completed === true,
      deleted_at: deletedAt }]
  })
}

export function validateChecklist(items: ChecklistItem[]): ChecklistItem[] {
  const ids = new Set<string>()
  return items.map(item => {
    if (!item.id || ids.has(item.id)) throw new ValidationError('invalid', 'Die Checkliste enthält ungültige Kennungen.')
    ids.add(item.id)
    return { id: item.id, text: item.deleted_at ? item.text.trim() : requireText(item.text, 'Der Checklistenpunkt'), completed: item.completed === true, deleted_at: item.deleted_at ?? null }
  })
}

export function checklistProgress(items: ChecklistItem[]) {
  const active = items.filter(item => item.deleted_at === null)
  return { completed: active.filter(item => item.completed).length, total: active.length }
}

/** Neue Wiederholung ist eine eigene Checkliste; erledigte Vorgänger bleiben unverändert. */
export function repeatChecklist(items: ChecklistItem[]): ChecklistItem[] {
  return items.filter(item => item.deleted_at === null).map(item => ({ ...item, completed: false }))
}

/**
 * Verschiedene Punkte und Text/Häkchen desselben Punkts sind unabhängig.
 * Gleichzeitiges Löschen/Bearbeiten und widersprüchliches Sortieren bleiben
 * als Konflikt erhalten. Die bestätigte Basis wird niemals blind ersetzt.
 */
export function mergeChecklist(base: ChecklistItem[], local: ChecklistItem[], remote: ChecklistItem[], preferLocal = false): { items: ChecklistItem[]; conflict: boolean } {
  const b = new Map(base.map(item => [item.id, item]))
  const l = new Map(local.map(item => [item.id, item]))
  const r = new Map(remote.map(item => [item.id, item]))
  const merged = new Map<string, ChecklistItem>()
  let conflict = false
  for (const id of new Set([...r.keys(), ...l.keys()])) {
    const before = b.get(id), here = l.get(id), there = r.get(id)
    if (!here || !there) { merged.set(id, (here ?? there)!); continue }
    if (!before) {
      if (!sameData(here, there) && !preferLocal) conflict = true
      merged.set(id, preferLocal ? here : there)
      continue
    }
    const deletionChanged = here.deleted_at !== before.deleted_at || there.deleted_at !== before.deleted_at
    if (deletionChanged && !sameData(here, before) && !sameData(there, before) && !sameData(here, there)) {
      if (!preferLocal) conflict = true
      merged.set(id, preferLocal ? here : there)
      continue
    }
    const next = { ...there }
    for (const field of ['text', 'completed', 'deleted_at'] as const) {
      if (sameData(here[field], before[field])) continue
      if (!sameData(there[field], before[field]) && !sameData(here[field], there[field]) && !preferLocal) conflict = true
      Object.assign(next, { [field]: here[field] })
    }
    merged.set(id, next)
  }
  const common = base.map(item => item.id).filter(id => l.has(id) && r.has(id))
  const existing = new Set(common)
  const orderL = local.map(item => item.id).filter(id => existing.has(id))
  const orderR = remote.map(item => item.id).filter(id => existing.has(id))
  const changedL = !sameData(orderL, common), changedR = !sameData(orderR, common)
  if (changedL && changedR && !sameData(orderL, orderR) && !preferLocal) conflict = true
  const first = changedL && (!changedR || preferLocal) ? local : remote
  const second = first === local ? remote : local
  const order = first.map(item => item.id).filter(id => merged.has(id))
  // Ergänzungen behalten ihre Nachbarschaft; parallele Anhänge gehen nicht verloren.
  second.forEach((item, index) => {
    if (order.includes(item.id)) return
    const next = second.slice(index + 1).find(candidate => order.includes(candidate.id))
    order.splice(next ? order.indexOf(next.id) : order.length, 0, item.id)
  })
  return { items: order.map(id => merged.get(id)!), conflict }
}
