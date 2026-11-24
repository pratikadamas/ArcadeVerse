/**
 * ArcadeVerse - Service Worker Engine (PWA & Offline Shell)
 * Provides offline caching, stale-while-revalidate asset delivery,
 * Background Sync API fallback for offline queues,
 * and graceful fallback for hub pages and previously played local games.
 * Includes skipWaiting handling for PWA update available banner (#555).
 *
 * NSOC Winter Edition 2026
 */

const CACHE_VERSION = 'arcadeverse-v1';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const GAME_VAULT_CACHE = 'arcadeverse-game-vault-v1';
const GAME_CACHE_PREFIX = 'arcadeverse-game-';

// Static assets for offline shell
const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/css/style.css',
  './assets/css/network-detector.css',
  './assets/css/trophy-card.css',
  './assets/css/sound-engine.css',
  './assets/css/game-ratings.css',
  './assets/css/pwa-cache-prewarmer.css',
  './assets/js/navbar.js',
  './assets/js/virtual-grid.js',
  './assets/js/app.js',
  './assets/js/network-detector.js',
  './assets/js/pwa-cache-prewarmer.js',
  './assets/js/leaderboard.js',
  './assets/public/favicon.ico',
  './assets/public/favicon-32x32.png',
  './assets/public/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(async (cache) => {
        try {
          await cache.addAll(SHELL_ASSETS);
        } catch (_) {
          // Graceful fallback: individual caching in case of partial network availability
          await Promise.allSettled(
            SHELL_ASSETS.map(async (assetUrl) => {
              try {
                const response = await fetch(assetUrl);
                if (response && response.ok) {
                  await cache.put(assetUrl, response);
                }
              } catch (_) {}
            })
          );
        }
      })
  );
});

self.addEventListener('activate', (event) => {
  const allowedCaches = new Set([SHELL_CACHE, RUNTIME_CACHE, GAME_VAULT_CACHE]);

  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (!allowedCaches.has(key) && !key.startsWith(GAME_CACHE_PREFIX)) {
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
      caches.open(GAME_VAULT_CACHE).then(async (gameCache) => {
        const vaultResponse = await gameCache.match(request, { ignoreSearch: true });
        if (vaultResponse) return vaultResponse;

        const individualCache = await caches.open(cacheName);
        const cachedResponse = await individualCache.match(request);
        if (cachedResponse) {
          // Stale-While-Revalidate: background refresh
          fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              individualCache.put(request, networkResponse.clone());
            }
          }).catch(() => {});
          return cachedResponse;
        }

        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            individualCache.put(request, clone).catch(() => {});
          }
          return networkResponse;
        } catch (_) {
          return new Response('Offline and game asset not cached', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain' }
          });
        }
      })
    );
    return;
  }

  // Shell and runtime assets: Stale-While-Revalidate with offline navigation fallback
  event.respondWith(
    caches.match(request).then(async (cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clonedResponse = networkResponse.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, clonedResponse);
            }).catch(() => {});
          }
          return networkResponse;
        })
        .catch(async () => {
          if (cachedResponse) {
            return cachedResponse;
          }

          if (request.mode === 'navigate') {
            const offlineIndex = await caches.match('./index.html');
            if (offlineIndex) return offlineIndex;
            const offline404 = await caches.match('./404.html');
            if (offline404) return offline404;
          }

          return new Response('Network unavailable (Offline)', {
            status: 503,
            statusText: 'Service Unavailable (Offline)',
            headers: { 'Content-Type': 'text/plain' }
          });
        });

      if (cachedResponse) {
        event.waitUntil(fetchPromise.catch(() => {}));
        return cachedResponse;
      }

      return fetchPromise;
    })
  );
});

/**
 * Background Sync API listener for offline score and favorite dispatch
 */
self.addEventListener('sync', (event) => {
  if (event.tag === 'av-sync-offline-queue') {
    event.waitUntil(
      self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then((clients) => {
        if (clients && clients.length > 0) {
          clients.forEach((client) => {
            client.postMessage({ type: 'AV_TRIGGER_OFFLINE_SYNC' });
          });
        }
      })
    );
  }
});

/**
 * Message listener for lifecycle commands (e.g. manual skipWaiting)
 */
self.addEventListener('message', (event) => {
  if (event.data && (event.data.type === 'SKIP_WAITING' || event.data.action === 'skipWaiting')) {
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
