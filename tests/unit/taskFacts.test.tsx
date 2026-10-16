import { render, screen } from '@testing-library/react'
import { it, expect } from 'vitest'
import { TaskFacts } from '../../src/ui/TaskFacts'
import { localTask } from '../support/factories'

it('zeigt eine gemeinsame Erinnerungsglocke ohne ausgeschriebene Zeitpunkte', () => {
  render(<TaskFacts task={localTask({ due_at: '2030-06-10T12:00:00Z', reminders: [
    { form: 'offset', minutes: 0 }, { form: 'offset', minutes: 10, mutedBy: ['me'] },
  ] })} currentUserId="me" />)
  const indicator = screen.getByRole('img', { name: /^Erinnerungen:/ })
  expect(indicator).toHaveAttribute('aria-label', expect.stringMatching(/Erinnert:.*Erinnert:.*für mich stumm/))
  expect(indicator).toHaveTextContent('')
  expect(screen.queryByText(/Erinnert:/)).not.toBeInTheDocument()
})

it('zeigt bei fehlenden Erinnerungen keine Glocke', () => {
  render(<TaskFacts task={localTask()} currentUserId="me" />)
  expect(screen.queryByRole('img', { name: /^Erinnerungen:/ })).not.toBeInTheDocument()
})
