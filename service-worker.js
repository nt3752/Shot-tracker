// Self-disabling service worker: unregisters itself and clears caches.
// This prevents stale cached assets on iOS Safari / GitHub Pages.
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try{
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }catch(e){}
    try{ await self.registration.unregister(); }catch(e){}
    try{ await self.clients.claim(); }catch(e){}
  })());
});

self.addEventListener('fetch', (event) => {
  // Pass-through: no caching
  event.respondWith(fetch(event.request));
});
