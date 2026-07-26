// sw.js
// Estrategia:
// 1) Archivos PROPIOS de la app (los que editas en GitHub: index.html, app.jsx,
//    storage.js, icons.js, firebase-config.js, manifest.json, iconos) -> "caché
//    primero, refresca detrás": la app abre al instante con lo último guardado,
//    y en segundo plano se revisa si hay una versión más nueva para la
//    siguiente vez que la abras (evita esperar a la red cada vez que entras).
// 2) CDNs externos (React, Babel, Firebase): misma idea, "caché primero,
//    refresca detrás". Esos casi no cambian, así que priorizamos velocidad y
//    que funcionen sin conexión desde la primera visita.

const CACHE_NAME = 'libro-diario-shell'; // fijo: ya no se incrementa a mano

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

  // CACHÉ PRIMERO (para archivos propios y externos por igual): responde con
  // lo que ya está guardado si existe, y de una vez sale a la red a traer la
  // versión más reciente para dejarla guardada de cara a la próxima apertura.
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(req).then((cached) => {
        const networkFetch = fetch(req)
          .then((res) => {
            if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || networkFetch;
      })
    )
  );
});

// Permite que la página le pida al SW nuevo que tome control de inmediato.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
