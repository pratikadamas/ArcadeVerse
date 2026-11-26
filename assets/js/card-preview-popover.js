/**
 * ArcadeVerse - Mini Game Preview Popover on Card Hover and Long-Press
 * Architectural Implementation for Issue #1498
 *
 * - Triggers preview popover after 400ms hover delay on desktop or 480ms long-press on mobile.
 * - Dynamically flips & clamps position to stay within viewport boundaries.
 * - Populates author, difficulty, synopsis, and deduced control icons from GAMES_REGISTRY / DOM.
 * - Dismisses cleanly on mouseleave, touch release, scroll, or Escape key.
 * - 100% Vanilla JS; zero external dependencies.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ArcadeCardPreviewPopover = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var HOVER_DELAY_MS = 400;
  var LONG_PRESS_MS = 480;
  var POPOVER_WIDTH = 286;
  var POPOVER_HEIGHT = 210;
  var MARGIN = 10;

  var pendingTimer = null;
  var isVisible = false;
  var activeGameId = null;

  /**
   * Computes viewport-safe popover coordinates with automatic right->left edge flipping.
   *
   * @param {Object} cardRect - { left, right, top, bottom }
   * @param {Object} [popoverSize] - { width, height }
   * @param {Object} [viewport] - { width, height }
   * @returns {{ left: number, top: number, flippedLeft: boolean }}
   */
  function computePopoverPosition(cardRect, popoverSize, viewport) {
    var rect = cardRect || { left: 0, right: 200, top: 0, bottom: 200 };
    var pWidth = (popoverSize && popoverSize.width) || POPOVER_WIDTH;
    var pHeight = (popoverSize && popoverSize.height) || POPOVER_HEIGHT;
    var vpW = (viewport && viewport.width) || (typeof window !== 'undefined' ? window.innerWidth : 1280);
    var vpH = (viewport && viewport.height) || (typeof window !== 'undefined' ? window.innerHeight : 720);

    var gap = 12;
    var flippedLeft = false;
    var left = rect.right + gap;

    // Flip to left side of card if placing on right overflows viewport
    if (left + pWidth + MARGIN > vpW) {
      left = rect.left - pWidth - gap;
      flippedLeft = true;
    }

    // Clamp horizontally
    left = Math.max(MARGIN, Math.min(vpW - pWidth - MARGIN, left));

    // Align top with card and clamp vertically
    var top = Math.max(MARGIN, Math.min(vpH - pHeight - MARGIN, rect.top));

    return {
      left: Math.round(left),
      top: Math.round(top),
      flippedLeft: flippedLeft
    };
  }

  /**
   * Extracts game metadata and control hints from GAMES_REGISTRY or card DOM.
   *
   * @param {string} gameId
   * @param {Element} [cardEl]
   * @param {Array<Object>} [registryOverride]
   * @returns {Object}
   */
  function extractGameMetadata(gameId, cardEl, registryOverride) {
    var reg = Array.isArray(registryOverride)
      ? registryOverride
      : (typeof GAMES_REGISTRY !== 'undefined' && Array.isArray(GAMES_REGISTRY) ? GAMES_REGISTRY : []);

    var found = gameId ? reg.find(function (g) { return g && g.id === gameId; }) : null;

    var title = found ? found.title : '';
    var author = found ? (found.author || found.github || 'Community') : 'Community';
    var category = found ? (found.category || 'Arcade') : 'Arcade';
    var difficulty = found ? (found.difficulty || 'Normal') : 'Normal';
    var description = found ? (found.description || '') : '';
    var tags = found && Array.isArray(found.tags) ? found.tags : [];

    if (!title && cardEl && typeof cardEl.querySelector === 'function') {
      var tEl = cardEl.querySelector('.game-card-title');
      var cEl = cardEl.querySelector('.game-category-tag');
      var dEl = cardEl.querySelector('.game-card-desc');
      if (tEl) title = tEl.textContent || '';
      if (cEl) category = cEl.textContent || category;
      if (dEl) description = dEl.textContent || '';
    }

    var text = (title + ' ' + category + ' ' + description + ' ' + tags.join(' ')).toLowerCase();
    var controls = {
      keyboard: text.includes('keyboard') || text.includes('wasd') || text.includes('arrow') || text.includes('arcade') || text.includes('platformer') || text.includes('shooter') || text.includes('snake'),
      mouse: text.includes('mouse') || text.includes('click') || text.includes('puzzle') || text.includes('drag') || text.includes('aim'),
      gamepad: true // All ArcadeVerse games support standard virtual/USB Gamepad bridge
    };
    if (!controls.keyboard && !controls.mouse) {
      controls.keyboard = true;
    }

    return {
      id: gameId || '',
      title: title || 'Arcade Game',
      author: author,
      category: category,
      difficulty: difficulty,
      description: description || 'Launch to play this community arcade title.',
      controls: controls
    };
  }

  function ensurePopoverEl() {
    if (typeof document === 'undefined') return null;
    var existing = document.getElementById('card-preview-popover');
    if (existing) return existing;

    var el = document.createElement('div');
    el.id = 'card-preview-popover';
    el.className = 'card-preview-popover';
    el.setAttribute('role', 'tooltip');
    el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(el);
    return el;
  }

  function buildControlIconsHtml(controls) {
    var html = '';
    if (controls.keyboard) {
      html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" title="Keyboard"><rect width="20" height="14" x="2" y="5" rx="2"></rect><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M8 13h8"></path></svg>';
    }
    if (controls.mouse) {
      html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" title="Mouse / Touch"><rect x="6" y="3" width="12" height="18" rx="6"></rect><line x1="12" y1="7" x2="12" y2="11"></line></svg>';
    }
    if (controls.gamepad) {
      html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" title="Gamepad"><line x1="6" y1="12" x2="10" y2="12"></line><line x1="8" y1="10" x2="8" y2="14"></line><rect x="2" y="6" width="20" height="12" rx="4"></rect></svg>';
    }
    return html;
  }

  function showPopover(cardEl, metaOverride) {
    if (typeof document === 'undefined' || !cardEl) return false;
    var popover = ensurePopoverEl();
    if (!popover) return false;

    var gameId = cardEl.getAttribute('data-game-id') || cardEl.getAttribute('data-id') || '';
    var meta = metaOverride || extractGameMetadata(gameId, cardEl);
    activeGameId = meta.id;
    isVisible = true;

    var initial = meta.title.trim().charAt(0).toUpperCase() || 'A';

    popover.innerHTML =
      '<div class="cpp-header">' +
      '  <div class="cpp-thumb" aria-hidden="true"></div>' +
      '  <div class="cpp-title-block">' +
      '    <h4 class="cpp-title"></h4>' +
      '    <p class="cpp-author"></p>' +
      '  </div>' +
      '</div>' +
      '<div class="cpp-meta-pills">' +
      '  <span class="cpp-pill cpp-pill-accent" id="cpp-cat-pill"></span>' +
      '  <span class="cpp-pill" id="cpp-diff-pill"></span>' +
      '</div>' +
      '<p class="cpp-synopsis"></p>' +
      '<div class="cpp-controls-row">' +
      '  <span>Supported Controls</span>' +
      '  <span class="cpp-control-icons">' + buildControlIconsHtml(meta.controls) + '</span>' +
      '</div>';

    popover.querySelector('.cpp-thumb').textContent = initial;
    popover.querySelector('.cpp-title').textContent = meta.title;
    popover.querySelector('.cpp-author').textContent = 'by ' + meta.author;
    popover.querySelector('#cpp-cat-pill').textContent = meta.category;
    popover.querySelector('#cpp-diff-pill').textContent = meta.difficulty;
    popover.querySelector('.cpp-synopsis').textContent = meta.description;

    var cardRect = typeof cardEl.getBoundingClientRect === 'function'
      ? cardEl.getBoundingClientRect()
      : { left: 20, right: 280, top: 100, bottom: 320 };

    var pos = computePopoverPosition(cardRect, { width: POPOVER_WIDTH, height: POPOVER_HEIGHT });
    popover.style.left = pos.left + 'px';
    popover.style.top = pos.top + 'px';
    popover.classList.add('is-visible');
    popover.setAttribute('aria-hidden', 'false');
    return true;
  }

  function hidePopover() {
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      pendingTimer = null;
    }
    isVisible = false;
    activeGameId = null;
    if (typeof document !== 'undefined') {
      var popover = document.getElementById('card-preview-popover');
      if (popover) {
        popover.classList.remove('is-visible');
        popover.setAttribute('aria-hidden', 'true');
      }
    }
  }

  function scheduleShow(cardEl, delayMs) {
    if (pendingTimer) clearTimeout(pendingTimer);
    var delay = typeof delayMs === 'number' ? delayMs : HOVER_DELAY_MS;
    pendingTimer = setTimeout(function () {
      pendingTimer = null;
      showPopover(cardEl);
    }, delay);
  }

  function bindEvents() {
    if (typeof document === 'undefined') return;

    document.addEventListener('mouseenter', function (e) {
      var card = e.target && typeof e.target.closest === 'function' ? e.target.closest('.game-card') : null;
      if (card) scheduleShow(card, HOVER_DELAY_MS);
    }, true);

    document.addEventListener('mouseleave', function (e) {
      if (e.target && e.target.classList && e.target.classList.contains('game-card')) {
        hidePopover();
      }
    }, true);

    document.addEventListener('touchstart', function (e) {
      var card = e.target && typeof e.target.closest === 'function' ? e.target.closest('.game-card') : null;
      if (card) scheduleShow(card, LONG_PRESS_MS);
    }, { passive: true });

    document.addEventListener('touchend', hidePopover, { passive: true });
    document.addEventListener('touchcancel', hidePopover, { passive: true });
    document.addEventListener('touchmove', hidePopover, { passive: true });
    document.addEventListener('scroll', hidePopover, { passive: true });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isVisible) {
        hidePopover();
      }
    });
  }

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bindEvents);
    } else {
      bindEvents();
    }
  }

  return {
    HOVER_DELAY_MS: HOVER_DELAY_MS,
    LONG_PRESS_MS: LONG_PRESS_MS,
    computePopoverPosition: computePopoverPosition,
    extractGameMetadata: extractGameMetadata,
    showPopover: showPopover,
    hidePopover: hidePopover,
    scheduleShow: scheduleShow,
    getState: function () {
      return {
        isVisible: isVisible,
        activeGameId: activeGameId,
        hasPendingTimer: Boolean(pendingTimer)
      };
    }
  };
});
