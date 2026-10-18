/** Zeitstempel kennzeichnet gemeinsam gelöschte Aufgaben. Ein früher einzeln
 * gelöschter Punkt darf auch bei derselben Millisekunde nicht dazugehören. */
export function listDeletionTime(now: string, tasks: readonly { deleted_at: string | null }[]): string {
  const used = new Set(tasks.flatMap(task => task.deleted_at ? [Date.parse(task.deleted_at)] : []))
  let moment = Date.parse(now)
  while (used.has(moment)) moment++
  return new Date(moment).toISOString()
}
