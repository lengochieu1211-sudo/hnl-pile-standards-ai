const params = new URL(self.location.href).searchParams;
const CACHE = `hnl-pile-ai-${params.get('v') || 'runtime'}`;
const SHELL = ['./', './manifest.webmanifest', './favicon.ico', './hnl-mark-32.png', './hnl-mark-64.png', './hnl-mark-192.png', './hnl-mark-512.png', './changelog.json'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).catch(() => null));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.includes('/api/')) return;

  // Build metadata and HTML are always network-first so the UI reflects the latest successful deploy.
  if (req.mode === 'navigate' || req.destination === 'document' || url.pathname.endsWith('/build-info.json') || url.pathname.endsWith('/changelog.json')) {
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; })
        .catch(() => caches.match(req).then(cached => cached || caches.match('./')))
    );
    return;
  }

  // Vite assets are content-hashed. Cache-first is safe; refresh in background.
  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
