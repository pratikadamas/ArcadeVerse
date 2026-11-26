/**
 * ArcadeVerse - Game Search Autocomplete Suggestion Dropdown with Keyboard Navigation
 * Architectural Implementation for Issue #1500
 *
 * - Indexes game titles, categories, and tags from GAMES_REGISTRY.
 * - Displays top 5 relevant suggestions after >= 2 characters typed.
 * - Highlights matched substrings safely (XSS-escaped).
 * - Supports ArrowDown / ArrowUp cycling, Enter selection, Escape close,
 *   and outside-click dismissal.
 * - 100% Vanilla JS; zero external frameworks.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ArcadeSearchAutocomplete = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MIN_QUERY_LENGTH = 2;
  var MAX_SUGGESTIONS = 5;

  var indexedGames = [];
  var currentSuggestions = [];
  var selectedIndex = -1;
  var isOpen = false;

  function escapeHTML(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Builds a lightweight searchable index from catalog registry entries.
   *
   * @param {Array<Object>} registry
   * @returns {Array<Object>}
   */
  function buildIndex(registry) {
    if (!Array.isArray(registry)) return [];
    indexedGames = registry
      .filter(function (g) { return g && g.id && g.title; })
      .map(function (g) {
        return {
          id: g.id,
          title: String(g.title),
          titleLower: String(g.title).toLowerCase(),
          category: String(g.category || 'Arcade'),
          categoryLower: String(g.category || 'Arcade').toLowerCase(),
          tagsLower: Array.isArray(g.tags) ? g.tags.map(function (t) { return String(t).toLowerCase(); }) : []
        };
      });
    return indexedGames;
  }

  /**
   * Queries top matching suggestions ranked by prefix > title substring > category/tag.
   *
   * @param {string} query
   * @param {Array<Object>} [indexOverride]
   * @param {number} [limit=5]
   * @returns {Array<Object>}
   */
  function querySuggestions(query, indexOverride, limit) {
    var q = String(query || '').trim().toLowerCase();
    if (q.length < MIN_QUERY_LENGTH) return [];

    var pool = Array.isArray(indexOverride) ? indexOverride : indexedGames;
    var maxItems = Math.max(1, Number(limit) || MAX_SUGGESTIONS);
    var scored = [];

    for (var i = 0; i < pool.length; i++) {
      var item = pool[i];
      var score = 0;
      if (item.titleLower.indexOf(q) === 0) {
        score = 3; // Prefix match on title
      } else if (item.titleLower.indexOf(q) !== -1) {
        score = 2; // Substring match on title
      } else if (item.categoryLower.indexOf(q) !== -1 || item.tagsLower.some(function (t) { return t.indexOf(q) !== -1; })) {
        score = 1; // Category or tag match
      }
      if (score > 0) {
        scored.push({ item: item, score: score });
      }
    }

    scored.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return a.item.title.localeCompare(b.item.title);
    });

    return scored.slice(0, maxItems).map(function (entry) { return entry.item; });
  }

  /**
   * Wraps matched substring in <strong class="search-ac-match"> safely.
   *
   * @param {string} text
   * @param {string} query
   * @returns {string}
   */
  function highlightMatchHtml(text, query) {
    var safeText = String(text || '');
    var q = String(query || '').trim();
    if (!q) return escapeHTML(safeText);

    var idx = safeText.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return escapeHTML(safeText);

    var before = escapeHTML(safeText.slice(0, idx));
    var match = escapeHTML(safeText.slice(idx, idx + q.length));
    var after = escapeHTML(safeText.slice(idx + q.length));
    return before + '<strong class="search-ac-match">' + match + '</strong>' + after;
  }

  /**
   * Cycles keyboard selection index cleanly for ArrowDown (1) or ArrowUp (-1).
   *
   * @param {number} currentIdx
   * @param {number} delta - +1 or -1
   * @param {number} count
   * @returns {number}
   */
  function cycleIndex(currentIdx, delta, count) {
    if (!count || count <= 0) return -1;
    if (currentIdx < 0 || currentIdx >= count) {
      return delta > 0 ? 0 : count - 1;
    }
    return (currentIdx + delta + count) % count;
  }

  function ensureDropdown() {
    if (typeof document === 'undefined') return null;
    var existing = document.getElementById('search-autocomplete-dropdown');
    if (existing) return existing;

    var wrapper = document.getElementById('search-box-wrapper');
    if (!wrapper) return null;

    var dd = document.createElement('div');
    dd.id = 'search-autocomplete-dropdown';
    dd.className = 'search-ac-dropdown';
    dd.setAttribute('role', 'listbox');
    dd.setAttribute('aria-label', 'Game search suggestions');
    wrapper.appendChild(dd);
    return dd;
  }

  function closeDropdown() {
    isOpen = false;
    selectedIndex = -1;
    if (typeof document !== 'undefined') {
      var dd = document.getElementById('search-autocomplete-dropdown');
      if (dd) {
        dd.classList.remove('is-open');
        dd.innerHTML = '';
      }
      var input = document.getElementById('game-search-input');
      if (input) {
        input.setAttribute('aria-expanded', 'false');
        input.removeAttribute('aria-activedescendant');
      }
    }
  }

  function renderSuggestions(suggestions, query) {
    currentSuggestions = suggestions;
    selectedIndex = -1;

    if (typeof document === 'undefined') return;
    var dd = ensureDropdown();
    var input = document.getElementById('game-search-input');
    if (!dd) return;

    if (!suggestions || suggestions.length === 0) {
      closeDropdown();
      return;
    }

    isOpen = true;
    dd.innerHTML = '';

    suggestions.forEach(function (item, idx) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'search-ac-opt-' + idx;
      btn.className = 'search-ac-item';
      btn.setAttribute('role', 'option');
      btn.setAttribute('aria-selected', 'false');
      btn.innerHTML =
        '<span class="search-ac-title">' + highlightMatchHtml(item.title, query) + '</span>' +
        '<span class="search-ac-meta">' +
        '  <span class="search-ac-hint">Launch</span>' +
        '  <span class="search-ac-category">' + escapeHTML(item.category) + '</span>' +
        '</span>';

      btn.addEventListener('mousedown', function (e) {
        e.preventDefault(); // Keep focus from blurring before click fires
        selectSuggestion(item);
      });

      dd.appendChild(btn);
    });

    dd.classList.add('is-open');
    if (input) input.setAttribute('aria-expanded', 'true');
  }

  function updateSelectionHighlight() {
    if (typeof document === 'undefined') return;
    var dd = document.getElementById('search-autocomplete-dropdown');
    var input = document.getElementById('game-search-input');
    if (!dd) return;

    var items = dd.querySelectorAll('.search-ac-item');
    for (var i = 0; i < items.length; i++) {
      var active = i === selectedIndex;
      items[i].classList.toggle('is-selected', active);
      items[i].setAttribute('aria-selected', active ? 'true' : 'false');
    }
    if (input) {
      if (selectedIndex >= 0 && items[selectedIndex]) {
        input.setAttribute('aria-activedescendant', items[selectedIndex].id);
      } else {
        input.removeAttribute('aria-activedescendant');
      }
    }
  }

  function selectSuggestion(item) {
    if (!item) return;
    if (typeof document !== 'undefined') {
      var input = document.getElementById('game-search-input');
      if (input) {
        input.value = item.title;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    closeDropdown();

    if (typeof window !== 'undefined') {
      if (window.ArcadeApp && typeof window.ArcadeApp.openGame === 'function') {
        window.ArcadeApp.openGame(item.id);
      } else if (typeof window.openGameModal === 'function' && typeof GAMES_REGISTRY !== 'undefined') {
        var found = GAMES_REGISTRY.find(function (g) { return g.id === item.id; });
        if (found) window.openGameModal(found);
      }
    }
  }

  function handleKeyDown(e) {
    if (!isOpen || currentSuggestions.length === 0) return false;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = cycleIndex(selectedIndex, 1, currentSuggestions.length);
      updateSelectionHighlight();
      return true;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = cycleIndex(selectedIndex, -1, currentSuggestions.length);
      updateSelectionHighlight();
      return true;
    }
    if (e.key === 'Enter' && selectedIndex >= 0 && currentSuggestions[selectedIndex]) {
      e.preventDefault();
      selectSuggestion(currentSuggestions[selectedIndex]);
      return true;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      closeDropdown();
      return true;
    }
    return false;
  }

  function init() {
    if (typeof document === 'undefined') return;
    var registry = typeof GAMES_REGISTRY !== 'undefined' && Array.isArray(GAMES_REGISTRY) ? GAMES_REGISTRY : [];
    buildIndex(registry);

    var input = document.getElementById('game-search-input');
    if (!input) return;

    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');

    input.addEventListener('input', function () {
      var val = input.value || '';
      if (val.trim().length < MIN_QUERY_LENGTH) {
        closeDropdown();
        return;
      }
      var results = querySuggestions(val, indexedGames, MAX_SUGGESTIONS);
      renderSuggestions(results, val);
    });

    input.addEventListener('keydown', handleKeyDown);

    document.addEventListener('click', function (e) {
      var wrapper = document.getElementById('search-box-wrapper');
      if (wrapper && !wrapper.contains(e.target)) {
        closeDropdown();
      }
    });
  }

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  return {
    MIN_QUERY_LENGTH: MIN_QUERY_LENGTH,
    MAX_SUGGESTIONS: MAX_SUGGESTIONS,
    buildIndex: buildIndex,
    querySuggestions: querySuggestions,
    highlightMatchHtml: highlightMatchHtml,
    cycleIndex: cycleIndex,
    closeDropdown: closeDropdown,
    handleKeyDown: handleKeyDown,
    getState: function () {
      return {
        isOpen: isOpen,
        selectedIndex: selectedIndex,
        suggestions: currentSuggestions
      };
    },
    init: init
  };
});
