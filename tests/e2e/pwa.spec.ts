import { addChecklistPoint, addTags, outerTask } from './support/checklists'
import { expect, test } from '@playwright/test'
import { register, resetServer, uniqueEmail, createList, createTask, taskItem, openTaskEditor, selectList, serverState } from './support/helpers'

/**
 * Der PWA-Weg: Service Worker, Cache, Offline-Start.
 *
 * Läuft in einem eigenen Playwright-Projekt gegen den **Produktionsbuild**
 * (`vite preview`, siehe `playwright.config.ts`), weil sich der Service Worker
 * nur dort registriert. Die übrigen E2E-Tests laufen gegen den
 * Entwicklungsserver und berühren diesen Weg nie.
 *
 * Genau deshalb blieben zwei Fehler lange unbemerkt: Die Dateien mit
 * Inhalts-Hash fehlten im Cache, und wegen `Vary` in den Antworten traf die
 * Suche ohnehin nicht. Der erste Offline-Start zeigte eine leere Seite – eine
 * installierte PWA, die offline nichts anzeigt.
 */
test('registriert den Service Worker und legt die App vollständig in den Cache', async ({ page }) => {
  await page.goto('/')

  const registrierung = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready
    return { scope: reg.scope, aktiv: Boolean(reg.active) }
  })
  expect(registrierung.aktiv).toBe(true)
  expect(registrierung.scope).toBe(`${new URL(page.url()).origin}/`)

  // Was das HTML zum Start braucht, muss im Cache liegen – sonst bleibt der
  // Offline-Start leer, weil das HTML aus dem Cache kommt und sein JavaScript
  // nicht.
  const cache = await page.evaluate(async () => {
    const namen = await caches.keys()
    const speicher = await caches.open(namen[0])
    const pfade = (await speicher.keys()).map((anfrage) => new URL(anfrage.url).pathname)
    const verweise = [...document.querySelectorAll('script[src], link[rel=stylesheet]')].map(
      (element) => new URL((element as HTMLScriptElement).src || (element as HTMLLinkElement).href).pathname,
    )
    return { pfade, verweise }
  })
  expect(cache.pfade).toContain('/index.html')
  expect(cache.verweise.length).toBeGreaterThan(0)
  for (const verweis of cache.verweise) {
    expect(cache.pfade, `${verweis} fehlt im Cache`).toContain(verweis)
  }

  const manifest = await page.evaluate(async () => {
    const link = document.querySelector('link[rel=manifest]')
    if (!link) return null
    return (await fetch(link.getAttribute('href') ?? '')).json()
  })
  expect(manifest?.name).toBeTruthy()
  expect(manifest?.start_url).toBe('/')
  expect(manifest?.icons?.length ?? 0).toBeGreaterThanOrEqual(3)
})

test('startet offline aus dem Cache, ohne fehlgeschlagene Anfrage', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(() => navigator.serviceWorker.ready)

  // Jede fehlgeschlagene Anfrage ist der Fehler: HTML kommt aus dem Cache,
  // die Bundles nicht.
  const fehlgeschlagen: string[] = []
  page.on('response', (antwort) => {
    if (antwort.status() >= 400) fehlgeschlagen.push(`${antwort.status()} ${antwort.url()}`)
  })
  page.on('requestfailed', (anfrage) => fehlgeschlagen.push(`fehlgeschlagen ${anfrage.url()}`))

  await context.setOffline(true)
  await page.reload()

  // Die Anmeldemaske beweist, dass das Bundle geladen wurde – ohne es wäre die
  // Seite leer.
  await expect(page.getByLabel('E-Mail', { exact: true })).toBeVisible()
  expect(fehlgeschlagen).toEqual([])
})

test('startet mit gespeichertem Benutzernamen, Aufgaben und hellem Thema auch offline', async ({ page, context, request }) => {
  await resetServer(request)
  await register(page, uniqueEmail('pwa-username'))
  await createList(page, 'Offline-Bestand')
  await createTask(page, 'Gespeicherte Aufgabe')
  await page.getByRole('button', { name: 'Hellen Modus einschalten', exact: true }).click()
  await page.evaluate(() => navigator.serviceWorker.ready)
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Dunklen Modus einschalten', exact: true })).toBeVisible()
  const icon = page.locator('img[src="/icons/icon-light-192.png"]')
  await expect(icon).toBeVisible()
  await expect.poll(() => icon.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  await expect(page.getByRole('heading', { name: 'Gesamtansicht', exact: true })).toBeVisible()
  await page.getByRole('complementary', { name: 'Listen' }).getByRole('button', { name: 'Offline-Bestand', exact: true }).click()
  await expect(taskItem(page, 'Gespeicherte Aufgabe')).toBeVisible()
})


test('bewahrt Checklisten und Tags beim Offline-Neustart und überträgt spätere Häkchen', async ({page,context,request})=>{
  await resetServer(request)
  await register(page,uniqueEmail('pwa-checklist'))
  await createList(page,'Reise')
  await createTask(page,'Koffer')
  const editor=await openTaskEditor(page,'Koffer')
  await addChecklistPoint(editor,'Kleidung')
  await addChecklistPoint(editor,'Ladekabel')
  await addTags(editor,['Unterwegs'])
  await editor.getByRole('button',{name:'Speichern',exact:true}).click()
  await expect.poll(async()=>(await serverState(request)).tasks.find(task=>task.title==='Koffer')?.tags).toEqual(['Unterwegs'])
  await page.evaluate(()=>navigator.serviceWorker.ready)
  await context.setOffline(true)
  let row=outerTask(page,'Koffer')
  await row.getByRole('button',{name:'Checkliste: Koffer',exact:true}).click()
  await row.getByLabel('Checklistenpunkt: Kleidung',{exact:true}).check()
  await expect(row.getByRole('button',{name:'Checkliste: Koffer',exact:true})).toHaveText('1/2')
  await page.reload()
  await selectList(page,'Reise')
  row=outerTask(page,'Koffer')
  await expect(row).toContainText('Unterwegs')
  await expect(row.getByRole('button',{name:'Checkliste: Koffer',exact:true})).toHaveText('1/2')
  await row.getByRole('button',{name:'Checkliste: Koffer',exact:true}).click()
  await expect(row.getByLabel('Checklistenpunkt: Kleidung',{exact:true})).toBeChecked()
  await expect(row.getByRole('button',{name:/^Checklistenpunkt (verschieben|löschen):/})).toHaveCount(0)
  await context.setOffline(false)
  await page.getByRole('button',{name:'Jetzt synchronisieren',exact:true}).click()
  await expect.poll(async()=>(await serverState(request)).tasks.find(task=>task.title==='Koffer')?.checklist.filter(item=>item.completed).map(item=>item.text)).toEqual(['Kleidung'])
})
