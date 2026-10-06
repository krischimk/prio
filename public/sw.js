/*
 * Service Worker für prio (PWA).
 *
 * Aufgabenstellung: Die Anwendung selbst offline verfügbar machen.
 *
 * Wichtig – und bewusst so gebaut:
 *   Der Service Worker speichert AUSSCHLIESSLICH die Anwendung (HTML, JS, CSS,
 *   Icons). Aufgaben und Listen liegen in IndexedDB und werden hier nicht
 *   angefasst. Es gibt deshalb auch keinen Hintergrund-Sync von Daten.
 *
 *   Anfragen an andere Origins (insbesondere Supabase) werden NICHT abgefangen.
 *   Sonst könnten veraltete Cloud-Antworten aus dem Cache kommen – genau das
 *   würde die Sync-Logik unzuverlässig machen.
 *
 * CACHE_NAME bei jeder Änderung an der App-Shell erhöhen, damit alte Caches
 * beim Aktivieren gelöscht werden.
 */

const CACHE_NAME = 'prio-shell-v0.2.0'

const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
]

/**
 * Sammelt die Dateien mit Inhalts-Hash (das gebaute JS und CSS) aus dem HTML
 * ein und legt sie mit in den Cache.
 *
 * Ohne sie wäre der **erste** Offline-Start leer: Das HTML käme aus dem Cache,
 * sein JavaScript nicht. Beim allerersten Laden ist der Service Worker noch
 * nicht im Zugriff, die Dateien laufen also an ihm vorbei – sie landen erst bei
 * einem zweiten Online-Besuch im Cache. Da die Namen den Hash tragen, kann
 * diese Liste sie nicht einfach aufzählen; sie stehen aber im HTML.
 */
async function cacheBundles(cache) {
  const antwort = await fetch('/index.html', { cache: 'no-cache' })
  if (!antwort.ok) return

  const html = await antwort.text()
  const verweise = new Set()
  for (const treffer of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const pfad = treffer[1]
    if (!pfad.startsWith('/') || pfad.startsWith('//')) continue
    if (pfad.endsWith('.js') || pfad.endsWith('.css')) verweise.add(pfad)
  }
  if (verweise.size > 0) await cache.addAll([...verweise])
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME)
      await cache.addAll(APP_SHELL)
      // Ein misslungenes Vorabladen darf den Service Worker nicht verhindern –
      // dann greift wie bisher der Cache beim zweiten Besuch.
      await cacheBundles(cache).catch(() => undefined)
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  // Nur die eigene Anwendung cachen. Alles andere – vor allem Supabase –
  // geht unverändert ans Netz.
  if (url.origin !== self.location.origin) return

  event.respondWith(handleRequest(request))
})

async function handleRequest(request) {
  const cache = await caches.open(CACHE_NAME)

  // Navigation: erst Netz (immer aktuelle Version), sonst letzte bekannte Seite.
  if (request.mode === 'navigate') {
    try {
      const response = await fetch(request)
      if (response.ok) await cache.put('/index.html', response.clone())
      return response
    } catch {
      const cached =
        (await cache.match('/index.html', { ignoreVary: true })) ??
        (await cache.match('/', { ignoreVary: true }))
      if (cached) return cached
      return new Response('Die App ist offline noch nicht vollständig geladen.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    }
  }

  // Statische Dateien: aus dem Cache, im Hintergrund aktualisieren.
  //
  // `ignoreVary`, weil Server ihren Antworten ein `Vary` mitgeben (Vite:
  // `Origin`, Cloudflare: `Accept-Encoding`) und die Anfrage beim Vorabladen
  // andere Kopfzeilen trägt als die der Seite – ohne diese Angabe trifft der
  // Cache dann nicht, und der Offline-Start bleibt leer.
  const cached = await cache.match(request, { ignoreVary: true })
  if (cached) {
    fetch(request)
      .then((response) => {
        if (response.ok) return cache.put(request, response.clone())
        return undefined
      })
      .catch(() => undefined)
    return cached
  }

  try {
    const response = await fetch(request)
    if (response.ok) await cache.put(request, response.clone())
    return response
  } catch {
    return new Response('', { status: 504 })
  }
}
