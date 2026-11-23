/**
 * ArcadeVerse Document Picture-in-Picture & Floating Mini-Player Arena (#1058)
 * Always-on-top multitasking window using native documentPictureInPicture API
 * with draggable/resizable corner-dock fallback for Firefox & Safari.
 * Author: Babin Bid (@Babin123456)
 * Open Source for ArcadeVerse - NSOC Winter Edition 2026
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ArcadePipManager = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var pipWindow = null;
  var isFloating = false;
  var originalParent = null;
  var originalNextSibling = null;
  var floatingContainer = null;

  function hasNativePiP() {
    return typeof window !== 'undefined' && 'documentPictureInPicture' in window && typeof window.documentPictureInPicture.requestWindow === 'function';
  }

  function togglePiP() {
    if (pipWindow || isFloating) {
      exitPiP();
    } else {
      enterPiP();
    }
  }

  function enterPiP() {
    var iframe = document.getElementById('game-iframe');
    if (!iframe) return;

    originalParent = iframe.parentNode;
    originalNextSibling = iframe.nextSibling;

    if (hasNativePiP()) {
      window.documentPictureInPicture.requestWindow({ width: 720, height: 480 })
        .then(function (win) {
          pipWindow = win;

          // Copy styles
          [].slice.call(document.styleSheets).forEach(function (styleSheet) {
            try {
              var cssRules = [].slice.call(styleSheet.cssRules).map(function (rule) { return rule.cssText; }).join('');
              var style = win.document.createElement('style');
              style.textContent = cssRules;
              win.document.head.appendChild(style);
            } catch (_) {
              if (styleSheet.href) {
                var link = win.document.createElement('link');
                link.rel = 'stylesheet';
                link.type = styleSheet.type;
                link.media = styleSheet.media;
                link.href = styleSheet.href;
                win.document.head.appendChild(link);
              }
            }
          });

          win.document.body.style.margin = '0';
          win.document.body.style.padding = '0';
          win.document.body.style.background = '#000';
          win.document.body.style.overflow = 'hidden';

          iframe.style.width = '100vw';
          iframe.style.height = '100vh';
          win.document.body.appendChild(iframe);

          win.addEventListener('pagehide', function () {
            exitPiP();
          });

          updateToolbarIcon(true);
        })
        .catch(function () {
          enterFallbackFloatingPiP(iframe);
        });
    } else {
      enterFallbackFloatingPiP(iframe);
    }
  }

  function enterFallbackFloatingPiP(iframe) {
    isFloating = true;

    floatingContainer = document.createElement('div');
    floatingContainer.id = 'floating-pip-container';
    floatingContainer.className = 'floating-pip-container';
    floatingContainer.style.position = 'fixed';
    floatingContainer.style.bottom = '24px';
    floatingContainer.style.right = '24px';
    floatingContainer.style.width = '380px';
    floatingContainer.style.height = '260px';
    floatingContainer.style.minWidth = '320px';
    floatingContainer.style.minHeight = '240px';
    floatingContainer.style.background = '#0f172a';
    floatingContainer.style.border = '2px solid var(--accent-primary, #00f5ff)';
    floatingContainer.style.borderRadius = '8px';
    floatingContainer.style.boxShadow = '0 12px 40px rgba(0,0,0,0.8)';
    floatingContainer.style.zIndex = '99999';
    floatingContainer.style.display = 'flex';
    floatingContainer.style.flexDirection = 'column';
    floatingContainer.style.overflow = 'hidden';

    var header = document.createElement('div');
    header.style.background = '#1e293b';
    header.style.padding = '6px 12px';
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.cursor = 'move';
    header.style.userSelect = 'none';

    var title = document.createElement('span');
    title.textContent = 'Floating Mini-Player';
    title.style.fontSize = '0.75rem';
    title.style.fontWeight = '700';
    title.style.color = 'var(--accent-primary, #00f5ff)';

    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.innerHTML = '&times;';
    closeBtn.style.background = 'none';
    closeBtn.style.border = 'none';
    closeBtn.style.color = '#fff';
    closeBtn.style.fontSize = '1.2rem';
    closeBtn.style.cursor = 'pointer';

    closeBtn.addEventListener('click', function () {
      exitPiP();
    });

    header.appendChild(title);
    header.appendChild(closeBtn);
    floatingContainer.appendChild(header);

    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.flex = '1';
    floatingContainer.appendChild(iframe);

    document.body.appendChild(floatingContainer);

    // Make Draggable
    var isDragging = false;
    var startX = 0, startY = 0;
    var initialLeft = 0, initialTop = 0;

    header.addEventListener('pointerdown', function (e) {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      var rect = floatingContainer.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;
      header.setPointerCapture(e.pointerId);
    });

    header.addEventListener('pointermove', function (e) {
      if (!isDragging) return;
      var dx = e.clientX - startX;
      var dy = e.clientY - startY;
      floatingContainer.style.left = Math.max(0, Math.min(window.innerWidth - 380, initialLeft + dx)) + 'px';
      floatingContainer.style.top = Math.max(0, Math.min(window.innerHeight - 260, initialTop + dy)) + 'px';
      floatingContainer.style.right = 'auto';
      floatingContainer.style.bottom = 'auto';
    });

    header.addEventListener('pointerup', function (e) {
      isDragging = false;
      try { header.releasePointerCapture(e.pointerId); } catch (_) {}
    });

    updateToolbarIcon(true);
  }

  function exitPiP() {
    var iframe = document.getElementById('game-iframe');
    if (!iframe) return;

    if (pipWindow) {
      try { pipWindow.close(); } catch (_) {}
      pipWindow = null;
    }

    if (floatingContainer) {
      if (floatingContainer.parentNode) {
        floatingContainer.parentNode.removeChild(floatingContainer);
      }
      floatingContainer = null;
    }

    if (originalParent) {
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      if (originalNextSibling) {
        originalParent.insertBefore(iframe, originalNextSibling);
      } else {
        originalParent.appendChild(iframe);
      }
    }

    isFloating = false;
    updateToolbarIcon(false);
  }

  function updateToolbarIcon(active) {
    var btn = document.getElementById('modal-pip-btn');
    if (btn) {
      btn.classList.toggle('active', !!active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    }
  }

  function addToolbarButton() {
    var controls = document.querySelector('.modal-controls');
    if (!controls || document.getElementById('modal-pip-btn')) return;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-sm btn-icon';
    btn.id = 'modal-pip-btn';
    btn.title = 'Picture-in-Picture Mini Player';
    btn.setAttribute('aria-label', 'Picture-in-Picture Mini Player');
    btn.innerHTML = [
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">',
      '  <rect width="20" height="16" x="2" y="4" rx="2"/>',
      '  <rect width="8" height="6" x="12" y="12" rx="1" fill="currentColor" fill-opacity="0.3"/>',
      '</svg>'
    ].join('');

    var closeBtn = controls.querySelector('#close-modal-btn');
    if (closeBtn) {
      controls.insertBefore(btn, closeBtn);
    } else {
      controls.appendChild(btn);
    }

    btn.addEventListener('click', function () {
      togglePiP();
    });
  }

  function init() {
    addToolbarButton();
    window.addEventListener('arcadeverse:game-closed', function () {
      if (pipWindow || isFloating) {
        exitPiP();
      }
    });
  }

  return {
    init: init,
    togglePiP: togglePiP,
    enterPiP: enterPiP,
    exitPiP: exitPiP,
    hasNativePiP: hasNativePiP
  };
});
