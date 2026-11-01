// Réseau d'abord, cache en secours : toujours à jour en ligne, utilisable hors ligne dès la 2e ouverture.
// shortcut: le cache garde aussi les anciens fichiers de chaque déploiement (quelques Ko), à nettoyer si ça grossit.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) return
  event.respondWith(
    caches.open('tables').then(async (cache) => {
      try {
        const response = await fetch(event.request)
        if (response.ok) cache.put(event.request, response.clone())
        return response
      } catch {
        return (await cache.match(event.request)) ?? Response.error()
      }
    }),
  )
})
