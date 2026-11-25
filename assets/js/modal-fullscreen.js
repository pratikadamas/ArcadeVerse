/**
 * ArcadeVerse - Fullscreen Toggle Button & Animated Expand-Compress Icon Controller
 * Architectural Implementation for Issue #1505
 *
 * - Upgrades #fullscreen-btn with an interactive animated SVG icon morphing
 *   between 4-corner expand arrows and inward-pointing compress arrows.
 * - Connects to HTML5 Fullscreen API (requestFullscreen / exitFullscreen) with
 *   graceful fallback to viewport-spanning CSS fullscreen if blocked.
 * - Listens to fullscreenchange and Escape key events to keep state synchronized.
 * - 100% Vanilla JS and SVG; zero external packages.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ArcadeModalFullscreen = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var ANIMATED_SVG_HTML =
    '<svg class="fs-anim-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '  <g class="fs-expand-paths">' +
    '    <path d="M8 3H5a2 2 0 0 0-2 2v3"></path>' +
    '    <path d="M21 8V5a2 2 0 0 0-2-2h-3"></path>' +
    '    <path d="M3 16v3a2 2 0 0 0 2 2h3"></path>' +
    '    <path d="M16 21h3a2 2 0 0 0 2-2v-3"></path>' +
    '  </g>' +
    '  <g class="fs-compress-paths">' +
    '    <path d="M4 14h6v6"></path>' +
    '    <path d="M20 10h-6V4"></path>' +
    '    <path d="M14 20v-6h6"></path>' +
    '    <path d="M10 4v6H4"></path>' +
    '  </g>' +
    '</svg>';

  function isNativeSupported(el) {
    if (!el) return false;
    return Boolean(
      el.requestFullscreen ||
      el.webkitRequestFullscreen ||
      el.mozRequestFullScreen ||
      el.msRequestFullscreen
    );
  }

  function getNativeFullscreenElement(docOverride) {
    var doc = docOverride || (typeof document !== 'undefined' ? document : null);
    if (!doc) return null;
    return (
      doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement ||
      doc.msFullscreenElement ||
      null
    );
  }

  function isFullscreenActive(targetEl, docOverride) {
    if (getNativeFullscreenElement(docOverride)) return true;
    if (targetEl && targetEl.classList) {
      return targetEl.classList.contains('fullscreen') || targetEl.classList.contains('is-css-fullscreen');
    }
    return false;
  }

  function applyCssFullscreen(targetEl, active, docOverride) {
    var doc = docOverride || (typeof document !== 'undefined' ? document : null);
    if (targetEl && targetEl.classList) {
      targetEl.classList.toggle('is-css-fullscreen', Boolean(active));
      targetEl.classList.toggle('fullscreen', Boolean(active));
    }
    if (doc && doc.body && doc.body.classList) {
      doc.body.classList.toggle('modal-fullscreen-active', Boolean(active));
    }
    if (doc && typeof doc.getElementById === 'function') {
      var modal = doc.getElementById('game-modal');
      if (modal && modal.classList) {
        modal.classList.toggle('fullscreen-mode', Boolean(active));
      }
    }
  }

  function syncIconState(btn, isFullscreen) {
    if (!btn) return;
    if (btn.classList && typeof btn.classList.toggle === 'function') {
      btn.classList.toggle('is-fullscreen', Boolean(isFullscreen));
    }
    if (typeof btn.setAttribute === 'function') {
      btn.setAttribute('aria-pressed', isFullscreen ? 'true' : 'false');
      btn.setAttribute('title', isFullscreen ? 'Exit Fullscreen' : 'Toggle Fullscreen');
    }
  }

  /**
   * Requests HTML5 Fullscreen API on targetEl with automatic CSS viewport fallback.
   *
   * @param {Element} targetEl
   * @param {Document} [docOverride]
   * @returns {Promise<{ mode: 'native'|'css', active: boolean }>}
   */
  async function enterFullscreen(targetEl, docOverride) {
    var doc = docOverride || (typeof document !== 'undefined' ? document : null);
    if (!targetEl) return { mode: 'css', active: false };

    applyCssFullscreen(targetEl, true, doc);

    if (isNativeSupported(targetEl)) {
      try {
        var reqFn = targetEl.requestFullscreen ||
          targetEl.webkitRequestFullscreen ||
          targetEl.mozRequestFullScreen ||
          targetEl.msRequestFullscreen;
        var res = reqFn.call(targetEl);
        if (res && typeof res.then === 'function') {
          await res;
        }
        return { mode: 'native', active: true };
      } catch (_) {
        // Fallback cleanly to CSS viewport-spanning fullscreen
        return { mode: 'css', active: true };
      }
    }
    return { mode: 'css', active: true };
  }

  /**
   * Exits native Fullscreen API if active and cleans up CSS fullscreen classes.
   *
   * @param {Element} targetEl
   * @param {Document} [docOverride]
   * @returns {Promise<{ active: boolean }>}
   */
  async function exitFullscreen(targetEl, docOverride) {
    var doc = docOverride || (typeof document !== 'undefined' ? document : null);
    applyCssFullscreen(targetEl, false, doc);

    if (doc && getNativeFullscreenElement(doc)) {
      try {
        var exitFn = doc.exitFullscreen ||
          doc.webkitExitFullscreen ||
          doc.mozCancelFullScreen ||
          doc.msExitFullscreen;
        if (typeof exitFn === 'function') {
          var res = exitFn.call(doc);
          if (res && typeof res.then === 'function') {
            await res;
          }
        }
      } catch (_) {}
    }
    return { active: false };
  }

  async function toggleFullscreen(targetEl, docOverride) {
    if (isFullscreenActive(targetEl, docOverride)) {
      return exitFullscreen(targetEl, docOverride);
    }
    return enterFullscreen(targetEl, docOverride);
  }

  function upgradeButtonAndBind() {
    if (typeof document === 'undefined') return;
    var btn = document.getElementById('fullscreen-btn');
    var modalWindow = document.querySelector('#game-modal .modal-window');
    if (!btn) return;

    if (!btn.querySelector('.fs-anim-icon')) {
      btn.innerHTML = ANIMATED_SVG_HTML;
    }

    var syncAll = function () {
      var active = isFullscreenActive(modalWindow, document);
      syncIconState(btn, active);
      if (document.body && document.body.classList) {
        document.body.classList.toggle('modal-fullscreen-active', active);
      }
    };

    // Keep icon synchronized with native fullscreenchange & Escape key
    document.addEventListener('fullscreenchange', syncAll);
    document.addEventListener('webkitfullscreenchange', syncAll);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isFullscreenActive(modalWindow, document)) {
        exitFullscreen(modalWindow, document).then(syncAll);
      }
    });

    if (modalWindow && typeof MutationObserver === 'function') {
      new MutationObserver(syncAll).observe(modalWindow, {
        attributes: true,
        attributeFilter: ['class']
      });
    }

    if (typeof MutationObserver === 'function') {
      new MutationObserver(function () {
        var pressed = btn.getAttribute('aria-pressed') === 'true';
        btn.classList.toggle('is-fullscreen', pressed);
      }).observe(btn, {
        attributes: true,
        attributeFilter: ['aria-pressed']
      });
    }

    syncAll();
  }

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', upgradeButtonAndBind);
    } else {
      upgradeButtonAndBind();
    }
  }

  return {
    ANIMATED_SVG_HTML: ANIMATED_SVG_HTML,
    isNativeSupported: isNativeSupported,
    getNativeFullscreenElement: getNativeFullscreenElement,
    isFullscreenActive: isFullscreenActive,
    syncIconState: syncIconState,
    enterFullscreen: enterFullscreen,
    exitFullscreen: exitFullscreen,
    toggleFullscreen: toggleFullscreen,
    upgradeButtonAndBind: upgradeButtonAndBind
  };
});
