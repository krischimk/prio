import { z } from 'zod'
import { validDay, validTimeZone } from '../../src/domain/calendar'

export const id = z.uuid()
export const timestamp = z.iso.datetime({ offset: true })
const text = z.string().trim().min(1).max(2000)
const value = z.number().min(0).max(10)
export const rating = z.strictObject({ importance: value, urgency: value, effort: value, urgencyMode: z.enum(['auto', 'manual']), effortFromChecklist: z.boolean().default(true) })
export const recurrenceRule = z.strictObject({ timeZone: z.string().refine(validTimeZone), resetMissed: z.boolean(), visibility: z.discriminatedUnion('mode', [
  z.strictObject({ mode: z.literal('clock'), time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) }),
  z.strictObject({ mode: z.literal('lead'), minutes: z.number().int().min(0).max(5256000) }),
]) })
export const calendarPreferences = z.strictObject({ days: z.record(z.string().refine(validDay), z.enum(['low', 'none'])),
  repeats: z.enum(['active', 'all', 'none']), open: z.boolean(), timeZone: z.string().refine(validTimeZone).nullable() })
export const reminder = z.union([
  z.strictObject({ form: z.literal('offset'), minutes: z.number().int().min(-2628000).max(2628000) }),
  z.strictObject({ form: z.literal('absolute'), at: timestamp }),
])
export const checklist = z.array(z.strictObject({ id: id.optional(), text, completed: z.boolean().default(false), weight: z.number().min(0).max(1).optional() })).max(500)
export const edit = z.strictObject({
  title: text.optional(), note: z.string().max(100000).nullable().optional(), checklist: checklist.optional(),
  tags: z.array(z.string().trim().min(1).max(100)).max(100).optional(), rating: rating.nullable().optional(),
  due_at: timestamp.nullable().optional(), recurrence: z.string().regex(/^(daily|weekly|monthly|yearly|every:[1-9]\d{0,2}:(minutes|hours|days|weeks|months|years))$/)
    .describe('daily, weekly, monthly, yearly or every:N:UNIT; N=1..999, UNIT=minutes/hours/days/weeks/months/years.').nullable().optional(),
  reminders: z.array(reminder).max(10).optional(), section_id: id.nullable().optional(),
  recurrence_rule: recurrenceRule.nullable().optional().describe('Optional visibility window. clock is a local opening time before each deadline, lead is elapsed minutes before due. resetMissed replaces an unfinished occurrence when the next window opens. Null preserves legacy recurrence.'),
})
export const expected = z.strictObject({ id, revision: z.string().regex(/^[a-f0-9]{32}$/) })
export const requestId = { request_id: id.describe('Fresh UUID for this intent. Retry the identical intent with the SAME UUID after timeouts; never reuse it for a different action.') }
export const targets = { tasks: z.array(expected).min(1).max(100) }
export const searchSchema = z.strictObject({
  list_ids: z.array(id).min(1).max(100).optional(), text: z.string().trim().min(1).max(500).optional(),
  tags: z.array(text).max(20).optional(), state: z.enum(['open', 'completed', 'deleted']).default('open'),
  due_before: timestamp.optional(), due_after: timestamp.optional(), available_now: z.boolean().default(false),
  overview_only: z.boolean().default(false), sort: z.enum(['priority', 'due', 'manual', 'newest']).default('priority'),
  limit: z.number().int().min(1).max(100).default(30), cursor: z.string().max(2000).optional(),
})
export type Edit = z.infer<typeof edit>
export type Expected = z.infer<typeof expected>
export type SearchInput = z.infer<typeof searchSchema>
