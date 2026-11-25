/**
 * ArcadeVerse - Retro CRT Cathode Tube Turn-Off & Glitch Page Transitions
 * Architectural Implementation for Issue #1097
 *
 * - Intercepts internal hub navigation links (index.html, leaderboard.html, docs.html, etc.).
 * - Plays a crisp 250ms (<= 300ms cap) CRT power-down phosphor collapse sequence.
 * - Triggers reverse neon phosphor power-on decompression on the incoming target page.
 * - Respects prefers-reduced-motion, modifier keys (Ctrl/Cmd/Shift/middle click),
 *   and bfcache history traversal (pageshow).
 * - 100% Vanilla JS and CSS keyframes; zero external libraries.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ArcadeCrtTransitions = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SESSION_FLAG = 'arcadeverse_crt_poweron';
  var TRANSITION_DURATION_MS = 250; // Strict <= 300ms cap
  var HUB_PAGES = [
    'index.html',
    'leaderboard.html',
    'docs.html',
    'faqs.html',
    'contributing.html',
    'terms.html',
    'privacy.html'
  ];

  var isNavigating = false;

  /**
   * Checks whether the user prefers reduced motion via media query or a11y engine class.
   *
   * @returns {boolean}
   */
  function isReducedMotion() {
    try {
      if (typeof document !== 'undefined' && document.documentElement &&
          document.documentElement.classList.contains('a11y-reduced-motion')) {
        return true;
      }
      if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      }
    } catch (_) {}
    return false;
  }

  /**
   * Determines whether a link href targets a different internal hub page.
   *
   * @param {string} href - Anchor href attribute
   * @param {string} [currentPathname] - Optional current pathname for testing
   * @returns {boolean}
   */
  function isInternalHubLink(href, currentPathname) {
    if (!href || typeof href !== 'string') return false;
    var trimmed = href.trim();
    if (!trimmed || trimmed.charAt(0) === '#') return false;
    if (/^(https?:|mailto:|tel:|javascript:)/i.test(trimmed)) return false;

    var base = trimmed.split('#')[0].split('?')[0].replace(/^\.\//, '');
    var targetFile = base === '' ? 'index.html' : base;

    if (HUB_PAGES.indexOf(targetFile) === -1) return false;

    var path = currentPathname !== undefined
      ? currentPathname
      : (typeof window !== 'undefined' && window.location ? window.location.pathname : '');
    var currentFile = (path.split('/').pop() || 'index.html');

    return targetFile !== currentFile;
  }

  /**
   * Checks if CRT transition should be bypassed for a given click event & link element.
   *
   * @param {Object} event - Mouse/click event
   * @param {Object} link - Anchor element or descriptor
   * @returns {boolean}
   */
  function shouldBypassTransition(event, link) {
    if (isReducedMotion()) return true;
    if (event) {
      if (event.defaultPrevented) return true;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return true;
      if (typeof event.button === 'number' && event.button !== 0) return true;
    }
    if (!link) return true;
    var target = typeof link.getAttribute === 'function' ? link.getAttribute('target') : link.target;
    if (target && target !== '_self') return true;
    if (typeof link.hasAttribute === 'function' && link.hasAttribute('download')) return true;

    var href = typeof link.getAttribute === 'function' ? link.getAttribute('href') : link.href;
    return !isInternalHubLink(href);
  }

  function ensureOverlay() {
    if (typeof document === 'undefined' || !document.body) return null;
    var existing = document.getElementById('crt-transition-overlay');
    if (existing) return existing;

    var overlay = document.createElement('div');
    overlay.id = 'crt-transition-overlay';
    overlay.className = 'crt-transition-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML =
      '<div class="crt-scanlines"></div>' +
      '<div class="crt-phosphor-beam"></div>';

    document.body.appendChild(overlay);
    return overlay;
  }

  function clearOverlay() {
    isNavigating = false;
    if (typeof document === 'undefined') return;
    var overlay = document.getElementById('crt-transition-overlay');
    if (overlay) {
      overlay.classList.remove('is-active', 'is-power-off', 'is-power-on');
    }
  }

  /**
   * Executes the 250ms CRT shutdown animation and navigates to targetUrl.
   *
   * @param {string} targetUrl - Destination URL
   */
  function triggerShutdownNavigation(targetUrl) {
    if (!targetUrl || isNavigating) return;

    if (isReducedMotion() || typeof document === 'undefined') {
      if (typeof window !== 'undefined') window.location.href = targetUrl;
      return;
    }

    isNavigating = true;
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(SESSION_FLAG, '1');
      }
    } catch (_) {}

    var overlay = ensureOverlay();
    if (!overlay) {
      window.location.href = targetUrl;
      return;
    }

    overlay.classList.remove('is-power-on');
    overlay.classList.add('is-active', 'is-power-off');

    setTimeout(function () {
      window.location.href = targetUrl;
    }, TRANSITION_DURATION_MS);

    // Safety fallback if navigation is aborted
    setTimeout(clearOverlay, 2500);
  }

  /**
   * Plays the reverse neon phosphor power-on decompression on page arrival.
   */
  function playPowerOnIfPending() {
    if (typeof document === 'undefined' || isReducedMotion()) return;

    var pending = false;
    try {
      if (typeof sessionStorage !== 'undefined') {
        pending = sessionStorage.getItem(SESSION_FLAG) === '1';
        if (pending) sessionStorage.removeItem(SESSION_FLAG);
      }
    } catch (_) {}

    if (!pending) return;

    var overlay = ensureOverlay();
    if (!overlay) return;

    overlay.classList.remove('is-power-off');
    overlay.classList.add('is-active', 'is-power-on');

    setTimeout(clearOverlay, TRANSITION_DURATION_MS + 20);
  }

  function init() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    playPowerOnIfPending();

    // Ensure clean overlay state on browser back/forward bfcache restoration
    window.addEventListener('pageshow', clearOverlay);

    // Override global transition helper used by navbar.js & keyboard-shortcuts.js
    window.triggerPageTransition = function (url) {
      triggerShutdownNavigation(url);
    };

    // Capture-phase delegation for all hub navigation links
    document.addEventListener('click', function (e) {
      var link = e.target && typeof e.target.closest === 'function' ? e.target.closest('a[href]') : null;
      if (!link) return;
      if (shouldBypassTransition(e, link)) return;

      e.preventDefault();
      e.stopImmediatePropagation();
      triggerShutdownNavigation(link.getAttribute('href'));
    }, true);
  }

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  return {
    TRANSITION_DURATION_MS: TRANSITION_DURATION_MS,
    HUB_PAGES: HUB_PAGES,
    isReducedMotion: isReducedMotion,
    isInternalHubLink: isInternalHubLink,
    shouldBypassTransition: shouldBypassTransition,
    triggerShutdownNavigation: triggerShutdownNavigation,
    playPowerOnIfPending: playPowerOnIfPending,
    clearOverlay: clearOverlay,
    init: init
  };
});
