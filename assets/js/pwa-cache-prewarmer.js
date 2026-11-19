/**
 * ArcadeVerse PWA game cache pre-warming and storage health monitor.
 */
(() => {
  'use strict';

  const CACHE_NAME = 'arcadeverse-game-vault-v1';
  const MAX_AUTO_GAMES = 10;
  const MAX_ASSETS_PER_GAME = 160;
  const STORAGE_RECENT_KEY = 'arcadeverse_recently_played_v2';
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const gameModal = document.getElementById('game-modal');

  function ensureVaultUi() {
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = new URL('assets/css/pwa-cache-prewarmer.css', document.baseURI).href;
    document.head.appendChild(stylesheet);

    let root = document.getElementById('offline-game-vault');
    const grid = document.getElementById('games-grid');
    if (!root && grid && grid.parentNode) {
      root = document.createElement('section');
      root.className = 'offline-game-vault';
      root.id = 'offline-game-vault';
      root.setAttribute('aria-labelledby', 'offline-vault-title');
      root.innerHTML = `
        <div class="offline-game-vault-copy">
          <h3 class="offline-game-vault-title" id="offline-vault-title">Offline Game Vault</h3>
          <p class="offline-game-vault-status" id="offline-vault-status" role="status" aria-live="polite">Checking game cache and storage...</p>
          <progress class="offline-game-vault-progress" id="offline-vault-progress" max="10" value="0" aria-label="0 of 10 prioritized games cached"></progress>
          <progress class="offline-game-vault-usage" id="offline-vault-usage" max="100" value="0" aria-label="Device storage usage"></progress>
          <p class="offline-game-vault-usage-label" id="offline-vault-usage-label">Checking available device storage...</p>
        </div>
        <div class="offline-game-vault-actions">
          <button class="btn btn-primary btn-sm" id="offline-vault-cache-top" type="button" aria-label="Pre-cache the ten highest-priority games for offline travel">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            Pre-cache Top 10 Games for Travel
          </button>
          <button class="btn btn-secondary btn-sm" id="offline-vault-clear" type="button" aria-label="Clear downloaded offline game assets">
            Clear Offline Game Cache
          </button>
        </div>
      `;
      grid.parentNode.insertBefore(root, grid);
    }
    return root;
  }

  ensureVaultUi();

  const ui = {
    root: document.getElementById('offline-game-vault'),
    status: document.getElementById('offline-vault-status'),
    progress: document.getElementById('offline-vault-progress'),
    usage: document.getElementById('offline-vault-usage'),
    usageLabel: document.getElementById('offline-vault-usage-label'),
    cacheButton: document.getElementById('offline-vault-cache-top'),
    clearButton: document.getElementById('offline-vault-clear')
  };

  let gameQueue = [];
  let activeController = null;
  let currentGame = null;
  let pausedForGameplay = Boolean(gameModal && gameModal.classList.contains('active'));
  let running = false;
  let automaticStartScheduled = false;
  let totalGames = 0;
  let completedGames = 0;

  function getRegistry() {
    return Array.isArray(window.GAMES_REGISTRY) ? window.GAMES_REGISTRY : [];
  }

  function getCache() {
    if (!('caches' in window)) {
      throw new Error('This browser does not support CacheStorage.');
    }
    return caches.open(CACHE_NAME);
  }

  function setStatus(message) {
    if (ui.status) ui.status.textContent = message;
  }

  function setProgress(done, total) {
    if (!ui.progress) return;
    ui.progress.max = Math.max(total, 1);
    ui.progress.value = Math.min(done, ui.progress.max);
    ui.progress.setAttribute('aria-label', `${done} of ${total} prioritized games cached`);
  }

  function isNetworkSuitable() {
    if (!navigator.onLine || (connection && connection.saveData)) return false;
    if (!connection) return true;
    const effectiveType = String(connection.effectiveType || '').toLowerCase();
    const connectionType = String(connection.type || '').toLowerCase();
    return !['2g', 'slow-2g', 'cellular'].includes(effectiveType) && connectionType !== 'cellular' && connection.metered !== true;
  }

  function canRun() {
    return !pausedForGameplay && isNetworkSuitable();
  }

  function readRecentIds() {
    try {
      const recent = JSON.parse(localStorage.getItem(STORAGE_RECENT_KEY) || '[]');
      return Array.isArray(recent) ? recent.map((item) => item && item.id).filter(Boolean) : [];
    } catch (error) {
      console.warn('[PWACachePrewarmer] Could not read recent game history:', error);
      return [];
    }
  }

  function prioritizedGames() {
    const registry = getRegistry();
    const byId = new Map(registry.filter((game) => game && game.id && game.path).map((game) => [game.id, game]));
    const favorites = window.ArcadeFavorites && typeof window.ArcadeFavorites.getFavorites === 'function'
      ? window.ArcadeFavorites.getFavorites()
      : [];
    const orderedIds = [...favorites, ...readRecentIds()];
    const featured = registry
      .filter((game) => game && game.featured && game.id && game.path)
      .sort((a, b) => (Number(b.stars) || 0) - (Number(a.stars) || 0))
      .map((game) => game.id);
    orderedIds.push(...featured);

    const seen = new Set();
    return orderedIds
      .map((id) => byId.get(id))
      .filter((game) => {
        if (!game || seen.has(game.id)) return false;
        seen.add(game.id);
        return true;
      })
      .slice(0, MAX_AUTO_GAMES);
  }

  function localAssetUrl(value, baseUrl) {
    if (!value || /^(data:|blob:|javascript:|mailto:|tel:|#)/i.test(value.trim())) return null;
    try {
      const url = new URL(value, baseUrl);
      if (url.origin !== window.location.origin || !/^https?:$/.test(url.protocol)) return null;
      url.hash = '';
      return url.href;
    } catch (_) {
      return null;
    }
  }

  function extractCssAssets(cssText, cssUrl) {
    const found = [];
    const expression = /(?:url\(\s*(['"]?)(.*?)\1\s*\)|@import\s+(['"])(.*?)\3)/gi;
    let match;
    while ((match = expression.exec(cssText))) {
      const value = match[2] || match[4];
      const assetUrl = localAssetUrl(value, cssUrl);
      if (assetUrl) found.push(assetUrl);
    }
    return found;
  }

  function extractScriptAssets(scriptText, scriptUrl) {
    const found = [];
    const expression = /["'`]((?:\.{1,2}\/|\/)?[^"'`\s]+?\.(?:png|jpe?g|webp|gif|svg|mp3|wav|ogg|m4a|mp4|webm|json|css|js|woff2?)(?:\?[^"'`\s]*)?)["'`]/gi;
    let match;
    while ((match = expression.exec(scriptText))) {
      const assetUrl = localAssetUrl(match[1], scriptUrl);
      if (assetUrl) found.push(assetUrl);
    }
    return found;
  }

  async function discoverAssets(entryUrl, signal) {
    const entryResponse = await fetch(entryUrl, { signal });
    if (!entryResponse.ok) throw new Error(`Could not download game entry point (${entryResponse.status}).`);

    const html = await entryResponse.clone().text();
    const documentParser = new DOMParser();
    const parsed = documentParser.parseFromString(html, 'text/html');
    const urls = new Set([entryUrl]);
    const cssUrls = [];
    const scriptUrls = [];
    const responses = new Map([[entryUrl, entryResponse]]);

    parsed.querySelectorAll('[src], [href], [poster], source[srcset], img[srcset]').forEach((element) => {
      const attributes = ['src', 'href', 'poster', 'srcset'];
      attributes.forEach((attribute) => {
        const value = element.getAttribute(attribute);
        if (!value) return;
        const candidates = attribute === 'srcset'
          ? value.split(',').map((candidate) => candidate.trim().split(/\s+/)[0])
          : [value];
        candidates.forEach((candidate) => {
          const assetUrl = localAssetUrl(candidate, entryUrl);
          if (!assetUrl) return;
          urls.add(assetUrl);
          if (element.tagName === 'LINK' && element.rel === 'stylesheet' && !cssUrls.includes(assetUrl)) {
            cssUrls.push(assetUrl);
          }
          if (element.tagName === 'SCRIPT' && !scriptUrls.includes(assetUrl)) {
            scriptUrls.push(assetUrl);
          }
        });
      });
    });

    parsed.querySelectorAll('style').forEach((style) => {
      extractCssAssets(style.textContent || '', entryUrl).forEach((assetUrl) => urls.add(assetUrl));
    });

    const metadataUrl = new URL('game.json', entryUrl).href;
    urls.add(metadataUrl);
    const metadataResponse = await fetch(metadataUrl, { signal });
    if (!metadataResponse.ok) throw new Error(`Could not download game metadata (${metadataResponse.status}).`);
    responses.set(metadataUrl, metadataResponse);

    for (let index = 0; index < scriptUrls.length && urls.size < MAX_ASSETS_PER_GAME; index += 1) {
      const scriptResponse = await fetch(scriptUrls[index], { signal });
      if (!scriptResponse.ok) throw new Error(`Could not download a game script (${scriptResponse.status}).`);
      responses.set(scriptUrls[index], scriptResponse);
      extractScriptAssets(await scriptResponse.clone().text(), scriptUrls[index]).forEach((assetUrl) => {
        urls.add(assetUrl);
        if (new URL(assetUrl).pathname.toLowerCase().endsWith('.js') && !scriptUrls.includes(assetUrl)) {
          scriptUrls.push(assetUrl);
        }
        if (new URL(assetUrl).pathname.toLowerCase().endsWith('.css') && !cssUrls.includes(assetUrl)) {
          cssUrls.push(assetUrl);
        }
      });
    }

    for (let index = 0; index < cssUrls.length && urls.size < MAX_ASSETS_PER_GAME; index += 1) {
      const cssResponse = await fetch(cssUrls[index], { signal });
      if (!cssResponse.ok) throw new Error(`Could not download a game stylesheet (${cssResponse.status}).`);
      responses.set(cssUrls[index], cssResponse);
      extractCssAssets(await cssResponse.clone().text(), cssUrls[index]).forEach((assetUrl) => {
        urls.add(assetUrl);
        if (new URL(assetUrl).pathname.toLowerCase().endsWith('.css') && !cssUrls.includes(assetUrl)) {
          cssUrls.push(assetUrl);
        }
      });
    }

    return { responses, urls: Array.from(urls).slice(0, MAX_ASSETS_PER_GAME) };
  }

  async function cacheGame(game, cache, signal) {
    const entryUrl = localAssetUrl(game.path, window.location.href);
    if (!entryUrl) throw new Error(`The game entry point for ${game.title} is not a same-origin URL.`);

    const { responses, urls } = await discoverAssets(entryUrl, signal);
    for (const assetUrl of urls) {
      if (signal.aborted) throw new DOMException('Cache preparation paused.', 'AbortError');
      if (assetUrl === entryUrl) continue;
      if (await cache.match(assetUrl)) continue;
      const response = responses.get(assetUrl) || await fetch(assetUrl, { signal });
      if (!response.ok) throw new Error(`Could not download a game asset (${response.status}): ${new URL(assetUrl).pathname}`);
      await cache.put(assetUrl, response);
    }
    await cache.put(entryUrl, responses.get(entryUrl));
  }

  function scheduleIdle(callback) {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(callback, { timeout: 2000 });
    } else {
      window.setTimeout(() => callback({ timeRemaining: () => 0, didTimeout: true }), 1200);
    }
  }

  async function runNext() {
    if (running || !gameQueue.length) {
      if (!gameQueue.length) setStatus('All prioritized games are ready for offline play.');
      return;
    }
    if (!canRun()) {
      setStatus(pausedForGameplay
        ? 'Downloads paused while a game is open.'
        : 'Downloads paused until an unmetered connection is available.');
      return;
    }

    running = true;
    currentGame = gameQueue.shift();
    activeController = new AbortController();
    let gameReady = false;
    setStatus(`Preparing ${currentGame.title} for offline play...`);
    try {
      const cache = await getCache();
      const entryUrl = localAssetUrl(currentGame.path, window.location.href);
      if (entryUrl && await cache.match(entryUrl, { ignoreSearch: true })) {
        gameReady = true;
        setStatus(`${currentGame.title} is already ready for offline play.`);
      } else {
        await cacheGame(currentGame, cache, activeController.signal);
        gameReady = true;
        setStatus(`${currentGame.title} is ready for offline play.`);
        await updateStorageEstimate();
      }
      await refreshBadges();
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.warn(`[PWACachePrewarmer] Could not cache ${currentGame.title}:`, error);
        setStatus(`Could not cache ${currentGame.title}. ${error.message}`);
      } else if (!gameQueue.some((game) => game.id === currentGame.id)) {
        gameQueue.unshift(currentGame);
      }
    } finally {
      activeController = null;
      currentGame = null;
      running = false;
      if (gameReady) completedGames += 1;
      setProgress(completedGames, totalGames);
      if (gameQueue.length && canRun()) {
        scheduleIdle(() => runNext());
      }
    }
  }

  function start(gameList) {
    if (running) {
      gameQueue = gameList.filter((game) => !currentGame || game.id !== currentGame.id);
      totalGames = gameQueue.length + 1;
      completedGames = 0;
      return;
    }
    gameQueue = gameList.slice();
    totalGames = gameQueue.length;
    completedGames = 0;
    setProgress(completedGames, totalGames);
    if (gameQueue.length === 0) {
      setStatus('No eligible games are available to prepare.');
      return;
    }
    if (!canRun()) {
      setStatus(pausedForGameplay
        ? 'Downloads paused while a game is open.'
        : 'Downloads paused until an unmetered connection is available.');
      return;
    }
    setStatus(`Preparing ${gameQueue.length} prioritized games for offline play...`);
    scheduleIdle(() => runNext());
  }

  async function refreshBadges() {
    const grid = document.getElementById('games-grid');
    if (!grid || !('caches' in window)) return;
    const cards = grid.querySelectorAll('.game-card[data-game-id]');
    if (!cards.length) return;

    try {
      const cache = await getCache();
      await Promise.all(Array.from(cards, async (card) => {
        const game = getRegistry().find((item) => item.id === card.dataset.gameId);
        const preview = card.querySelector('.game-card-preview');
        if (!game || !preview) return;
        const entryUrl = localAssetUrl(game.path, window.location.href);
        if (!entryUrl) return;
        const badge = preview.querySelector('.badge-offline-ready');
        if (await cache.match(entryUrl, { ignoreSearch: true })) {
          if (!badge) {
            const readyBadge = document.createElement('span');
            readyBadge.className = 'badge-offline-ready';
            readyBadge.title = 'Cached and ready for offline play';
            readyBadge.setAttribute('aria-label', 'Offline Ready');
            readyBadge.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg><span>Offline Ready</span>';
            preview.appendChild(readyBadge);
          }
        } else if (badge) {
          badge.remove();
        }
      }));
    } catch (error) {
      console.warn('[PWACachePrewarmer] Could not inspect cached game entries:', error);
    }
  }

  async function updateStorageEstimate() {
    if (!ui.usage || !navigator.storage || typeof navigator.storage.estimate !== 'function') return;
    try {
      const estimate = await navigator.storage.estimate();
      const usage = Number(estimate.usage) || 0;
      const quota = Number(estimate.quota) || 0;
      const percent = quota ? Math.min(100, Math.round((usage / quota) * 100)) : 0;
      ui.usage.value = percent;
      ui.usageLabel.textContent = quota
        ? `${formatBytes(usage)} used of ${formatBytes(quota)} available (${percent}%)`
        : 'Storage quota is unavailable.';
    } catch (error) {
      console.warn('[PWACachePrewarmer] Could not estimate storage usage:', error);
      ui.usageLabel.textContent = 'Storage usage could not be checked.';
    }
  }

  function formatBytes(bytes) {
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function clearCache() {
    if (!window.confirm('Clear downloaded offline game assets?')) return;
    try {
      if ('caches' in window) await caches.delete(CACHE_NAME);
      await refreshBadges();
      await updateStorageEstimate();
      setStatus('Offline game cache cleared.');
    } catch (error) {
      console.error('[PWACachePrewarmer] Could not clear the offline game cache:', error);
      setStatus(`Could not clear offline game cache. ${error.message}`);
    }
  }

  function handleNetworkChange() {
    if (!canRun()) {
      if (activeController) activeController.abort();
      if (!pausedForGameplay) {
        setStatus('Downloads paused until an unmetered connection is available.');
      }
      return;
    }
    if (gameQueue.length) scheduleIdle(() => runNext());
    else if (totalGames > 0 && completedGames >= totalGames) {
      setStatus('All prioritized games are ready for offline play.');
    }
  }

  window.addEventListener('arcadeverse:game-launched', () => {
    pausedForGameplay = true;
    if (activeController) activeController.abort();
    setStatus('Downloads paused while a game is open.');
  });
  window.addEventListener('arcadeverse:game-closed', () => {
    pausedForGameplay = false;
    handleNetworkChange();
  });
  window.addEventListener('arcadeverse:network-changed', handleNetworkChange);
  window.addEventListener('online', handleNetworkChange);
  window.addEventListener('offline', handleNetworkChange);
  if (connection && typeof connection.addEventListener === 'function') {
    connection.addEventListener('change', handleNetworkChange);
  }
  if (gameModal && typeof MutationObserver === 'function') {
    new MutationObserver(() => {
      const isActive = gameModal.classList.contains('active');
      if (isActive && !pausedForGameplay) {
        pausedForGameplay = true;
        if (activeController) activeController.abort();
        setStatus('Downloads paused while a game is open.');
      } else if (!isActive && pausedForGameplay) {
        pausedForGameplay = false;
        handleNetworkChange();
      }
    }).observe(gameModal, { attributes: true, attributeFilter: ['class'] });
  }

  window.PWACachePrewarmer = {
    refreshBadges,
    startTopGames: () => start(prioritizedGames()),
    clearCache,
    updateStorageEstimate,
    isNetworkSuitable
  };

  if (ui.cacheButton) ui.cacheButton.addEventListener('click', () => start(prioritizedGames()));
  if (ui.clearButton) ui.clearButton.addEventListener('click', clearCache);

  const grid = document.getElementById('games-grid');
  if (grid && typeof MutationObserver === 'function') {
    new MutationObserver(() => refreshBadges()).observe(grid, { childList: true, subtree: true });
  }

  refreshBadges();
  updateStorageEstimate();
  if (ui.root && !automaticStartScheduled) {
    automaticStartScheduled = true;
    scheduleIdle(() => start(prioritizedGames()));
  }
})();
