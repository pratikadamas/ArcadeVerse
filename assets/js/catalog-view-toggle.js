/**
 * ArcadeVerse - Compact Table List View Mode Toggle Controller
 * Architectural Implementation for Issue #1501
 *
 * - Toggles .catalog-grid-mode vs .catalog-list-mode on #games-grid.
 * - Persists user preference in localStorage ('arcadeverse_catalog_view_mode').
 * - Synchronizes with #view-grid-btn and #view-list-btn in catalog header.
 * - Preserves all search, category, and sorting capabilities seamlessly.
 * - 100% Vanilla JS; zero external dependencies.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ArcadeCatalogViewToggle = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var STORAGE_KEY = 'arcadeverse_catalog_view_mode';
  var GRID_CLASS = 'catalog-grid-mode';
  var LIST_CLASS = 'catalog-list-mode';

  var currentMode = loadViewMode();

  function normalizeMode(mode) {
    return mode === 'list' ? 'list' : 'grid';
  }

  function loadViewMode() {
    try {
      if (typeof localStorage !== 'undefined') {
        var saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('arcadeverse_catalog_view');
        if (saved === 'list' || saved === 'grid') {
          return saved;
        }
      }
    } catch (_) {}
    return 'grid';
  }

  function getViewMode() {
    return currentMode;
  }

  /**
   * Applies .catalog-grid-mode or .catalog-list-mode class onto the catalog container.
   *
   * @param {Element} containerEl
   * @param {string} mode - 'grid' | 'list'
   */
  function applyViewClasses(containerEl, mode) {
    if (!containerEl || !containerEl.classList) return false;
    var target = normalizeMode(mode);
    containerEl.classList.toggle(GRID_CLASS, target === 'grid');
    containerEl.classList.toggle(LIST_CLASS, target === 'list');
    containerEl.classList.toggle('view-list', target === 'list');
    return true;
  }

  /**
   * Sets active view mode, persists to localStorage, and updates DOM & header buttons.
   *
   * @param {string} mode - 'grid' | 'list'
   * @param {Object} [options] - { container, silent }
   * @returns {string} Active view mode
   */
  function setViewMode(mode, options) {
    var opts = options || {};
    currentMode = normalizeMode(mode);

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, currentMode);
      }
    } catch (_) {}

    if (typeof document !== 'undefined') {
      var grid = opts.container || document.getElementById('games-grid');
      if (grid) {
        applyViewClasses(grid, currentMode);
      }

      var gridBtn = document.getElementById('view-grid-btn');
      var listBtn = document.getElementById('view-list-btn');
      if (gridBtn) {
        gridBtn.classList.toggle('active', currentMode === 'grid');
        gridBtn.setAttribute('aria-pressed', currentMode === 'grid' ? 'true' : 'false');
      }
      if (listBtn) {
        listBtn.classList.toggle('active', currentMode === 'list');
        listBtn.setAttribute('aria-pressed', currentMode === 'list' ? 'true' : 'false');
      }
    } else if (opts.container) {
      applyViewClasses(opts.container, currentMode);
    }

    if (!opts.silent && typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
      window.dispatchEvent(new CustomEvent('arcadeverse:catalog-view-changed', {
        detail: { mode: currentMode }
      }));
    }

    return currentMode;
  }

  function toggleViewMode(options) {
    return setViewMode(currentMode === 'list' ? 'grid' : 'list', options);
  }

  function init() {
    if (typeof document === 'undefined') return;

    var grid = document.getElementById('games-grid');
    if (grid) {
      applyViewClasses(grid, currentMode);
    }

    var gridBtn = document.getElementById('view-grid-btn');
    var listBtn = document.getElementById('view-list-btn');

    if (gridBtn) {
      gridBtn.addEventListener('click', function () {
        setViewMode('grid');
      });
    }
    if (listBtn) {
      listBtn.addEventListener('click', function () {
        setViewMode('list');
      });
    }

    if (grid && typeof MutationObserver === 'function') {
      new MutationObserver(function () {
        if (grid.classList.contains('view-list') && !grid.classList.contains(LIST_CLASS)) {
          applyViewClasses(grid, 'list');
        } else if (!grid.classList.contains('view-list') && !grid.classList.contains(GRID_CLASS)) {
          applyViewClasses(grid, 'grid');
        }
      }).observe(grid, { attributes: true, attributeFilter: ['class'] });
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
    STORAGE_KEY: STORAGE_KEY,
    GRID_CLASS: GRID_CLASS,
    LIST_CLASS: LIST_CLASS,
    normalizeMode: normalizeMode,
    loadViewMode: loadViewMode,
    getViewMode: getViewMode,
    applyViewClasses: applyViewClasses,
    setViewMode: setViewMode,
    toggleViewMode: toggleViewMode,
    init: init
  };
});
