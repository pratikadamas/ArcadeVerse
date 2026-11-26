/**
 * ArcadeVerse - Screen Reader Live Region Announcer for Dynamic Catalog Filter Counts
 * Architectural Implementation for Issue #1499
 *
 * - Initializes persistent aria-live="polite" aria-atomic="true" live region.
 * - Debounces catalog filter/search count announcements (announceCatalogUpdate).
 * - Exposes general ArcadeAnnouncer.speak(message, priority) API.
 * - 100% Vanilla JS; zero external dependencies.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ArcadeAnnouncer = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var REGION_ID = 'a11y-live-announcer';
  var DEBOUNCE_MS = 350;

  var debounceTimer = null;
  var lastSpokenMessage = '';

  /**
   * Ensures a persistent, visually hidden aria-live region exists in the DOM.
   *
   * @param {Document} [docOverride]
   * @returns {Element|null}
   */
  function ensureLiveRegion(docOverride) {
    var doc = docOverride || (typeof document !== 'undefined' ? document : null);
    if (!doc) return null;

    var existing = doc.getElementById(REGION_ID) || doc.getElementById('a11y-announcer');
    if (existing) {
      existing.setAttribute('aria-live', existing.getAttribute('aria-live') || 'polite');
      existing.setAttribute('aria-atomic', 'true');
      return existing;
    }

    if (!doc.body || typeof doc.createElement !== 'function') return null;
    var el = doc.createElement('div');
    el.id = REGION_ID;
    el.className = 'sr-only visually-hidden a11y-live-announcer-region';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-atomic', 'true');
    doc.body.appendChild(el);
    return el;
  }

  /**
   * Speaks a message immediately via the aria-live region.
   *
   * @param {string} message
   * @param {string} [priority='polite'] - 'polite' | 'assertive'
   * @param {Document} [docOverride]
   * @returns {string} The spoken message
   */
  function speak(message, priority, docOverride) {
    var text = String(message || '').trim();
    if (!text) return '';

    var prio = priority === 'assertive' ? 'assertive' : 'polite';
    var region = ensureLiveRegion(docOverride);
    if (region) {
      region.setAttribute('aria-live', prio);
      // Clear first if identical so screen readers re-announce
      if (region.textContent === text) {
        region.textContent = '';
      }
      region.textContent = text;
    }

    lastSpokenMessage = text;
    return text;
  }

  /**
   * Formats a screen-reader-friendly announcement for catalog filter results.
   *
   * @param {string} query
   * @param {number} count
   * @param {Object} [activeFilters] - { category, tag, difficulty }
   * @returns {string}
   */
  function formatCatalogMessage(query, count, activeFilters) {
    var q = String(query || '').trim();
    var num = Math.max(0, Math.floor(Number(count) || 0));
    var filters = activeFilters || {};
    var category = filters.category && filters.category !== 'all' ? String(filters.category).trim() : '';
    var tag = filters.tag ? String(filters.tag).trim() : '';

    var scopeParts = [];
    if (category) scopeParts.push("in '" + category + "' category");
    if (tag) scopeParts.push("with tag '" + tag + "'");
    var scopeSuffix = scopeParts.length > 0 ? ' ' + scopeParts.join(' ') : '';

    if (num === 0) {
      if (q) {
        return "No games found matching '" + q + "'" + scopeSuffix + '. Suggestions are available below.';
      }
      return 'No games found' + scopeSuffix + '. Try resetting active filters.';
    }

    var noun = num === 1 ? 'game' : 'games';
    if (q) {
      return 'Found ' + num + ' ' + noun + " matching '" + q + "'" + scopeSuffix + '.';
    }
    if (scopeSuffix) {
      return 'Showing ' + num + ' ' + noun + scopeSuffix + '.';
    }
    return 'Showing all ' + num + ' ' + noun + ' in catalog.';
  }

  /**
   * Debounced announcement for catalog search and filter updates.
   *
   * @param {string} query
   * @param {number} count
   * @param {Object} [activeFilters]
   * @param {Object} [options] - { delayMs, immediate, doc }
   * @returns {string} Formatted message
   */
  function announceCatalogUpdate(query, count, activeFilters, options) {
    var opts = options || {};
    var msg = formatCatalogMessage(query, count, activeFilters);

    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    if (opts.immediate) {
      return speak(msg, 'polite', opts.doc);
    }

    var delay = typeof opts.delayMs === 'number' ? opts.delayMs : DEBOUNCE_MS;
    debounceTimer = setTimeout(function () {
      debounceTimer = null;
      speak(msg, 'polite', opts.doc);
    }, delay);

    return msg;
  }

  function readCatalogStateAndAnnounce() {
    if (typeof document === 'undefined') return;
    var countEl = document.getElementById('catalog-results-count');
    if (!countEl) return;

    var match = (countEl.textContent || '').match(/\d+/);
    var count = match ? parseInt(match[0], 10) : 0;

    var searchInput = document.getElementById('game-search-input');
    var query = searchInput ? searchInput.value : '';

    var activeCat = document.querySelector('#category-pills .pill.active');
    var category = activeCat ? activeCat.getAttribute('data-category') : 'all';

    var activeTag = document.querySelector('#tag-filter-pills .tag-pill[aria-pressed="true"]');
    var tag = activeTag ? activeTag.getAttribute('data-tag') : '';

    announceCatalogUpdate(query, count, { category: category, tag: tag });
  }

  function init() {
    if (typeof document === 'undefined') return;
    ensureLiveRegion(document);

    var countEl = document.getElementById('catalog-results-count');
    if (countEl && typeof MutationObserver === 'function') {
      new MutationObserver(readCatalogStateAndAnnounce).observe(countEl, {
        childList: true,
        characterData: true,
        subtree: true
      });
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
    REGION_ID: REGION_ID,
    DEBOUNCE_MS: DEBOUNCE_MS,
    ensureLiveRegion: ensureLiveRegion,
    speak: speak,
    formatCatalogMessage: formatCatalogMessage,
    announceCatalogUpdate: announceCatalogUpdate,
    getLastSpokenMessage: function () { return lastSpokenMessage; },
    init: init
  };
});
