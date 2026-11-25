/**
 * ArcadeVerse - Game Difficulty Rating Filter with Active Tag Pills and Counts
 * Architectural Implementation for Issue #1506
 *
 * - Classifies catalog games into Casual, Normal, Hard, or Insane tiers from
 *   game.difficulty metadata (with tag/description fallback).
 * - Renders interactive difficulty pill chips with color accents and live counts.
 * - Integrates cleanly with category, facet, and search filters in app.js.
 * - 100% Vanilla JS; zero external dependencies.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ArcadeDifficultyFilter = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DIFFICULTY_TIERS = [
    { id: 'all', label: 'All' },
    { id: 'casual', label: 'Casual' },
    { id: 'normal', label: 'Normal' },
    { id: 'hard', label: 'Hard' },
    { id: 'insane', label: 'Insane' }
  ];

  var activeDifficulty = 'all';

  /**
   * Classifies a game object into 'casual' | 'normal' | 'hard' | 'insane'.
   *
   * @param {Object} game
   * @returns {string}
   */
  function classifyDifficulty(game) {
    if (!game || typeof game !== 'object') return 'normal';

    var raw = String(game.difficulty || '').toLowerCase().trim();
    if (raw) {
      if (raw.includes('insane') || raw.includes('brutal') || raw.includes('extreme') || raw.includes('nightmare')) {
        return 'insane';
      }
      if (raw.includes('hard') || raw.includes('advanced') || raw.includes('expert')) {
        return 'hard';
      }
      if (raw.includes('casual') || raw.includes('easy') || raw.includes('beginner') || raw.includes('all skill')) {
        return 'casual';
      }
      if (raw.includes('normal') || raw.includes('medium') || raw.includes('intermediate')) {
        return 'normal';
      }
    }

    var text = (
      String(game.title || '') + ' ' +
      String(game.category || '') + ' ' +
      (Array.isArray(game.tags) ? game.tags.join(' ') : '') + ' ' +
      String(game.description || '')
    ).toLowerCase();

    if (text.includes('insane') || text.includes('brutal') || text.includes('bullet hell') || text.includes('roguelike') || text.includes('hardcore')) {
      return 'insane';
    }
    if (text.includes('hard') || text.includes('expert') || text.includes('survival') || text.includes('tactical')) {
      return 'hard';
    }
    if (text.includes('casual') || text.includes('easy') || text.includes('relaxing') || text.includes('clicker') || text.includes('simple')) {
      return 'casual';
    }
    return 'normal';
  }

  /**
   * Computes game counts for each difficulty tier.
   *
   * @param {Array<Object>} games
   * @returns {{ all: number, casual: number, normal: number, hard: number, insane: number }}
   */
  function computeTierCounts(games) {
    var counts = { all: 0, casual: 0, normal: 0, hard: 0, insane: 0 };
    if (!Array.isArray(games)) return counts;

    counts.all = games.length;
    for (var i = 0; i < games.length; i++) {
      var tier = classifyDifficulty(games[i]);
      if (typeof counts[tier] === 'number') {
        counts[tier] += 1;
      }
    }
    return counts;
  }

  /**
   * Checks if a game matches the specified (or currently active) difficulty tier.
   *
   * @param {Object} game
   * @param {string} [tierOverride]
   * @returns {boolean}
   */
  function matchesGame(game, tierOverride) {
    var target = tierOverride !== undefined ? tierOverride : activeDifficulty;
    if (!target || target === 'all') return true;
    return classifyDifficulty(game) === target;
  }

  /**
   * Filters a list of games by difficulty tier (and optional extra predicate).
   *
   * @param {Array<Object>} games
   * @param {string} [tierOverride]
   * @param {Function} [extraPredicate]
   * @returns {Array<Object>}
   */
  function filterGames(games, tierOverride, extraPredicate) {
    if (!Array.isArray(games)) return [];
    var target = tierOverride !== undefined ? tierOverride : activeDifficulty;
    return games.filter(function (game) {
      if (!matchesGame(game, target)) return false;
      if (typeof extraPredicate === 'function' && !extraPredicate(game)) return false;
      return true;
    });
  }

  function getActiveDifficulty() {
    return activeDifficulty;
  }

  function setActiveDifficulty(tier, silent) {
    var validIds = DIFFICULTY_TIERS.map(function (t) { return t.id; });
    activeDifficulty = validIds.indexOf(tier) !== -1 ? tier : 'all';
    updatePillUI();

    if (!silent && typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
      window.dispatchEvent(new CustomEvent('arcadeverse:difficulty-filter-changed', {
        detail: { difficulty: activeDifficulty }
      }));
    }
    return activeDifficulty;
  }

  function updatePillUI() {
    if (typeof document === 'undefined') return;
    var bar = document.getElementById('difficulty-filter-bar');
    if (!bar) return;

    var pills = bar.querySelectorAll('.difficulty-pill');
    for (var i = 0; i < pills.length; i++) {
      var pill = pills[i];
      var isActive = pill.getAttribute('data-difficulty') === activeDifficulty;
      pill.classList.toggle('active', isActive);
      pill.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    }
  }

  function renderFilterBar() {
    if (typeof document === 'undefined') return;
    if (document.getElementById('difficulty-filter-bar')) return;

    var anchor = document.getElementById('faceted-filter-bar') || document.getElementById('games-grid');
    if (!anchor || !anchor.parentNode) return;

    var catalog = typeof GAMES_REGISTRY !== 'undefined' && Array.isArray(GAMES_REGISTRY) ? GAMES_REGISTRY : [];
    var counts = computeTierCounts(catalog);

    var bar = document.createElement('div');
    bar.id = 'difficulty-filter-bar';
    bar.className = 'difficulty-filter-bar';
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', 'Filter games by difficulty rating');

    var label = document.createElement('span');
    label.className = 'difficulty-filter-label';
    label.innerHTML =
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
      '<path d="M12 20V10"></path><path d="M18 20V4"></path><path d="M6 20v-4"></path>' +
      '</svg>' +
      '<span>Difficulty:</span>';
    bar.appendChild(label);

    var group = document.createElement('div');
    group.className = 'difficulty-pills-group';

    for (var i = 0; i < DIFFICULTY_TIERS.length; i++) {
      var tier = DIFFICULTY_TIERS[i];
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'difficulty-pill' + (tier.id === activeDifficulty ? ' active' : '');
      btn.setAttribute('data-difficulty', tier.id);
      btn.setAttribute('aria-pressed', tier.id === activeDifficulty ? 'true' : 'false');

      var textSpan = document.createElement('span');
      textSpan.textContent = tier.label;

      var countSpan = document.createElement('span');
      countSpan.className = 'difficulty-count-badge';
      countSpan.textContent = String(counts[tier.id] || 0);

      btn.appendChild(textSpan);
      btn.appendChild(countSpan);

      (function (tierId) {
        btn.addEventListener('click', function () {
          setActiveDifficulty(tierId, false);
        });
      })(tier.id);

      group.appendChild(btn);
    }

    bar.appendChild(group);

    if (anchor.id === 'faceted-filter-bar') {
      anchor.appendChild(bar);
    } else {
      anchor.parentNode.insertBefore(bar, anchor);
    }
  }

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', renderFilterBar);
    } else {
      renderFilterBar();
    }
  }

  return {
    DIFFICULTY_TIERS: DIFFICULTY_TIERS,
    classifyDifficulty: classifyDifficulty,
    computeTierCounts: computeTierCounts,
    matchesGame: matchesGame,
    filterGames: filterGames,
    getActiveDifficulty: getActiveDifficulty,
    setActiveDifficulty: setActiveDifficulty,
    renderFilterBar: renderFilterBar
  };
});
