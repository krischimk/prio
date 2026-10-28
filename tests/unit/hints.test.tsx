import { render, screen, waitFor } from '@testing-library/react'
import { expect, it } from 'vitest'
import userEvent from '@testing-library/user-event'
import { Hint, HintProvider } from '../../src/ui/components/Hint'

it('teilt einen Hinweis zwischen mehreren Auslösern und erhält deren Klickaktionen', async () => {
  let clicks = 0
  const view = (text: string, first = true) => <HintProvider>
    {first ? <Hint text={text}><button onClick={() => clicks++}>Erster</button></Hint> : null}
    <Hint text="Zweiter Hinweis"><button>Zweiter</button></Hint>
  </HintProvider>
  const { rerender } = render(view('Erster Hinweis'))
  await userEvent.tab()
  await waitFor(() => expect(screen.getByRole('tooltip')).toHaveTextContent('Erster Hinweis'))
  rerender(view('Geänderter Hinweis'))
  await waitFor(() => expect(screen.getByRole('tooltip')).toHaveTextContent('Geänderter Hinweis'))
  await userEvent.tab()
  await waitFor(() => expect(screen.getByRole('tooltip')).toHaveTextContent('Zweiter Hinweis'))
  expect(screen.getAllByRole('tooltip')).toHaveLength(1)
  await userEvent.click(screen.getByRole('button', { name: 'Erster' }))
  expect(clicks).toBe(1)
  await userEvent.tab()
  await userEvent.tab({ shift: true })
  await waitFor(() => expect(screen.getByRole('tooltip')).toHaveTextContent('Geänderter Hinweis'))
  rerender(view('Geänderter Hinweis', false))
  await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull())
})
