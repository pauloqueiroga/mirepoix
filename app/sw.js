// Service worker (D1, D4): keeps the app shell on the device so Mirepoix
// opens instantly and works offline. Devices pick up new files only when this
// file changes, so VERSION moves with package.json's version on every release.
// A unit test keeps SHELL equal to the files in app/.

const VERSION = '0.3.0';
const CACHE = `mirepoix-shell-${VERSION}`;
const SHELL = [
  './',
  'index.html',
  'main.js',
  'offline.js',
  'config.js',
  'analytics.js',
  'privacy.html',
  'privacy.pt.html',
  'privacy.js',
  'robots.txt',
  'sitemap.xml',
  'manifest.webmanifest',
  'styles/app.css',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'icons/logo-horizontal.svg',
  'icons/logo-horizontal-dark.svg',
  'icons/logo-stacked.svg',
  'icons/logo-stacked-dark.svg',
  'icons/social.png',
  'domain/backup.js',
  'domain/draft.js',
  'domain/fingerprint.js',
  'domain/ingredients.js',
  'domain/quantity.js',
  'domain/recipe.js',
  'domain/search.js',
  'domain/sections.js',
  'domain/units.js',
  'store/base64.js',
  'store/crypto.js',
  'store/github.js',
  'store/local-store.js',
  'store/sync.js',
  'ui/app.js',
  'ui/dom.js',
  'ui/i18n.js',
  'ui/router.js',
  'ui/views/backup.js',
  'ui/views/editor.js',
  'ui/views/list.js',
  'ui/views/message.js',
  'ui/views/recipe.js',
  'ui/views/sync.js',
];

const sw = /** @type {ServiceWorkerGlobalScope} */ (/** @type {unknown} */ (self));

sw.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => sw.skipWaiting()),
  );
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith('mirepoix-shell-') && key !== CACHE)
        .map((key) => caches.delete(key))))
      .then(() => sw.clients.claim()),
  );
});

// Cache first for the app's own files; anything else (e.g. GitHub's API) goes
// straight to the network.
sw.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== sw.location.origin) return;
  event.respondWith(caches.open(CACHE).then(async (cache) =>
    (await cache.match(request, { ignoreSearch: true }))
    ?? (request.mode === 'navigate' ? await cache.match('./') : undefined)
    ?? fetch(request)));
});
