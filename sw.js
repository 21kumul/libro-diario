// sw.js
// Dos responsabilidades:
// 1) Precachear los archivos propios de la app en la instalación.
// 2) Para CUALQUIER petición (propia o de un CDN externo como React, Babel
//    o Firebase), servir desde la caché si existe y refrescarla en segundo
//    plano — así, después de abrir la app una vez con internet, funciona
//    completa sin conexión (los datos compartidos los maneja Firestore
//    aparte, con su propia caché sin conexión).

const CACHE_NAME = 'libro-diario-v12';

const APP_SHELL = [
  './',
  './index.html',
  './app.jsx',
  './storage.js',
  './icons.js',
  './firebase-config.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(req).then((cached) => {
        const networkFetch = fetch(req)
          .then((res) => {
            // Solo cacheamos respuestas válidas (incluye "opacas" de otros orígenes/CDNs)
            if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
            return res;
          })
          .catch(() => cached); // sin internet: usa lo que haya en caché

        // Si ya había algo en caché, respóndelo al instante y refresca detrás;
        // si no había nada, espera a la red (o falla si tampoco hay internet).
        return cached || networkFetch;
      })
    )
  );
});
