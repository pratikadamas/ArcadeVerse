/**
 * ArcadeVerse - Service Worker Engine (PWA & Offline Shell)
 * Provides offline caching, stale-while-revalidate asset delivery,
 * and graceful fallback for hub pages and previously played local games.
 * Includes skipWaiting handling for PWA update available banner (#555).
 *
 * NSOC Winter Edition 2026
 */

const CACHE_VERSION = 'arcadeverse-v1';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// Core static hub shell assets required for offline rendering
const CORE_SHELL_ASSETS = [
  './',
  './index.html',
  './leaderboard.html',
  './docs.html',
  './faqs.html',
  './404.html',
  './manifest.webmanifest',
  './assets/css/style.css',
  './assets/css/pages.css',
  './assets/css/a11y-engine.css',
  './assets/css/halloween.css',
  './assets/css/daily-challenge.css',
  './assets/css/recently-played.css',
  './assets/css/keyboard-shortcuts.css',
  './assets/css/network-detector.css',
  './assets/css/trophy-card.css',
  './assets/css/sound-engine.css',
  './assets/css/game-ratings.css',
  './assets/js/navbar.js',
  './assets/js/app.js',
  './assets/js/games-registry.js',
  './assets/js/a11y-engine.js',
  './assets/js/sound-engine.js',
  './assets/js/keyboard-shortcuts.js',
  './assets/js/network-detector.js',
  './assets/js/leaderboard.js',
  './assets/public/favicon.ico',
  './assets/public/favicon-32x32.png',
  './assets/public/favicon-192x192.png',
  './assets/public/apple-touch-icon.png',
  './assets/public/brand-logo.webp',
  './assets/public/brand-logo.png'
];

/**
 * Installation event: pre-caches the core hub shell assets.
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(async (cache) => {
        try {
          await cache.addAll(CORE_SHELL_ASSETS);
        } catch (_) {
          // Graceful fallback: individual caching in case of partial network availability
          await Promise.allSettled(
            CORE_SHELL_ASSETS.map(async (assetUrl) => {
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

/**
 * Activation event: cleans up outdated cache versions and claims clients immediately.
 */
self.addEventListener('activate', (event) => {
  const allowedCaches = [SHELL_CACHE, RUNTIME_CACHE];

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (!allowedCaches.includes(cacheName)) {
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

/**
 * Fetch event: Implements Stale-While-Revalidate for shell and runtime assets,
 * with network fallback and offline navigation support.
 */
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only handle HTTP/HTTPS GET requests
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Ignore non-http(s) schemes (browser extensions, data URIs, chrome internal, etc.)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      // Revalidation fetch in background
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          // Cache successful responses into runtime cache for offline re-use
          if (networkResponse && networkResponse.status === 200) {
            const clonedResponse = networkResponse.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, clonedResponse);
            }).catch(() => {});
          }
          return networkResponse;
        })
        .catch(async () => {
          // If offline and request is already in cache, serve cached version
          if (cachedResponse) {
            return cachedResponse;
          }

          // Navigation fallback for offline browsing
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

      // Stale-While-Revalidate: return cached response immediately if present,
      // while dispatching network revalidation in the background.
      if (cachedResponse) {
        event.waitUntil(fetchPromise.catch(() => {}));
        return cachedResponse;
      }

      // If cache miss, await network response
      return fetchPromise;
    })
  );
});

/**
 * Message listener for lifecycle commands (e.g. manual skipWaiting)
 */
self.addEventListener('message', (event) => {
  if (event.data && (event.data.type === 'SKIP_WAITING' || event.data.action === 'skipWaiting')) {
    self.skipWaiting();
  }
});
