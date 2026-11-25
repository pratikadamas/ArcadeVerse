/**
 * ArcadeVerse - Reduced Motion Mode Overrides Controller
 * Architectural Implementation for Issue #1507
 *
 * - Auto-detects window.matchMedia('(prefers-reduced-motion: reduce)') on initial load.
 * - Allows manual user override persisted in localStorage ('arcadeverse_reduced_motion').
 * - Toggles .arcade-reduced-motion on <body> to disable infinite CSS keyframes,
 *   glowing pulses, shimmers, and 3D card tilts.
 * - Synchronizes with the Accessibility Settings drawer (#a11y-opt-motion).
 * - 100% Vanilla JS; zero dependencies.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ArcadeReducedMotion = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var STORAGE_KEY = 'arcadeverse_reduced_motion';
  var BODY_CLASS = 'arcade-reduced-motion';

  var enabled = false;

  /**
   * Detects OS-level prefers-reduced-motion media query.
   *
   * @param {Object} [winOverride] - Optional window-like object for testing
   * @returns {boolean}
   */
  function detectSystemPreference(winOverride) {
    var win = winOverride || (typeof window !== 'undefined' ? window : null);
    try {
      if (win && typeof win.matchMedia === 'function') {
        return Boolean(win.matchMedia('(prefers-reduced-motion: reduce)').matches);
      }
    } catch (_) {}
    return false;
  }

  /**
   * Loads persisted preference from localStorage or falls back to system preference.
   *
   * @param {Object} [winOverride] - Optional window-like object for testing
   * @returns {boolean}
   */
  function loadPreference(winOverride) {
    try {
      if (typeof localStorage !== 'undefined') {
        var saved = localStorage.getItem(STORAGE_KEY);
        if (saved === 'true') {
          enabled = true;
          return enabled;
        }
        if (saved === 'false') {
          enabled = false;
          return enabled;
        }
      }
    } catch (_) {}

    enabled = detectSystemPreference(winOverride);
    return enabled;
  }

  /**
   * Applies .arcade-reduced-motion class to <body> and syncs checkbox UI.
   *
   * @param {boolean} state
   */
  function applyClass(state) {
    if (typeof document !== 'undefined') {
      if (document.body && document.body.classList && typeof document.body.classList.toggle === 'function') {
        document.body.classList.toggle(BODY_CLASS, Boolean(state));
      }
      if (document.documentElement && document.documentElement.classList && typeof document.documentElement.classList.toggle === 'function') {
        document.documentElement.classList.toggle('a11y-reduced-motion', Boolean(state));
      }
      var drawerCheckbox = document.getElementById('a11y-opt-motion');
      if (drawerCheckbox) {
        drawerCheckbox.checked = Boolean(state);
      }
    }
  }

  /**
   * Sets Reduced Motion state explicitly, persists to localStorage, and updates DOM.
   *
   * @param {boolean} state
   * @returns {boolean}
   */
  function setEnabled(state) {
    enabled = Boolean(state);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
      }
    } catch (_) {}

    applyClass(enabled);

    if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
      window.dispatchEvent(new CustomEvent('arcadeverse:reduced-motion-changed', {
        detail: { reducedMotion: enabled }
      }));
    }
    return enabled;
  }

  function toggle() {
    return setEnabled(!enabled);
  }

  function isEnabled() {
    return enabled;
  }

  function bindEvents() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    // Sync when user toggles Reduced Motion inside the Accessibility Settings drawer
    window.addEventListener('arcadeverse:a11y-motion-changed', function (e) {
      if (e && e.detail && typeof e.detail.reducedMotion === 'boolean') {
        if (enabled !== e.detail.reducedMotion) {
          setEnabled(e.detail.reducedMotion);
        }
      }
    });

    // Listen for live OS-level preference changes when no explicit manual override exists
    try {
      if (typeof window.matchMedia === 'function') {
        var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        if (typeof mq.addEventListener === 'function') {
          mq.addEventListener('change', function (e) {
            var hasManual = false;
            try {
              hasManual = typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY) !== null;
            } catch (_) {}
            if (!hasManual) {
              enabled = Boolean(e.matches);
              applyClass(enabled);
            }
          });
        }
      }
    } catch (_) {}
  }

  function init() {
    loadPreference();
    applyClass(enabled);
    bindEvents();
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
    BODY_CLASS: BODY_CLASS,
    detectSystemPreference: detectSystemPreference,
    loadPreference: loadPreference,
    applyClass: applyClass,
    setEnabled: setEnabled,
    toggle: toggle,
    isEnabled: isEnabled,
    init: init
  };
});
