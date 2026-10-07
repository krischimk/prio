import { expect, test } from '@playwright/test'

/**
 * Die Bauteilübersicht (`?kueche=1`, nur im Entwicklungsbuild).
 *
 * Sie ist ein Prüfmittel (`DESIGN.md` §12): In einer echten Liste sieht man einen
 * Bauteil immer nur in einem Zustand. Damit sie nicht still veraltet, hängt hier
 * ein kurzer Test daran – und der Dialogvertrag wird an ihr gleich mitgeprüft:
 * Blatt und Fläche lassen sich öffnen, Escape schließt, das X schließt.
 */
test('zeigt die Bauteile in ihren Varianten', async ({ page }) => {
  await page.goto('/?kueche=1')

  await expect(page.getByRole('heading', { name: 'Bauteile' })).toBeVisible()
  for (const teil of ['Knöpfe', 'Felder', 'Flächen', 'Schriftrollen', 'Bedeutungsfarben', 'Dialoge']) {
    await expect(page.getByRole('heading', { name: teil })).toBeVisible()
  }

  // Beschriftung und Feld gehören zusammen – die Regel aus `Field`.
  await expect(page.getByLabel('Titel', { exact: true })).toHaveValue('Milch kaufen')
  await expect(page.getByRole('button', { name: 'symbolknopf' })).toHaveCount(0)
})

test('öffnet Blatt und Fläche und schließt sie wieder', async ({ page }) => {
  await page.goto('/?kueche=1')

  await page.getByRole('button', { name: 'Blatt öffnen' }).click()
  const blatt = page.getByRole('dialog', { name: 'Beispiel-Blatt' })
  await expect(blatt).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(blatt).toBeHidden()

  await page.getByRole('button', { name: 'Fläche öffnen' }).click()
  const flaeche = page.getByRole('dialog', { name: 'Beispiel-Fläche' })
  await expect(flaeche).toBeVisible()
  await flaeche.getByRole('button', { name: 'Schließen' }).click()
  await expect(flaeche).toBeHidden()
})
