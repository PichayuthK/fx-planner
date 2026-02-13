const CACHE_NAME = 'forex-plan-v4';

const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './app.js',
  './js/constants.js',
  './js/i18n.js',
  './js/storage.js',
  './js/projection.js',
  './js/log.js',
  './js/data-io.js',
  './assets/info.png',
  './assets/setting.png',
  './assets/refresh-page-option.png',
  './assets/trophy.png',
  './assets/app-icon.png',
  'https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin && !url.href.startsWith('https://cdn.jsdelivr.net/') && !url.href.startsWith('https://fonts.')) return;
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request).then((res) => {
      const clone = res.clone();
      if (res.ok && (url.origin === self.location.origin || url.href.startsWith('https://cdn.jsdelivr.net/') || url.href.startsWith('https://fonts.'))) {
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
      }
      return res;
    }))
  );
});
