// sw.js
// Estrategia:
// 1) Archivos PROPIOS de la app (los que editas en GitHub: index.html, app.jsx,
//    storage.js, icons.js, firebase-config.js, manifest.json, iconos) -> "red
//    primero": si hay internet, siempre se trae la última versión y se guarda
//    en caché; si no hay internet, se usa lo último que quedó guardado.
//    Así YA NO hace falta subir un número de versión cada vez que editas algo:
//    en cuanto abras la app con señal, jala tu cambio nuevo automáticamente.
// 2) CDNs externos (React, Babel, Firebase): "caché primero, refresca detrás".
//    Esos casi no cambian, así que priorizamos velocidad y que funcionen sin
//    conexión desde la primera visita.

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

  const isSameOrigin = new URL(req.url).origin === self.location.origin;

  if (isSameOrigin) {
    // RED PRIMERO: intenta traer la versión más nueva; si no hay internet, usa la caché.
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.open(CACHE_NAME).then((cache) => cache.match(req)))
    );
    return;
  }

  // CDNs externos: caché primero, refresca en segundo plano.
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
