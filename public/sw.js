// ORBIT Pinball service worker: app-shell precache + runtime cache-first for
// same-origin GETs. Written in plain JS (no build step) and served from public/.
// Update CACHE_VERSION whenever shipped assets change materially; the previous
// cache is deleted on activate and open tabs are claimed immediately.
const CACHE_VERSION = 'orbit-pinball-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './favicon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    // Individually tolerated: a missing optional asset must not fail the whole install.
    await Promise.allSettled(SHELL.map(url => cache.add(new Request(url, { cache: 'reload' }))));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key !== CACHE_VERSION) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_VERSION);
    const hit = await cache.match(request, { ignoreSearch: true });
    if (hit) {
      // Keep the app shell fresh in the background; navigation falls back to the shell when offline.
      event.waitUntil((async () => {
        try {
          const fresh = await fetch(request);
          if (fresh.ok) await cache.put(request, fresh.clone());
        } catch { /* Offline: keep serving the cached copy. */ }
      })());
      return hit;
    }
    try {
      const fresh = await fetch(request);
      if (fresh.ok) cache.put(request, fresh.clone());
      return fresh;
    } catch {
      if (request.mode === 'navigate') {
        const shell = await cache.match('./index.html', { ignoreSearch: true });
        if (shell) return shell;
      }
      throw new Error(`offline and not cached: ${request.url}`);
    }
  })());
});
