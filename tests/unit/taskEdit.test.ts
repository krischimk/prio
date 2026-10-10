// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { applyTaskEdit, TaskEditConflict, taskEditBase } from '../../src/domain/taskEdit'
import { ValidationError } from '../../src/domain/validation'
import { localTask, T0, T1 } from '../support/factories'

describe('Browserunabhängige Aufgabenbearbeitung', () => {
  it('validiert und normalisiert dieselbe Eingabe ohne React oder Datenbank', () => {
    expect(typeof window).toBe('undefined')
    expect(applyTaskEdit(localTask(), { title: '  Neu  ', description: '   ' }, Date.parse(T0)))
      .toMatchObject({ title: 'Neu', description: null })
    expect(() => applyTaskEdit(localTask(), { title: '   ' }, Date.parse(T0))).toThrow(ValidationError)
  })

  it('erhält zwischenzeitlich geänderte andere Felder', () => {
    const before = localTask()
    const current = { ...before, description: 'Andere Notiz', due_at: T1 }
    expect(applyTaskEdit(current, { title: 'Neuer Titel' }, Date.parse(T0), taskEditBase(before)))
      .toMatchObject({ title: 'Neuer Titel', description: 'Andere Notiz', due_at: T1 })
  })

  it('erkennt eine Änderung desselben Feldes auch bei unverändertem Zeitstempel', () => {
    const before = localTask()
    const current = { ...before, title: 'Inzwischen anders' }
    expect(() => applyTaskEdit(current, { title: 'Mein Titel' }, Date.parse(T0), taskEditBase(before)))
      .toThrow(expect.objectContaining({ code: 'conflict', fields: ['title'] }))
  })

  it('prüft Termin, Wiederholung und Erinnerungen als zusammengehörige Konfliktgruppe', () => {
    const before = localTask({ due_at: T1 })
    const current = { ...before, reminders: [{ form: 'absolute' as const, at: T0 }] }
    expect(() => applyTaskEdit(current, { recurrence: 'daily' }, Date.parse(T0), taskEditBase(before))).toThrow(TaskEditConflict)
    expect(applyTaskEdit(current, { description: 'Notiz' }, Date.parse(T0), taskEditBase(before)).reminders).toEqual(current.reminders)
  })

  it('weist einen Entwurf nach Listenwechsel oder mit falscher Aufgabenkennung ab', () => {
    const before = localTask()
    expect(() => applyTaskEdit({ ...before, list_id: 'andere' }, { title: 'Neu' }, Date.parse(T0), taskEditBase(before)))
      .toThrow(expect.objectContaining({ fields: ['list_id'] }))
    expect(() => applyTaskEdit({ ...before, id: 'andere' }, { title: 'Neu' }, Date.parse(T0), taskEditBase(before)))
      .toThrow(expect.objectContaining({ fields: ['id'] }))
  })

  it('vergleicht gleichwertige Zeitformate und leere Beschreibungen fachlich', () => {
    const before = localTask({ due_at: T1, description: null })
    const current = { ...before, due_at: '2026-01-01T11:00:00+00:00', description: '' }
    expect(applyTaskEdit(current, { dueAt: T0, description: 'Notiz' }, Date.parse(T0), taskEditBase(before)))
      .toMatchObject({ due_at: T0, description: 'Notiz' })
  })
})
