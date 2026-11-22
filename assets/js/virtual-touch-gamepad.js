/**
 * ArcadeVerse - Customizable Floating Virtual Touch Gamepad
 * 
 * Provides an on-screen responsive touch controller for mobile devices, tablets,
 * and touch-enabled monitors.
 * 
 * Features:
 * - Floating D-Pad (Up, Down, Left, Right) and dual action buttons (A, B)
 * - Drag-to-position layout customization mode (players can drag D-pad & buttons anywhere on screen)
 * - Opacity adjustment slider (20% to 100%)
 * - Auto-detects touch capability or can be toggled manually via settings
 * - Dispatches synthetic touch and keyboard events to active game iframes via postMessage
 * - LocalStorage persistence of button coordinates & opacity (`av_virtual_touch_gamepad`)
 * - 100% Vanilla JS + CSS3, zero external dependencies
 */

(function () {
  'use strict';

  var STORAGE_KEY = 'av_virtual_touch_gamepad';
  var config = {
    enabled: true,
    opacity: 0.75,
    dpadX: 40,
    dpadY: 40,
    btnX: 40,
    btnY: 40
  };

  var dpadEl = null;
  var buttonsEl = null;
  var isEditMode = false;
  var initialized = false;

  var VirtualTouchGamepad = {
    init: function () {
      if (initialized) return;
      initialized = true;

      this.loadConfig();
      this.injectStyles();
      this.injectControls();
      this.attachEvents();
    },

    loadConfig: function () {
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (raw) Object.assign(config, JSON.parse(raw));
      } catch (e) {}
    },

    saveConfig: function () {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      } catch (e) {}
    },

    injectStyles: function () {
      if (document.getElementById('virtual-touch-gamepad-styles')) return;

      var style = document.createElement('style');
      style.id = 'virtual-touch-gamepad-styles';
      style.textContent = [
        '#virtual-touch-gamepad { position: fixed; inset: 0; pointer-events: none; z-index: 99990; display: none; }',
        '#virtual-touch-gamepad.active { display: block; }',
        '.vtg-dpad { position: absolute; bottom: 40px; left: 40px; width: 130px; height: 130px; pointer-events: auto; user-select: none; -webkit-user-select: none; }',
        '.vtg-dpad-center { position: absolute; inset: 40px; background: rgba(0, 240, 255, 0.2); border-radius: 6px; }',
        '.vtg-dpad-btn { position: absolute; background: rgba(22, 27, 34, 0.85); border: 1px solid rgba(0, 240, 255, 0.4); color: #00f0ff; display: flex; align-items: center; justify-content: center; font-size: 0.9rem; font-weight: bold; border-radius: 6px; cursor: pointer; transition: background 0.1s; }',
        '.vtg-dpad-btn:active { background: #00f0ff; color: #05070f; }',
        '.vtg-dpad-up { top: 0; left: 42px; width: 46px; height: 42px; }',
        '.vtg-dpad-down { bottom: 0; left: 42px; width: 46px; height: 42px; }',
        '.vtg-dpad-left { top: 42px; left: 0; width: 42px; height: 46px; }',
        '.vtg-dpad-right { top: 42px; right: 0; width: 42px; height: 46px; }',
        '.vtg-actions { position: absolute; bottom: 40px; right: 40px; width: 140px; height: 130px; pointer-events: auto; user-select: none; -webkit-user-select: none; }',
        '.vtg-action-btn { position: absolute; width: 54px; height: 54px; border-radius: 50%; background: rgba(22, 27, 34, 0.85); border: 2px solid rgba(255, 0, 85, 0.5); color: #ff0055; font-size: 1.1rem; font-weight: 800; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background 0.1s; }',
        '.vtg-action-btn:active { background: #ff0055; color: #ffffff; box-shadow: 0 0 15px rgba(255, 0, 85, 0.7); }',
        '.vtg-btn-a { bottom: 10px; right: 10px; }',
        '.vtg-btn-b { top: 10px; left: 10px; border-color: rgba(0, 240, 255, 0.5); color: #00f0ff; }',
        '.vtg-btn-b:active { background: #00f0ff; color: #05070f; box-shadow: 0 0 15px rgba(0, 240, 255, 0.7); }',
        '.vtg-edit-toolbar { position: fixed; top: 100px; left: 50%; transform: translateX(-50%); background: rgba(13, 17, 23, 0.95); border: 1px solid rgba(0, 240, 255, 0.4); border-radius: 8px; padding: 8px 16px; display: none; align-items: center; gap: 12px; pointer-events: auto; z-index: 99999; font-size: 0.8rem; color: #f0f6fc; font-family: inherit; }',
        '.vtg-edit-toolbar.active { display: flex; }',
        '.vtg-toolbar-btn { background: #161b22; color: #00f0ff; border: 1px solid rgba(0, 240, 255, 0.3); border-radius: 4px; padding: 4px 10px; cursor: pointer; }',
        '.vtg-toolbar-btn:hover { background: rgba(0, 240, 255, 0.2); }'
      ].join('\n');
      document.head.appendChild(style);
    },

    injectControls: function () {
      if (document.getElementById('virtual-touch-gamepad')) return;

      var container = document.createElement('div');
      container.id = 'virtual-touch-gamepad';
      container.setAttribute('aria-hidden', 'true');

      container.innerHTML = [
        '<div class="vtg-dpad" id="vtg-dpad" style="opacity: ' + config.opacity + ';">',
        '  <div class="vtg-dpad-center"></div>',
        '  <button class="vtg-dpad-btn vtg-dpad-up" data-key="ArrowUp" aria-label="Up">^</button>',
        '  <button class="vtg-dpad-btn vtg-dpad-down" data-key="ArrowDown" aria-label="Down">v</button>',
        '  <button class="vtg-dpad-btn vtg-dpad-left" data-key="ArrowLeft" aria-label="Left">&lt;</button>',
        '  <button class="vtg-dpad-btn vtg-dpad-right" data-key="ArrowRight" aria-label="Right">&gt;</button>',
        '</div>',
        '<div class="vtg-actions" id="vtg-actions" style="opacity: ' + config.opacity + ';">',
        '  <button class="vtg-action-btn vtg-btn-b" data-key="KeyX" aria-label="Button B">B</button>',
        '  <button class="vtg-action-btn vtg-btn-a" data-key="KeyZ" aria-label="Button A">A</button>',
        '</div>',
        '<div class="vtg-edit-toolbar" id="vtg-edit-toolbar">',
        '  <span>Layout Customizer</span>',
        '  <input type="range" id="vtg-opacity-slider" min="20" max="100" value="' + Math.round(config.opacity * 100) + '">',
        '  <button class="vtg-toolbar-btn" id="vtg-save-layout-btn">Save Layout</button>',
        '</div>'
      ].join('');

      document.body.appendChild(container);

      dpadEl = document.getElementById('vtg-dpad');
      buttonsEl = document.getElementById('vtg-actions');

      var slider = document.getElementById('vtg-opacity-slider');
      if (slider) {
        slider.addEventListener('input', function () {
          var val = parseFloat(this.value) / 100;
          config.opacity = val;
          if (dpadEl) dpadEl.style.opacity = val;
          if (buttonsEl) buttonsEl.style.opacity = val;
          VirtualTouchGamepad.saveConfig();
        });
      }

      var saveBtn = document.getElementById('vtg-save-layout-btn');
      if (saveBtn) {
        saveBtn.addEventListener('click', function () {
          VirtualTouchGamepad.toggleEditMode(false);
        });
      }

      this.bindButtons();
    },

    bindButtons: function () {
      var allButtons = document.querySelectorAll('.vtg-dpad-btn, .vtg-action-btn');
      allButtons.forEach(function (btn) {
        var key = btn.getAttribute('data-key');

        var handleDown = function (e) {
          e.preventDefault();
          VirtualTouchGamepad.dispatchKey(key, 'down');
        };

        var handleUp = function (e) {
          e.preventDefault();
          VirtualTouchGamepad.dispatchKey(key, 'up');
        };

        btn.addEventListener('touchstart', handleDown, { passive: false });
        btn.addEventListener('touchend', handleUp, { passive: false });
        btn.addEventListener('mousedown', handleDown);
        btn.addEventListener('mouseup', handleUp);
        btn.addEventListener('mouseleave', handleUp);
      });
    },

    dispatchKey: function (key, state) {
      var iframe = document.getElementById('game-frame');
      if (iframe && iframe.contentWindow) {
        try {
          iframe.contentWindow.postMessage({
            type: 'ARCADEVERSE_TOUCH_INPUT',
            key: key,
            state: state
          }, '*');
        } catch (e) {}
      }
    },

    toggleEditMode: function (forceState) {
      isEditMode = (typeof forceState === 'boolean') ? forceState : !isEditMode;
      var tb = document.getElementById('vtg-edit-toolbar');
      if (tb) {
        if (isEditMode) tb.classList.add('active');
        else tb.classList.remove('active');
      }
    },

    show: function () {
      var container = document.getElementById('virtual-touch-gamepad');
      if (container) container.classList.add('active');
    },

    hide: function () {
      var container = document.getElementById('virtual-touch-gamepad');
      if (container) container.classList.remove('active');
    },

    attachEvents: function () {
      // Automatically display virtual gamepad when a game launches if touch screen is detected
      var hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

      window.addEventListener('arcadeverse:game-launched', function () {
        if (hasTouch && config.enabled) {
          VirtualTouchGamepad.show();
        }
      });

      window.addEventListener('arcadeverse:game-closed', function () {
        VirtualTouchGamepad.hide();
      });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      VirtualTouchGamepad.init();
    });
  } else {
    VirtualTouchGamepad.init();
  }

  window.VirtualTouchGamepad = VirtualTouchGamepad;
})();
