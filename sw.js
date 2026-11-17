/**
 * ArcadeVerse — Service Worker & LRU Cache Storage Manager
 * Dynamic Game Assets Pre-Caching Strategy with 50MB Storage Budget Guard
 *
 * NSOC Winter Edition 2026
 */

const SW_VERSION = 'av-sw-v1';
const STATIC_CACHE_NAME = `arcadeverse-static-${SW_VERSION}`;
const GAME_CACHE_PREFIX = 'av-game-';
const MAX_GAME_CACHE_BYTES = 50 * 1024 * 1024; // 50MB safe storage budget

// Static assets for offline shell
const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/css/style.css',
  './assets/css/network-detector.css',
  './assets/js/app.js',
  './assets/js/network-detector.js',
  './assets/js/keyboard-shortcuts.js',
  './assets/js/arcadeverse-sdk.js',
  './assets/public/favicon.ico',
  './assets/public/favicon-32x32.png',
  './assets/public/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      return cache.addAll(SHELL_ASSETS).catch((err) => {
        console.warn('[ArcadeVerse:SW] Non-fatal shell pre-cache skip:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== STATIC_CACHE_NAME && !key.startsWith(GAME_CACHE_PREFIX)) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Dynamic game asset fetch interceptor with LRU cache bucket routing
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (!url.protocol.startsWith('http')) return;

  // Detect requests to games/ directories: games/<game-id>/...
  const gameMatch = url.pathname.match(/\/games\/([^/]+)\//);
  if (gameMatch) {
    const gameId = gameMatch[1];
    const cacheName = `${GAME_CACHE_PREFIX}${gameId}`;

    event.respondWith(
      caches.open(cacheName).then((gameCache) => {
        return gameCache.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              gameCache.put(request, clone).catch(() => {});
            }
            return networkResponse;
          }).catch(() => {
            return new Response('Offline and game asset not cached', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({ 'Content-Type': 'text/plain' })
            });
          });
        });
      })
    );
    return;
  }

  // Shell & Static asset routing
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(STATIC_CACHE_NAME).then((cache) => {
            cache.put(request, clone).catch(() => {});
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return new Response('Offline and asset not cached', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({ 'Content-Type': 'text/plain' })
          });
        });
      })
  );
});

// Message listener for LRU eviction commands and skipWaiting
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
    return;
  }

  if (event.data && event.data.type === 'AV_EVICT_GAME_CACHES') {
    const { evictList } = event.data;
    if (Array.isArray(evictList)) {
      evictList.forEach((gameId) => {
        caches.delete(`${GAME_CACHE_PREFIX}${gameId}`).then(() => {
          console.log(`[ArcadeVerse:SW] LRU evicted game cache: ${gameId}`);
        }).catch(() => {});
      });
    }
  }
});
