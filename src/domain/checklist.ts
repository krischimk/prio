import { sameData } from './equality'
import { normalizeIso } from './clock'
import { requireText, ValidationError } from './validation'
import { newId } from './ids'

/** Gewicht ist optional; ältere und ungewichtete Checklisten zählen gleichmäßig. */
export interface ChecklistItem {
  id: string
  text: string
  completed: boolean
  deleted_at: string | null
  weight?: number
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
      deleted_at: deletedAt, ...(typeof item.weight === 'number' && Number.isFinite(item.weight) && item.weight >= 0 && item.weight <= 1 ? { weight: item.weight } : {}) }]
  })
}

export function validateChecklist(items: ChecklistItem[]): ChecklistItem[] {
  const ids = new Set<string>()
  const validated = items.map(item => {
    if (!item.id || ids.has(item.id)) throw new ValidationError('invalid', 'Die Checkliste enthält ungültige Kennungen.')
    ids.add(item.id)
    if (item.weight !== undefined && (!Number.isFinite(item.weight) || item.weight < 0 || item.weight > 1)) throw new ValidationError('invalid', 'Ein Checklistengewicht liegt außerhalb des gültigen Bereichs.')
    return { id: item.id, text: item.deleted_at ? item.text.trim() : requireText(item.text, 'Der Checklistenpunkt'), completed: item.completed === true, deleted_at: item.deleted_at ?? null,
      ...(item.weight === undefined ? {} : { weight: item.weight }) }
  })
  return validated.some(item => item.weight !== undefined) ? withChecklistWeights(validated) : validated
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
    for (const field of ['text', 'completed', 'deleted_at', 'weight'] as const) {
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
  const items = order.map(id => merged.get(id)!)
  return { items: items.some(item => item.weight !== undefined) ? withChecklistWeights(items) : items, conflict }
}

/** Normierte Gewichte; fehlende Werte erhalten den Mittelwert vorhandener Werte. */
export function checklistWeights(items: readonly ChecklistItem[]): Map<string, number> {
  const active = items.filter(item => item.deleted_at === null)
  const weighted = active.filter(item => item.weight !== undefined)
  const average = weighted.length ? weighted.reduce((sum, item) => sum + item.weight!, 0) / weighted.length : 1
  const raw = active.map(item => item.weight ?? average)
  const sum = raw.reduce((sum, value) => sum + value, 0)
  return new Map(active.map((item, index) => [item.id, sum > 0 ? (Math.abs(sum - 1) < 1e-12 ? raw[index] : raw[index] / sum) : 1 / active.length]))
}

export function withChecklistWeights(items: ChecklistItem[]): ChecklistItem[] {
  const weights = checklistWeights(items)
  return items.map(item => weights.has(item.id) ? { ...item, weight: weights.get(item.id)! } : item)
}

export function setChecklistWeight(items: ChecklistItem[], id: string, weight: number): ChecklistItem[] {
  if (!Number.isFinite(weight) || weight < 0 || weight > 1) throw new ValidationError('invalid', 'Ein Checklistengewicht liegt außerhalb des gültigen Bereichs.')
  const weights = checklistWeights(items)
  if (!weights.has(id)) return items
  const others = [...weights].filter(([key]) => key !== id)
  const rest = others.reduce((sum, [, value]) => sum + value, 0)
  return items.map(item => !weights.has(item.id) ? item : { ...item, weight: item.id === id ? (others.length ? weight : 1)
    : rest > 0 ? weights.get(item.id)! / rest * (1 - weight) : (1 - weight) / others.length })
}

export function appendChecklistItem(items: ChecklistItem[], item: ChecklistItem, weighted = false): ChecklistItem[] {
  if (!weighted && !items.some(row => row.weight !== undefined)) return [...items, item]
  const weights = checklistWeights(items)
  const share = 1 / (weights.size + 1)
  return [...items.map(row => weights.has(row.id) ? { ...row, weight: weights.get(row.id)! * (1 - share) } : row), { ...item, weight: share }]
}

export function deleteChecklistItem(items: ChecklistItem[], id: string, deletedAt: string): ChecklistItem[] {
  const next = items.map(item => item.id === id ? { ...item, deleted_at: deletedAt } : item)
  return next.some(item => item.weight !== undefined) ? withChecklistWeights(next) : next
}

export function checklistRemaining(items: readonly ChecklistItem[]): number {
  const weights = checklistWeights(items)
  if (!weights.size) return 1
  return Math.min(1, Math.max(0, items.reduce((sum, item) => sum + (!item.completed ? weights.get(item.id) ?? 0 : 0), 0)))
}
