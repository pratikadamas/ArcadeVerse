/**
 * ArcadeVerse - Recently Played Games Quick Bar in Catalog Header (#1504)
 * Tracks last 5 launched games in localStorage ('arcadeverse_recent_games')
 * with deduplication, FIFO capping, and one-click resume pills.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ArcadeRecent = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var STORAGE_KEY = 'arcadeverse_recent_games';
  var LEGACY_KEY = 'arcadeverse_recently_played_v2';
  var MAX_HISTORY = 5;

  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeAttr(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  var clearConfirmTimer = null;

  var ArcadeRecent = {
    STORAGE_KEY: STORAGE_KEY,
    MAX_HISTORY: MAX_HISTORY,

    getRecent: function () {
      try {
        if (typeof localStorage === 'undefined') return [];
        var raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_KEY);
        var parsed = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(parsed)) return [];

        return parsed
          .filter(function (item) {
            return item && typeof item === 'object' && typeof item.id === 'string' && item.id.trim().length > 0;
          })
          .slice(0, MAX_HISTORY);
      } catch (_) {
        return [];
      }
    },

    saveRecent: function (list) {
      var capped = Array.isArray(list) ? list.slice(0, MAX_HISTORY) : [];
      var payload = JSON.stringify(capped);
      if (typeof window !== 'undefined' && window.ArcadeStorageResilience && typeof window.ArcadeStorageResilience.safeSetItem === 'function') {
        window.ArcadeStorageResilience.safeSetItem(STORAGE_KEY, payload);
      } else {
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(STORAGE_KEY, payload);
          }
        } catch (e) {
          console.warn('Could not save recently played history:', e);
        }
      }
      return capped;
    },

    recordPlayed: function (gameId, title, category) {
      if (!gameId) return [];
      var history = this.getRecent();

      // Deduplicate: remove existing entry for this game
      history = history.filter(function (item) {
        return item.id !== gameId;
      });

      // Prepend to top (FIFO/LRU capped at MAX_HISTORY = 5)
      history.unshift({
        id: gameId,
        title: title || gameId,
        category: category || 'Arcade',
        timestamp: Date.now()
      });

      var saved = this.saveRecent(history);
      this.render();
      return saved;
    },

    clear: function () {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem(LEGACY_KEY);
        }
      } catch (_) {}
      this.render();
    },

    formatTimeAgo: function (timestamp) {
      if (!timestamp) return 'Recent';
      var diffSec = Math.floor((Date.now() - timestamp) / 1000);
      if (diffSec < 60) return 'Just now';
      var diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return diffMin + 'm ago';
      var diffHour = Math.floor(diffMin / 60);
      if (diffHour < 24) return diffHour + 'h ago';
      var diffDays = Math.floor(diffHour / 24);
      return diffDays + 'd ago';
    },

    render: function () {
      if (typeof document === 'undefined') return;
      var mount = document.getElementById('recently-played-mount');
      if (!mount) return;

      var items = this.getRecent();

      if (items.length === 0) {
        mount.innerHTML = '';
        mount.style.display = 'none';
        return;
      }

      var self = this;
      mount.style.display = 'block';
      mount.innerHTML =
        '<section class="recently-played-section" aria-label="Recently Played Games">' +
        '  <div class="recently-played-container">' +
        '    <div class="recently-played-header">' +
        '      <div class="recent-header-left">' +
        '        <span class="recent-pulse-icon" aria-hidden="true">' +
        '          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
        '            <circle cx="12" cy="12" r="10"></circle>' +
        '            <polyline points="12 6 12 12 16 14"></polyline>' +
        '          </svg>' +
        '        </span>' +
        '        <h2 class="recently-played-title">' +
        '          Recently Played <span class="recent-badge-count">' + items.length + '</span>' +
        '        </h2>' +
        '      </div>' +
        '      <div class="recent-header-actions">' +
        '        <button type="button" class="btn-clear-recent" id="btn-clear-recent-history" title="Clear Recently Played History">' +
        '          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '            <path d="M3 6h18"></path>' +
        '            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>' +
        '            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>' +
        '          </svg>' +
        '          <span id="btn-clear-recent-label">Clear History</span>' +
        '        </button>' +
        '        <span class="recent-clear-tooltip" id="recent-clear-tooltip" hidden>Click again to confirm</span>' +
        '      </div>' +
        '    </div>' +
        '    <div class="recently-played-pill-bar" role="list">' +
        items.map(function (item) {
          var resolvedTitle = item.title;
          var resolvedCategory = item.category;
          if (typeof GAMES_REGISTRY !== 'undefined' && Array.isArray(GAMES_REGISTRY)) {
            var regMatch = GAMES_REGISTRY.find(function (g) { return g && g.id === item.id; });
            if (regMatch) {
              resolvedTitle = regMatch.title || resolvedTitle;
              resolvedCategory = regMatch.category || resolvedCategory;
            }
          }
          var safeId = escapeAttr(item.id);
          var safeTitle = escapeHTML(resolvedTitle);
          var initial = escapeHTML((resolvedTitle || 'A').trim().charAt(0).toUpperCase());

          return (
            '<button type="button" class="recent-pill-btn btn-recent-play" role="listitem" data-game-id="' + safeId + '" title="' + safeTitle + ' (' + escapeAttr(resolvedCategory) + ')" aria-label="Play ' + safeTitle + '">' +
            '  <span class="recent-pill-thumb" aria-hidden="true">' + initial + '</span>' +
            '  <span class="recent-pill-title">' + safeTitle + '</span>' +
            '  <span class="recent-pill-play-icon" aria-hidden="true">' +
            '    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>' +
            '  </span>' +
            '</button>'
          );
        }).join('') +
        '    </div>' +
        '  </div>' +
        '</section>';

      var clearBtn = mount.querySelector('#btn-clear-recent-history');
      var clearLabel = mount.querySelector('#btn-clear-recent-label');
      var tooltip = mount.querySelector('#recent-clear-tooltip');
      if (clearBtn) {
        clearBtn.addEventListener('click', function () {
          if (!clearBtn.classList.contains('is-confirming')) {
            clearBtn.classList.add('is-confirming');
            if (clearLabel) clearLabel.textContent = 'Confirm Clear';
            if (tooltip) tooltip.hidden = false;
            if (clearConfirmTimer) clearTimeout(clearConfirmTimer);
            clearConfirmTimer = setTimeout(function () {
              clearBtn.classList.remove('is-confirming');
              if (clearLabel) clearLabel.textContent = 'Clear History';
              if (tooltip) tooltip.hidden = true;
            }, 3000);
          } else {
            if (clearConfirmTimer) clearTimeout(clearConfirmTimer);
            self.clear();
          }
        });
      }

      mount.querySelectorAll('.btn-recent-play').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var gameId = btn.getAttribute('data-game-id');
          if (window.ArcadeApp && typeof window.ArcadeApp.openGame === 'function') {
            window.ArcadeApp.openGame(gameId);
          } else if (typeof window.openGameModal === 'function' && typeof GAMES_REGISTRY !== 'undefined') {
            var found = GAMES_REGISTRY.find(function (g) { return g.id === gameId; });
            if (found) window.openGameModal(found, btn);
          }
        });
      });
    }
  };

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    window.ArcadeRecent = ArcadeRecent;
    document.addEventListener('DOMContentLoaded', function () {
      ArcadeRecent.render();
    });
  }

  return ArcadeRecent;
});
