import { checklistProgress, visibleChecklistItems } from '../domain/checklist'
import { fromRemoteList, fromRemotePreference, fromRemoteTask, fromRemoteUserPreference } from '../domain/mapping'
import { compareTasks } from '../domain/ordering'
import { orderOverviewTasks } from '../domain/overviewOrdering'
import { ratingValues } from '../domain/rating'
import { groupTasks } from '../domain/sections'
import { tagKey } from '../domain/tags'
import type { RemoteList, RemoteListPreference, RemoteTask, RemoteUserPreference } from '../domain/types'
import { planReminders, type ReminderCandidate } from '../reminders/reminderPlan'
import { formatWidgetDueLabel } from '../ui/datetime'
import { effectiveRoutine, isTaskVisible } from '../domain/routine'

/** Versionsgrenze zwischen gemeinsamem Fachmodell und nativer Anzeige. */
export const WIDGET_PROTOCOL = 1
export interface WidgetRows {
  lists: RemoteList[]; tasks: RemoteTask[]; preferences: RemoteListPreference[]; userPreferences: RemoteUserPreference[]
}
export interface WidgetCommand {
  id: string; userId: string; taskId: string; at: string
  checklist?: { id: string; completed: boolean }
  /** Nur unbestätigte lokale Eingaben. Bestätigte Zeilen werden frisch gelesen. */
  local?: { task: RemoteTask; base: RemoteTask | null; list: RemoteList; listBase: RemoteList | null }
}
export interface WidgetSnapshot {
  protocol: number; userId: string; generatedAt: string
  lists: { id: string; name: string; icon: string | null; overview: boolean }[]
  tasks: {
    id: string; listId: string; listName: string; listIcon: string | null; title: string; tags: string[]; tagKeys: string[]
    manualOrder: number; priorityOrder: number; newestOrder: number
    priority: number | null; dueAt: string | null; due: string | null; overdue: boolean
    checklistDone: number; checklistTotal: number; checklistHideCompleted?: boolean; deferred: boolean; hasReminder: boolean
    checklist: { id: string; text: string; completed: boolean }[]
  }[]
  reminders: ReminderCandidate[]
  local: Record<string, NonNullable<WidgetCommand['local']>>
}

/** App und Server verwenden dieselbe Projektion – Android zeichnet nur die Ausgabe. */
export function projectWidget(rows: WidgetRows, userId: string, nowMs: number, timeZone: string): WidgetSnapshot {
  const preferences = rows.preferences.map(fromRemotePreference).filter(row => row.deleted_at === null)
  const pref = new Map(preferences.map(row => [row.list_id, row]))
  const lists = rows.lists.map(fromRemoteList).filter(list => list.deleted_at === null).sort((a, b) =>
    (pref.get(a.id)?.position ?? Infinity) - (pref.get(b.id)?.position ?? Infinity) || a.name.localeCompare(b.name, 'de'))
  const listById = new Map(lists.map(list => [list.id, list]))
  const tasks = rows.tasks.map(fromRemoteTask).map(task => effectiveRoutine(task, nowMs)).filter(task => listById.has(task.list_id) && !task.completed && !task.deleted_at && !task.expired_at && isTaskVisible(task, nowMs))
  const userPreference = rows.userPreferences.map(fromRemoteUserPreference).find(row => row.id === userId)
  const detailed = userPreference?.detailed_ratings === true
  const calendar = userPreference?.calendar_preferences ? { ...userPreference.calendar_preferences, timeZone: userPreference.calendar_preferences.timeZone ?? timeZone } : undefined
  const priority = new Map(orderOverviewTasks(tasks, lists, 'priority', nowMs, detailed, calendar).map((task, index) => [task.id, index]))
  const newest = new Map(orderOverviewTasks(tasks, lists, 'newest', nowMs, detailed, calendar).map((task, index) => [task.id, index]))
  const manual = lists.flatMap(list => groupTasks(tasks.filter(task => task.list_id === list.id).sort(compareTasks), list.sections).flatMap(group => group.tasks))
  return {
    protocol: WIDGET_PROTOCOL, userId, generatedAt: new Date(nowMs).toISOString(),
    lists: lists.map(list => ({ id: list.id, name: list.name, icon: list.icon, overview: pref.get(list.id)?.include_in_overview === true })),
    tasks: manual.map((task, manualOrder) => {
      const progress = checklistProgress(task.checklist)
      const due = task.due_at ? formatWidgetDueLabel(task.due_at, nowMs, timeZone) : null
      // Die Anzeige kann bis zum nächsten Android-Hintergrundlauf stehen bleiben.
      // Nahe Termine haben deshalb eine Uhrzeit statt eines Minuten-Countdowns.
      return { id: task.id, listId: task.list_id, listName: listById.get(task.list_id)!.name, listIcon: listById.get(task.list_id)!.icon,
        title: task.title, tags: task.tags, tagKeys: task.tags.map(tagKey), manualOrder,
        priorityOrder: priority.get(task.id)!, newestOrder: newest.get(task.id)!,
        priority: task.rating && listById.get(task.list_id)?.ratings_enabled ? ratingValues(task.rating, task.due_at, nowMs, task.checklist, detailed, calendar).priority : null,
        dueAt: task.due_at, due: due?.text ?? null,
        overdue: due?.overdue ?? false, checklistDone: progress.completed, checklistTotal: progress.total,
        checklistHideCompleted: task.checklist_hide_completed === true,
        checklist: visibleChecklistItems(task.checklist, task.checklist_hide_completed).map(({ id, text, completed }) => ({ id, text, completed })),
        deferred: task.available_from !== null && Date.parse(task.available_from) > nowMs, hasReminder: task.reminders.length > 0 }
    }),
    reminders: planReminders(tasks, lists, nowMs, userId), local: {},
  }
}
