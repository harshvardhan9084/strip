const SHELL_CACHE = 'strip-shell-v2';
const RUNTIME_CACHE = 'strip-runtime-v2';

const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './offline.html',
  './css/style.css',
  './js/storage.js',
  './js/settings.js',
  './js/settings-ui.js',
  './js/registry.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// simple helper to limit runtime cache size (optional)
async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxItems) {
    await cache.delete(keys[0]);
  }
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(cache => cache.addAll(SHELL_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== SHELL_CACHE && k !== RUNTIME_CACHE).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const req = event.request;
  const url = new URL(req.url);

  // Navigation requests: try network first, then cache, then offline page
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(resp => {
        // update shell cache with fresh navigation responses if same-origin
        if (resp && resp.ok && url.origin === self.location.origin) {
          const copy = resp.clone();
          caches.open(SHELL_CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return resp;
      }).catch(() => caches.match('./offline.html'))
    );
    return;
  }

  // Runtime caching strategy for game scripts and dynamic assets under /js/games/
  if (url.pathname.startsWith('/js/games/') || url.pathname.startsWith('js/games/')) {
    event.respondWith(
      fetch(req).then(networkResp => {
        if (networkResp && networkResp.ok && url.origin === self.location.origin) {
          const clone = networkResp.clone();
          caches.open(RUNTIME_CACHE).then(cache => {
            cache.put(req, clone);
            // keep runtime cache small
            trimCache(RUNTIME_CACHE, 60);
          });
        }
        return networkResp;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // For other same-origin requests: cache-first, then network
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(networkResp => {
        // cache a copy for future
        if (networkResp && networkResp.ok) {
          const clone = networkResp.clone();
          caches.open(RUNTIME_CACHE).then(cache => cache.put(req, clone));
        }
        return networkResp;
      }).catch(() => cached))
    );
    return;
  }

  // Cross-origin requests: fallback to network (don't cache)
  event.respondWith(fetch(req).catch(() => caches.match(req)));
});
