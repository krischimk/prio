import { act, renderHook } from '@testing-library/react'
import { expect, it } from 'vitest'
import { useCustomOffset } from '../../src/ui/reminderList/useCustomOffset'

it('rechnet Wochen, Dezimalstunden, Null und nachträgliche Erinnerungen minutengenau um', () => {
  const values: number[] = []
  const { result, rerender } = renderHook(({ value }) => useCustomOffset({ value, onChange: value => values.push(value) }), { initialProps: { value: 60 } })
  expect(result.current.unit).toBe('hours')
  act(() => result.current.change({ amount: '' }))
  expect(values).toEqual([])
  act(() => result.current.change({ amount: '1.5' }))
  expect(values.at(-1)).toBe(90)
  rerender({ value: 90 })
  expect(result.current.unit).toBe('hours')
  act(() => result.current.change({ unit: 'weeks', amount: '2' }))
  expect(values.at(-1)).toBe(20160)
  act(() => result.current.change({ direction: 'nachher' }))
  expect(values.at(-1)).toBe(-20160)
  act(() => result.current.change({ amount: '0' }))
  expect(Math.abs(values.at(-1)!)).toBe(0)
  rerender({ value: 1440 })
  expect(result.current.unit).toBe('days')
  expect(result.current.amount).toBe('1')
})
