const SHELL_CACHE = 'strip-shell-v4';
const RUNTIME_CACHE = 'strip-runtime-v4';

// Bump BOTH version strings every round that touches any shell file —
// installed PWAs key their caches on these names, so a stale version means
// stale code forever.
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
  './js/feedback.js',
  './js/shufflebag.js',
  './js/install-handler.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// simple helper to limit runtime cache size
async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  // delete until within the cap — the old code removed a single entry per put,
  // which could never catch up once over the limit (effectively no cap)
  for (let i = 0; i < keys.length - maxItems; i++) {
    await cache.delete(keys[i]);
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

  // Navigation requests: try network first, then the PRECACHED shell, then the
  // offline page. The old handler skipped the cache step entirely — an installed
  // PWA launched offline always landed on offline.html and could not play
  // anything, defeating the app's offline-first promise (and contradicting
  // offline.html's own "You can still play cached cartridges" copy).
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(resp => {
        // update shell cache with fresh navigation responses if same-origin
        if (resp && resp.ok && url.origin === self.location.origin) {
          const copy = resp.clone();
          caches.open(SHELL_CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return resp;
      }).catch(() =>
        caches.match(req).then(cached => cached || caches.match('./offline.html'))
      )
    );
    return;
  }

  // Game scripts AND shell code (all js/*.js + css): network-first so deploys
  // reach installed clients immediately (cache only as offline fallback).
  // The old branch matched pathname startsWith('/js/games/'), which NEVER
  // matches on a GitHub Pages project site (paths look like /strip/js/games/...)
  // — and even after that was fixed, feedback.js / shufflebag.js /
  // install-handler.js fell through to a cache-first branch and froze at
  // install-time versions, silently un-shippable.
  if (url.origin === self.location.origin &&
      (/\/js\/.+\.js$/.test(url.pathname) || /\/css\/.+\.css$/.test(url.pathname))) {
    event.respondWith(
      fetch(req).then(networkResp => {
        // degrade to cache on network failure OR a bad status (e.g. a 404
        // during a botched deploy) — a stale cartridge beats a broken one
        if (networkResp && networkResp.ok) {
          const clone = networkResp.clone();
          caches.open(RUNTIME_CACHE).then(cache => {
            cache.put(req, clone);
            trimCache(RUNTIME_CACHE, 60);
          }).catch(() => {});
          return networkResp;
        }
        return caches.match(req).then(cached => cached || networkResp);
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
