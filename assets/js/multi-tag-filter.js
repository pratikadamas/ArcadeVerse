/**
 * ArcadeVerse - Multi-Tag Filtering System with AND-OR Logic Toggle
 * Architectural Implementation for Issue #1495
 *
 * - Supports selecting multiple tags simultaneously with active chip highlights.
 * - Switches dynamically between AND ('all') and OR ('any') matching rules.
 * - Updates live matching result count badge and active tag summary.
 * - Integrates cleanly with app.js renderGames() and facet resets.
 * - 100% Vanilla JS; zero external frameworks.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ArcadeMultiTagFilter = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DEFAULT_MAX_TAGS = 12;

  var selectedTags = [];
  var logicMode = 'all'; // 'all' (AND) | 'any' (OR)

  function normalizeTag(tag) {
    return String(tag || '').trim().toLowerCase();
  }

  /**
   * Extracts top normalized tags from catalog registry sorted by frequency.
   *
   * @param {Array<Object>} games
   * @param {number} [maxTags=12]
   * @returns {Array<string>}
   */
  function extractAvailableTags(games, maxTags) {
    if (!Array.isArray(games)) return [];
    var counts = new Map();
    for (var i = 0; i < games.length; i++) {
      var g = games[i];
      if (!g || !Array.isArray(g.tags)) continue;
      for (var j = 0; j < g.tags.length; j++) {
        var t = normalizeTag(g.tags[j]);
        if (t && t !== 'nsoc26') {
          counts.set(t, (counts.get(t) || 0) + 1);
        }
      }
    }
    var limit = Math.max(1, Number(maxTags) || DEFAULT_MAX_TAGS);
    return Array.from(counts.entries())
      .sort(function (a, b) { return b[1] - a[1]; })
      .slice(0, limit)
      .map(function (entry) { return entry[0]; });
  }

  function getGameTagSet(game) {
    var set = new Set();
    if (!game || typeof game !== 'object') return set;
    if (Array.isArray(game.tags)) {
      for (var i = 0; i < game.tags.length; i++) {
        var t = normalizeTag(game.tags[i]);
        if (t) set.add(t);
      }
    }
    if (game.category) {
      set.add(normalizeTag(game.category));
    }
    return set;
  }

  /**
   * Checks whether a single game satisfies selectedTags under logicMode ('all' | 'any').
   *
   * @param {Object} game
   * @param {Array<string>} [tagsOverride]
   * @param {string} [modeOverride]
   * @returns {boolean}
   */
  function matchesGame(game, tagsOverride, modeOverride) {
    var tags = Array.isArray(tagsOverride) ? tagsOverride : selectedTags;
    if (!tags || tags.length === 0) return true;

    var mode = (modeOverride || logicMode) === 'any' ? 'any' : 'all';
    var gameTags = getGameTagSet(game);

    if (mode === 'all') {
      for (var i = 0; i < tags.length; i++) {
        if (!gameTags.has(normalizeTag(tags[i]))) return false;
      }
      return true;
    }

    for (var j = 0; j < tags.length; j++) {
      if (gameTags.has(normalizeTag(tags[j]))) return true;
    }
    return false;
  }

  /**
   * Filters an array of games by selectedTags and logicMode ('all' | 'any').
   *
   * @param {Array<Object>} games
   * @param {Array<string>} [tagsOverride]
   * @param {string} [modeOverride='all']
   * @returns {Array<Object>}
   */
  function filterGames(games, tagsOverride, modeOverride) {
    if (!Array.isArray(games)) return [];
    var tags = Array.isArray(tagsOverride) ? tagsOverride : selectedTags;
    var mode = modeOverride !== undefined ? modeOverride : logicMode;
    if (!tags || tags.length === 0) return games.slice();

    return games.filter(function (game) {
      return matchesGame(game, tags, mode);
    });
  }

  function notifyChange(silent) {
    updateUI();
    if (!silent && typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
      window.dispatchEvent(new CustomEvent('arcadeverse:multi-tag-changed', {
        detail: {
          selectedTags: selectedTags.slice(),
          logicMode: logicMode
        }
      }));
    }
  }

  function toggleTag(tag, silent) {
    var norm = normalizeTag(tag);
    if (!norm) return selectedTags.slice();
    var idx = selectedTags.indexOf(norm);
    if (idx === -1) {
      selectedTags.push(norm);
    } else {
      selectedTags.splice(idx, 1);
    }
    notifyChange(silent);
    return selectedTags.slice();
  }

  function removeTag(tag, silent) {
    var norm = normalizeTag(tag);
    selectedTags = selectedTags.filter(function (t) { return t !== norm; });
    notifyChange(silent);
    return selectedTags.slice();
  }

  function clearTags(silent) {
    selectedTags = [];
    notifyChange(silent);
    return [];
  }

  function setLogicMode(mode, silent) {
    logicMode = mode === 'any' ? 'any' : 'all';
    notifyChange(silent);
    return logicMode;
  }

  function updateUI() {
    if (typeof document === 'undefined') return;
    var bar = document.getElementById('multi-tag-filter-bar');
    if (!bar) return;

    var chips = bar.querySelectorAll('.mtf-tag-chip');
    for (var i = 0; i < chips.length; i++) {
      var tag = chips[i].getAttribute('data-tag');
      var active = selectedTags.indexOf(tag) !== -1;
      chips[i].classList.toggle('is-active', active);
      chips[i].setAttribute('aria-pressed', active ? 'true' : 'false');
    }

    var allBtn = document.getElementById('mtf-logic-all');
    var anyBtn = document.getElementById('mtf-logic-any');
    if (allBtn) {
      allBtn.classList.toggle('is-active', logicMode === 'all');
      allBtn.setAttribute('aria-pressed', logicMode === 'all' ? 'true' : 'false');
    }
    if (anyBtn) {
      anyBtn.classList.toggle('is-active', logicMode === 'any');
      anyBtn.setAttribute('aria-pressed', logicMode === 'any' ? 'true' : 'false');
    }

    var clearBtn = document.getElementById('mtf-clear-btn');
    if (clearBtn) {
      clearBtn.hidden = selectedTags.length === 0;
    }

    var badge = document.getElementById('mtf-result-badge');
    if (badge) {
      var reg = typeof GAMES_REGISTRY !== 'undefined' && Array.isArray(GAMES_REGISTRY) ? GAMES_REGISTRY : [];
      var matchCount = filterGames(reg, selectedTags, logicMode).length;
      if (selectedTags.length === 0) {
        badge.textContent = '0 tags active';
      } else {
        badge.textContent = selectedTags.length + ' tags (' + matchCount + ' matches)';
      }
    }
  }

  function renderUI() {
    if (typeof document === 'undefined') return;
    if (document.getElementById('multi-tag-filter-bar')) return;

    var anchor = document.getElementById('tag-filter-bar');
    if (!anchor || !anchor.parentNode) return;

    var reg = typeof GAMES_REGISTRY !== 'undefined' && Array.isArray(GAMES_REGISTRY) ? GAMES_REGISTRY : [];
    var tags = extractAvailableTags(reg, DEFAULT_MAX_TAGS);
    if (tags.length === 0) {
      tags = ['arcade', 'retro', 'puzzle', 'action', 'strategy', 'multiplayer'];
    }

    var bar = document.createElement('div');
    bar.id = 'multi-tag-filter-bar';
    bar.className = 'multi-tag-filter-bar';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Multi-tag filter with AND/OR logic');

    var chipsHtml = tags.map(function (t) {
      return '<button type="button" class="mtf-tag-chip" data-tag="' + t + '" aria-pressed="false"><span>#' + t + '</span><span class="mtf-chip-remove" aria-hidden="true">x</span></button>';
    }).join('');

    bar.innerHTML =
      '<div class="mtf-header-row">' +
      '  <div class="mtf-title-group">' +
      '    <span class="mtf-label">Multi-Tag Filter</span>' +
      '    <span class="mtf-result-badge" id="mtf-result-badge">0 tags active</span>' +
      '  </div>' +
      '  <div class="mtf-controls-group">' +
      '    <div class="mtf-logic-toggle" role="group" aria-label="Tag matching logic">' +
      '      <button type="button" class="mtf-logic-btn is-active" id="mtf-logic-all" aria-pressed="true">Match ALL (AND)</button>' +
      '      <button type="button" class="mtf-logic-btn" id="mtf-logic-any" aria-pressed="false">Match ANY (OR)</button>' +
      '    </div>' +
      '    <button type="button" class="mtf-clear-btn" id="mtf-clear-btn" hidden>Clear Tags</button>' +
      '  </div>' +
      '</div>' +
      '<div class="mtf-chips-row">' + chipsHtml + '</div>';

    anchor.parentNode.insertBefore(bar, anchor.nextSibling);

    bar.querySelectorAll('.mtf-tag-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        toggleTag(chip.getAttribute('data-tag'));
      });
    });

    document.getElementById('mtf-logic-all').addEventListener('click', function () {
      setLogicMode('all');
    });
    document.getElementById('mtf-logic-any').addEventListener('click', function () {
      setLogicMode('any');
    });
    document.getElementById('mtf-clear-btn').addEventListener('click', function () {
      clearTags();
    });

    updateUI();
  }

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', renderUI);
    } else {
      renderUI();
    }
  }

  return {
    extractAvailableTags: extractAvailableTags,
    matchesGame: matchesGame,
    filterGames: filterGames,
    toggleTag: toggleTag,
    removeTag: removeTag,
    clearTags: clearTags,
    setLogicMode: setLogicMode,
    getState: function () {
      return {
        selectedTags: selectedTags.slice(),
        logicMode: logicMode
      };
    },
    renderUI: renderUI
  };
});
