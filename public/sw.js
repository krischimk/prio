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

const CACHE_NAME = 'prio-shell-v0.1.0'

const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME)
      await cache.addAll(APP_SHELL)
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
      const cached = (await cache.match('/index.html')) ?? (await cache.match('/'))
      if (cached) return cached
      return new Response('Die App ist offline noch nicht vollständig geladen.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    }
  }

  // Statische Dateien: aus dem Cache, im Hintergrund aktualisieren.
  const cached = await cache.match(request)
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
