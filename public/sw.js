// My Japan Trip — Service Worker
// Stratégie: cache-first pour assets, network-first pour API

const CACHE_NAME = 'mjt-v1';
const STATIC_ASSETS = ['/', '/manifest.json'];

// Installation : mettre en cache les assets essentiels
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(STATIC_ASSETS).catch(() => {});
        })
    );
    self.skipWaiting();
});

// Activation : nettoyer les anciens caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Fetch : cache-first pour HTML/assets, network-first pour /api/*
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // API calls — toujours réseau (pas de cache)
    if (url.pathname.startsWith('/api/')) return;

    // Assets statiques — cache-first avec fallback réseau
    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;
            return fetch(event.request).then(response => {
                // Mettre en cache uniquement les succès (200)
                if (response.ok && event.request.method === 'GET') {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            }).catch(() => {
                // Hors-ligne : renvoyer le cache principal si disponible
                return caches.match('/') || new Response('Hors-ligne', { status: 503 });
            });
        })
    );
});
