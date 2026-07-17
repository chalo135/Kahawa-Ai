/* ============================================================
   Kahawa Smart — Service Worker
   Makes the app installable and fast/offline-capable.

   Strategy: cache-first for the app SHELL (HTML, CSS, JS, CDN
   libraries, icons). The AI backend (/predict, /chat, /facts)
   and any POST are NEVER cached — they always hit the network
   and the app UI handles failure gracefully on its own.

   To force clients onto fresh assets after a deploy, bump the
   version number in CACHE below. Old caches are deleted on
   activate, so nobody is served stale files.
============================================================ */

const CACHE = 'kahawa-shell-v13'; // v13: same-origin backend URLs + honest scan-error notice — force clients off stale copies

// Files that make up the offline "app shell". Same-origin files are
// listed relative to scope; the CDN libraries are the exact URLs used
// by index.html so repeat visits work with no signal at all.
const SHELL = [
  './',
  './index.html',
  './login.html',
  './signup.html',
  './style.css',
  './auth.css',
  './app.js',
  './js/data/diseases.js',
  './auth.js',
  './login.js',
  './signup.js',
  './form-errors.js',
  './reset.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
  'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
  'https://unpkg.com/lucide@0.460.0/dist/umd/lucide.min.js',
];

// Cross-origin hosts we are happy to cache (CDN libs + Google Fonts).
const CACHEABLE_HOSTS = [
  'cdnjs.cloudflare.com',
  'unpkg.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
];

// Backend paths that must ALWAYS go to the network, never the cache.
// Everything under /api/ is network-only too (see the fetch handler):
// caching GET /api/me would hand back a stale session after logout.
const NETWORK_ONLY_PATHS = ['/predict', '/chat', '/facts'];

// ── INSTALL: pre-cache the shell ──────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      // addAll fails hard if any single request fails; cache them
      // individually so one flaky CDN response can't block install.
      .then(cache => Promise.all(
        SHELL.map(url => cache.add(url).catch(err =>
          console.warn('[SW] skip caching', url, err)
        ))
      ))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: drop old cache versions ─────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── FETCH: cache-first for the shell, network-only for API ─
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // 1. Only GET is cacheable. POST (leaf analysis, chat) passes
  //    straight through to the network untouched.
  if (req.method !== 'GET') return;

  // 2. Backend API calls always hit the network (fresh data / the
  //    app handles offline itself). Never serve these from cache.
  //    /api/* covers chat + auth: a cached /api/me would keep a user
  //    "signed in" after logout or after their session expired.
  if (url.pathname.startsWith('/api/')) return;
  if (NETWORK_ONLY_PATHS.some(p => url.pathname.endsWith(p))) return;

  // 3. Cache-first only for same-origin shell or the allow-listed CDNs.
  const sameOrigin = url.origin === self.location.origin;
  const cacheable = sameOrigin || CACHEABLE_HOSTS.includes(url.hostname);
  if (!cacheable) return;

  event.respondWith(cacheFirst(req));
});

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;

  try {
    const res = await fetch(req);
    // Cache successful and opaque (cross-origin CDN) responses so the
    // next visit is instant. Skip anything that errored.
    if (res && (res.ok || res.type === 'opaque')) {
      const cache = await caches.open(CACHE);
      cache.put(req, res.clone());
    }
    return res;
  } catch (err) {
    // Offline and not in cache. For a page navigation, fall back to the
    // cached app shell so the farmer sees the UI, not a browser error.
    if (req.mode === 'navigate') {
      const shell = await caches.match('./index.html');
      if (shell) return shell;
    }
    throw err;
  }
}
