// Network first (always fresh when online), cache as offline fallback.
const V = 'eftaios-v64';
const FILES = ['./', 'index.html', 'style.css', 'firebase-config.js', 'vendor/qrcode.js', 'vendor/jsQR.js', 'i18n.js', 'cards.js', 'gicons.js', 'sync.js', 'app.js', 'game.js', 'online.js', 'bot.js', 'hot.js', 'mapman.js', 'flow.js',
  'maps/maps.json', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png'];
self.addEventListener('install', e => e.waitUntil(caches.open(V).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(fetch(req, { cache: 'no-cache' }).then(r => {
    if (r.ok && !req.url.includes('?')) { const c = r.clone(); caches.open(V).then(x => x.put(req, c)); }
    return r;
  }).catch(async () => (await caches.match(req, { ignoreSearch: true })) || (req.mode === 'navigate' ? caches.match('index.html') : Response.error())));
});
