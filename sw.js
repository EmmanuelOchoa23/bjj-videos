// Guarda la app para que abra sin conexión, pero SIEMPRE pide la versión nueva primero
// (cache: 'no-cache' evita que el navegador use una copia vieja de hasta 10 minutos).
const C = 'bjj-videos-v5';
const SHELL = ['./', 'index.html', 'app.js', 'style.css', 'config.js', 'manifest.json', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(C).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'no-cache' })))));
  self.skipWaiting();
});
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  const key = u.origin + u.pathname; // sin ?parámetros (ej. lo que llega al compartir)
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then(r => { if (r.ok) { const cp = r.clone(); caches.open(C).then(c => c.put(key, cp)); } return r; })
      .catch(() => caches.match(key).then(r => r || caches.match('./')))
  );
});
