import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useReminderRows } from '../../src/ui/reminderList/useReminderRows'
import type { TaskReminder } from '../../src/domain/reminder'

/**
 * Der Formwechsel in der Oberfläche (Regression).
 *
 * Wer eine Erinnerung für sich stummgeschaltet hat und dann die Wiederholung
 * umschaltet, darf sie nicht verlieren. Genau das passierte: Die Oberfläche
 * hatte eine **zweite** Fassung der Umrechnung, und die ließ `mutedBy` weg; das
 * Repository nimmt die Liste aus dem Formular wörtlich, weil das Formular etwas
 * gesagt hat. Jetzt gibt es nur noch `umformen` in `src/domain/reminder.ts`.
 */
describe('useReminderRows', () => {
  /*
   * Die Fälligkeit liegt bewusst in der Zukunft: `absoluteFromOffset` verwirft
   * Zeitpunkte, die schon vorbei sind – mit einem Datum aus der Vergangenheit
   * prüfte der Test eine leere Liste statt der Umrechnung.
   */
  const faellig = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const stumm: TaskReminder = { form: 'absolute', at: faellig, mutedBy: ['ich'] }

  it('behält die Stummschaltung beim Wechsel zur Wiederholung', () => {
    const onChange = vi.fn()
    const { rerender } = renderHook(
      ({ recurrence }: { recurrence: string | null }) =>
        useReminderRows({
          dueAt: faellig,
          recurrence,
          reminders: [stumm],
          onChange,
        }),
      { initialProps: { recurrence: null as string | null } },
    )

    rerender({ recurrence: 'daily' })

    expect(onChange).toHaveBeenCalledTimes(1)
    const neu = onChange.mock.calls[0][0] as TaskReminder[]
    expect(neu[0]).toMatchObject({ form: 'offset', mutedBy: ['ich'] })
  })

  it('behält sie auch beim Wechsel zurück zu einmalig', () => {
    const onChange = vi.fn()
    const { rerender } = renderHook(
      ({ recurrence }: { recurrence: string | null }) =>
        useReminderRows({
          dueAt: faellig,
          recurrence,
          reminders: [{ form: 'offset', minutes: 30, mutedBy: ['ich'] }],
          onChange,
        }),
      { initialProps: { recurrence: 'daily' as string | null } },
    )

    rerender({ recurrence: null })

    const neu = onChange.mock.calls[0][0] as TaskReminder[]
    expect(neu[0]).toMatchObject({ form: 'absolute', mutedBy: ['ich'] })
  })
})
