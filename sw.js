const CACHE_NAME = 'vakit-cami-v44';
const APP_SHELL = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './mosques.js',
    './manifest.webmanifest',
    './icons/icon.svg',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/icon-192-maskable.png',
    './icons/icon-512-maskable.png',
    './icons/icon-apple-180.png',
    './icons/screenshot-desktop.jpg',
    './icons/screenshot-mobile.jpg',
    './vendor/leaflet/leaflet.css',
    './vendor/leaflet/leaflet.js',
    './vendor/leaflet/images/marker-icon.png',
    './vendor/leaflet/images/marker-icon-2x.png',
    './vendor/leaflet/images/marker-shadow.png'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);
    if (url.origin !== self.location.origin) return;

    // Network-First with Cache-Fallback for page navigation
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    if (response.ok) {
                        const copy = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
                    }
                    return response;
                })
                .catch(() => {
                    return caches.match('./index.html') || caches.match('./') || caches.match(event.request);
                })
        );
        return;
    }

    // Stale-While-Revalidate for static assets
    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                if (cachedResponse) {
                    fetch(event.request).then(networkResponse => {
                        if (networkResponse.ok) {
                            caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse));
                        }
                    }).catch(() => {});
                    return cachedResponse;
                }

                return fetch(event.request)
                    .then(networkResponse => {
                        if (networkResponse.ok) {
                            const copy = networkResponse.clone();
                            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
                        }
                        return networkResponse;
                    });
            })
    );
});
