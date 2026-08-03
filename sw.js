// sw.js
// Estrategia:
// 1) Archivos PROPIOS de la app (los que editas en GitHub: index.html, app.jsx,
//    storage.js, icons.js, firebase-config.js, manifest.json, iconos) -> "red
//    primero": si hay internet, siempre trae la versión más reciente que
//    subiste a GitHub y la deja guardada; si no hay internet, usa la última
//    guardada. Así los cambios se ven con un solo refresh, sin esperar a la
//    siguiente apertura.
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

// Nombres de archivo (sin carpeta) que cuentan como "propios" para la
// estrategia de red primero. '' cubre la ruta raíz ('/').
const OWN_FILENAMES = new Set(['', 'index.html', 'app.jsx', 'storage.js', 'icons.js', 'firebase-config.js', 'manifest.json', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png']);

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

  const url = new URL(req.url);
  const filename = url.pathname.split('/').pop();
  const isOwnFile = url.origin === self.location.origin && OWN_FILENAMES.has(filename);

  if (isOwnFile) {
    // RED PRIMERO: trae siempre lo último que subiste. Si falla (sin
    // internet), cae al respaldo guardado en caché.
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

  // CACHÉ PRIMERO (para CDNs externos): responde con lo que ya está guardado
  // si existe, y de una vez sale a la red a traer la versión más reciente
  // para dejarla guardada de cara a la próxima apertura.
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
