import { expect, type Locator } from '@playwright/test'

/** Wählt wie ein Nutzer im sichtbaren Menü; kein Zugriff auf Arks verstecktes HTML-Feld. */
export async function selectOption(trigger: Locator, choice: string | { label: string }) {
  const field = trigger.and(trigger.page().getByRole('combobox'))
  if (await field.getAttribute('aria-expanded') !== 'true') await field.click()
  const menu = await selectMenu(field)
  const option = typeof choice === 'string'
    ? menu.locator(`[role="option"][data-value=${JSON.stringify(choice)}]`)
    : menu.getByRole('option', { name: choice.label, exact: true })
  await option.click()
  await expect(menu).toBeHidden()
}

export async function selectMenu(trigger: Locator) {
  const id = await trigger.and(trigger.page().getByRole('combobox')).getAttribute('aria-controls')
  if (!id) throw new Error('Die Auswahl hat kein zugeordnetes Menü.')
  return trigger.page().locator(`[id=${JSON.stringify(id)}]`)
}
