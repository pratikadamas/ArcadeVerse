/**
 * ArcadeVerse - Game Card Play-Count Milestone Badges & Unlock Animations
 * Architectural Implementation for Issue #1494
 *
 * - Persists per-game play counts under localStorage key: arcadeverse_game_plays_<gameId>.
 * - Assigns milestone tiers:
 *   - Rookie (1+ plays)
 *   - Veteran (10+ plays)
 *   - Master (25+ plays)
 *   - Century (100+ plays)
 * - Dynamically injects neon milestone badges onto catalog .game-card elements
 *   without blocking render.
 * - Dispatches CustomEvent('arcadeverse:milestone-unlocked') and renders a celebratory toast
 *   with card shimmer animation when a higher tier is reached.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ArcadePlayMilestones = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var STORAGE_PREFIX = 'arcadeverse_game_plays_';

  var MILESTONE_TIERS = [
    { id: 'century', label: 'Century', minPlays: 100 },
    { id: 'master', label: 'Master', minPlays: 25 },
    { id: 'veteran', label: 'Veteran', minPlays: 10 },
    { id: 'rookie', label: 'Rookie', minPlays: 1 }
  ];

  var TIER_CLASSES = [
    'milestone-rookie',
    'milestone-veteran',
    'milestone-master',
    'milestone-century'
  ];

  function getStorageKey(gameId) {
    return STORAGE_PREFIX + String(gameId || '').trim();
  }

  /**
   * Reads the persisted play count for a game ID from localStorage.
   *
   * @param {string} gameId
   * @returns {number}
   */
  function getPlayCount(gameId) {
    if (!gameId) return 0;
    try {
      if (typeof localStorage !== 'undefined') {
        var raw = localStorage.getItem(getStorageKey(gameId));
        var parsed = parseInt(raw, 10);
        return (!isNaN(parsed) && parsed > 0) ? parsed : 0;
      }
    } catch (_) {}
    return 0;
  }

  /**
   * Resolves the milestone tier for a given play count.
   *
   * @param {number} count
   * @returns {{ id: string, label: string, minPlays: number }|null}
   */
  function getMilestoneForCount(count) {
    var n = Number(count) || 0;
    if (n < 1) return null;
    for (var i = 0; i < MILESTONE_TIERS.length; i++) {
      if (n >= MILESTONE_TIERS[i].minPlays) {
        return MILESTONE_TIERS[i];
      }
    }
    return null;
  }

  /**
   * Sets a game's play count in localStorage and returns the updated count.
   *
   * @param {string} gameId
   * @param {number} count
   * @returns {number}
   */
  function setPlayCount(gameId, count) {
    if (!gameId) return 0;
    var safeCount = Math.max(0, Math.floor(Number(count) || 0));
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(getStorageKey(gameId), String(safeCount));
      }
    } catch (_) {}
    return safeCount;
  }

  /**
   * Increments play count for a game, checks for milestone tier unlock,
   * updates DOM badge, triggers shimmer + celebratory toast, and dispatches event.
   *
   * @param {string} gameId
   * @param {string} [gameTitle]
   * @returns {{ gameId: string, count: number, tier: Object|null, unlocked: boolean }}
   */
  function incrementPlayCount(gameId, gameTitle) {
    if (!gameId) return { gameId: '', count: 0, tier: null, unlocked: false };

    var prevCount = getPlayCount(gameId);
    var prevTier = getMilestoneForCount(prevCount);
    var nextCount = setPlayCount(gameId, prevCount + 1);
    var nextTier = getMilestoneForCount(nextCount);

    var unlocked = Boolean(nextTier && (!prevTier || prevTier.id !== nextTier.id));

    if (typeof document !== 'undefined') {
      var card = document.querySelector('.game-card[data-game-id="' + gameId + '"]') ||
                 document.querySelector('.game-card[data-id="' + gameId + '"]');
      if (card) {
        injectBadgeIntoCard(card, unlocked);
      }
    }

    if (unlocked) {
      if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
        window.dispatchEvent(new CustomEvent('arcadeverse:milestone-unlocked', {
          detail: {
            gameId: gameId,
            gameTitle: gameTitle || gameId,
            count: nextCount,
            tier: nextTier,
            previousTier: prevTier
          }
        }));
      }
      showUnlockToast(gameTitle || gameId, nextTier, nextCount);
    }

    return {
      gameId: gameId,
      count: nextCount,
      tier: nextTier,
      unlocked: unlocked
    };
  }

  /**
   * Injects or updates the milestone badge inside a .game-card DOM element.
   *
   * @param {Element} cardEl
   * @param {boolean} [animateUnlock=false]
   * @returns {Object|null} Applied milestone tier or null
   */
  function injectBadgeIntoCard(cardEl, animateUnlock) {
    if (!cardEl || typeof cardEl.getAttribute !== 'function') return null;

    var gameId = cardEl.getAttribute('data-game-id') || cardEl.getAttribute('data-id');
    if (!gameId) return null;

    var count = getPlayCount(gameId);
    var tier = getMilestoneForCount(count);

    for (var i = 0; i < TIER_CLASSES.length; i++) {
      if (cardEl.classList && typeof cardEl.classList.remove === 'function') {
        cardEl.classList.remove(TIER_CLASSES[i]);
      }
    }

    var existingBadge = typeof cardEl.querySelector === 'function'
      ? cardEl.querySelector('.play-milestone-badge')
      : null;

    if (!tier) {
      if (existingBadge && typeof existingBadge.remove === 'function') {
        existingBadge.remove();
      }
      return null;
    }

    if (cardEl.classList && typeof cardEl.classList.add === 'function') {
      cardEl.classList.add('milestone-' + tier.id);
      if (animateUnlock) {
        cardEl.classList.remove('is-milestone-unlocked');
        if (typeof cardEl.offsetWidth === 'number') {
          void cardEl.offsetWidth;
        }
        cardEl.classList.add('is-milestone-unlocked');
        setTimeout(function () {
          cardEl.classList.remove('is-milestone-unlocked');
        }, 1000);
      }
    }

    if (typeof document !== 'undefined') {
      var badge = existingBadge;
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'play-milestone-badge';
        cardEl.appendChild(badge);
      }
      badge.className = 'play-milestone-badge tier-' + tier.id;
      badge.setAttribute('title', tier.label + ' Milestone (' + count + ' plays)');
      badge.setAttribute('aria-label', tier.label + ' milestone, ' + count + ' plays');
      badge.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>' +
        '</svg>' +
        '<span>' + tier.label + ' (' + count + ')</span>';
    }

    return tier;
  }

  function showUnlockToast(gameTitle, tier, count) {
    if (typeof document === 'undefined' || !document.body || !tier) return;

    var prevToast = document.getElementById('milestone-unlock-toast');
    if (prevToast) prevToast.remove();

    var toast = document.createElement('div');
    toast.id = 'milestone-unlock-toast';
    toast.className = 'milestone-unlock-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');

    var iconWrap = document.createElement('div');
    iconWrap.className = 'milestone-toast-icon';
    iconWrap.innerHTML =
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">' +
      '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>' +
      '<path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>' +
      '<path d="M4 22h16"></path>' +
      '<path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path>' +
      '<path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path>' +
      '<path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path>' +
      '</svg>';

    var body = document.createElement('div');
    body.className = 'milestone-toast-body';

    var titleEl = document.createElement('span');
    titleEl.className = 'milestone-toast-title';
    titleEl.textContent = tier.label + ' Milestone Unlocked';

    var subEl = document.createElement('span');
    subEl.className = 'milestone-toast-sub';
    subEl.textContent = gameTitle + ' - ' + count + ' plays';

    body.appendChild(titleEl);
    body.appendChild(subEl);
    toast.appendChild(iconWrap);
    toast.appendChild(body);
    document.body.appendChild(toast);

    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(function () {
        toast.classList.add('is-visible');
      });
    } else {
      toast.classList.add('is-visible');
    }

    setTimeout(function () {
      toast.classList.remove('is-visible');
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 260);
    }, 3200);
  }

  /**
   * Scans all .game-card elements in root (or document) and injects milestone badges.
   *
   * @param {Element|Document} [root]
   */
  function refreshAllCards(root) {
    var scope = root || (typeof document !== 'undefined' ? document : null);
    if (!scope || typeof scope.querySelectorAll !== 'function') return;

    var cards = scope.querySelectorAll('.game-card');
    for (var i = 0; i < cards.length; i++) {
      injectBadgeIntoCard(cards[i], false);
    }
  }

  function init() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    refreshAllCards(document);

    window.addEventListener('arcadeverse:game-launched', function (e) {
      if (e && e.detail && e.detail.id) {
        incrementPlayCount(e.detail.id, e.detail.title);
      }
    });

    var grid = document.getElementById('games-grid');
    if (grid && typeof MutationObserver === 'function') {
      var scheduled = false;
      var observer = new MutationObserver(function () {
        if (scheduled) return;
        scheduled = true;
        var run = function () {
          scheduled = false;
          refreshAllCards(grid);
        };
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(run);
        } else {
          setTimeout(run, 16);
        }
      });
      observer.observe(grid, { childList: true, subtree: true });
    }
  }

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  return {
    STORAGE_PREFIX: STORAGE_PREFIX,
    MILESTONE_TIERS: MILESTONE_TIERS,
    getStorageKey: getStorageKey,
    getPlayCount: getPlayCount,
    setPlayCount: setPlayCount,
    getMilestoneForCount: getMilestoneForCount,
    incrementPlayCount: incrementPlayCount,
    injectBadgeIntoCard: injectBadgeIntoCard,
    refreshAllCards: refreshAllCards,
    init: init
  };
});

