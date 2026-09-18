import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLongPress } from '../../src/ui/mobile/useLongPress'

/**
 * Langdruck (unit).
 *
 * Zwei Dinge müssen stimmen: Der Langdruck löst nach der Wartezeit aus, und der
 * anschließend trotzdem folgende Klick darf nicht zusätzlich die Detailansicht
 * öffnen.
 */
function Harness({ onLongPress, onTap }: { onLongPress: () => void; onTap: () => void }) {
  const longPress = useLongPress(onLongPress, 500)
  return (
    <button
      type="button"
      {...longPress.handlers}
      onClick={() => {
        if (longPress.wasLongPress()) return
        onTap()
      }}
    >
      Aufgabe
    </button>
  )
}

describe('Langdruck', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('löst nach der Wartezeit aus', () => {
    const onLongPress = vi.fn()
    render(<Harness onLongPress={onLongPress} onTap={vi.fn()} />)

    fireEvent.pointerDown(screen.getByRole('button'))
    expect(onLongPress).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(onLongPress).toHaveBeenCalledTimes(1)
  })

  it('unterdrückt den Klick nach einem Langdruck', () => {
    const onLongPress = vi.fn()
    const onTap = vi.fn()
    render(<Harness onLongPress={onLongPress} onTap={onTap} />)

    fireEvent.pointerDown(screen.getByRole('button'))
    act(() => {
      vi.advanceTimersByTime(500)
    })
    fireEvent.pointerUp(screen.getByRole('button'))
    fireEvent.click(screen.getByRole('button'))

    expect(onLongPress).toHaveBeenCalledTimes(1)
    expect(onTap).not.toHaveBeenCalled()
  })

  it('löst bei kurzem Antippen nicht aus und lässt den Klick zu', () => {
    const onLongPress = vi.fn()
    const onTap = vi.fn()
    render(<Harness onLongPress={onLongPress} onTap={onTap} />)

    fireEvent.pointerDown(screen.getByRole('button'))
    act(() => {
      vi.advanceTimersByTime(100)
    })
    fireEvent.pointerUp(screen.getByRole('button'))
    fireEvent.click(screen.getByRole('button'))

    expect(onLongPress).not.toHaveBeenCalled()
    expect(onTap).toHaveBeenCalledTimes(1)
  })

  it('bricht ab, wenn der Finger das Element verlässt', () => {
    const onLongPress = vi.fn()
    render(<Harness onLongPress={onLongPress} onTap={vi.fn()} />)

    fireEvent.pointerDown(screen.getByRole('button'))
    fireEvent.pointerLeave(screen.getByRole('button'))
    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(onLongPress).not.toHaveBeenCalled()
  })

  it('löst nach einem abgebrochenen Versuch beim nächsten Mal wieder aus', () => {
    const onLongPress = vi.fn()
    render(<Harness onLongPress={onLongPress} onTap={vi.fn()} />)

    fireEvent.pointerDown(screen.getByRole('button'))
    fireEvent.pointerCancel(screen.getByRole('button'))
    fireEvent.pointerDown(screen.getByRole('button'))
    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(onLongPress).toHaveBeenCalledTimes(1)
  })
})
