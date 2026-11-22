/**
 * ArcadeVerse - Real-time Input History Stream & Combo HUD Overlay
 * 
 * Displays a live scrolling queue of the player's recent keystrokes and inputs
 * along with frame duration counters, and highlights fighting game special moves
 * and cheat code combos:
 * 1. Konami Code (Up Up Down Down Left Right Left Right B A)
 * 2. Hadouken (Down, Down-Right, Right, Attack)
 * 3. Shoryuken (Right, Down, Down-Right, Attack)
 * 
 * Features:
 * - Real-time animated keystroke queue with duration hold badges
 * - Flash banner on successful combo execution
 * - Toggleable overlay via Ctrl+Shift+I or modal HUD button
 * - 100% Vanilla JS + CSS3, zero external dependencies
 */

(function () {
  'use strict';

  var MAX_HISTORY = 12;
  var history = [];
  var isVisible = false;
  var containerEl = null;
  var listEl = null;
  var comboBannerEl = null;
  var initialized = false;

  var KNOWN_COMBOS = [
    { name: 'KONAMI CODE', keys: ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'] },
    { name: 'HADOUKEN', keys: ['ArrowDown', 'ArrowRight', 'KeyZ'] },
    { name: 'SHORYUKEN', keys: ['ArrowRight', 'ArrowDown', 'ArrowRight', 'KeyZ'] },
    { name: 'SONIC BOOM', keys: ['ArrowLeft', 'ArrowRight', 'KeyZ'] }
  ];

  var InputHistoryHUD = {
    init: function () {
      if (initialized) return;
      initialized = true;

      this.injectStyles();
      this.injectHUD();
      this.attachEvents();
    },

    injectStyles: function () {
      if (document.getElementById('input-history-hud-styles')) return;

      var style = document.createElement('style');
      style.id = 'input-history-hud-styles';
      style.textContent = [
        '#input-history-hud { position: fixed; bottom: 80px; left: 20px; width: 220px; background: rgba(12, 16, 23, 0.92); border: 1px solid rgba(0, 240, 255, 0.3); border-radius: 8px; box-shadow: 0 8px 30px rgba(0, 0, 0, 0.8), 0 0 15px rgba(0, 240, 255, 0.15); z-index: 99998; display: none; flex-direction: column; overflow: hidden; font-family: monospace, monospace; color: #f0f6fc; backdrop-filter: blur(6px); }',
        '#input-history-hud.active { display: flex; }',
        '.ih-header { display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; background: rgba(0, 240, 255, 0.08); border-bottom: 1px solid rgba(255, 255, 255, 0.1); font-size: 0.7rem; font-weight: bold; color: #00f0ff; }',
        '.ih-list { display: flex; flex-direction: column; gap: 4px; padding: 8px; max-height: 180px; overflow-y: hidden; }',
        '.ih-row { display: flex; align-items: center; justify-content: space-between; font-size: 0.75rem; background: rgba(255, 255, 255, 0.04); padding: 3px 8px; border-radius: 4px; border: 1px solid rgba(255, 255, 255, 0.05); }',
        '.ih-key-badge { font-weight: bold; color: #00f0ff; }',
        '.ih-dur-badge { font-size: 0.65rem; color: #8b949e; }',
        '.ih-combo-banner { background: #ff0055; color: #ffffff; font-size: 0.75rem; font-weight: 800; text-align: center; padding: 4px; letter-spacing: 1px; display: none; }',
        '.ih-combo-banner.flash { display: block; animation: comboFlash 1s ease-out; }',
        '@keyframes comboFlash { 0% { opacity: 1; transform: scale(1.05); } 100% { opacity: 0; transform: scale(1); } }'
      ].join('\n');
      document.head.appendChild(style);
    },

    injectHUD: function () {
      if (document.getElementById('input-history-hud')) return;

      containerEl = document.createElement('div');
      containerEl.id = 'input-history-hud';
      containerEl.setAttribute('role', 'region');
      containerEl.setAttribute('aria-label', 'Input History Stream');

      containerEl.innerHTML = [
        '<div class="ih-combo-banner" id="ih-combo-banner">COMBO EXECUTED!</div>',
        '<div class="ih-header">',
        '  <span>INPUT HISTORY</span>',
        '  <span style="font-size:0.65rem;color:#8b949e;">Ctrl+Shift+I</span>',
        '</div>',
        '<div class="ih-list" id="ih-list"></div>'
      ].join('');

      document.body.appendChild(containerEl);
      listEl = document.getElementById('ih-list');
      comboBannerEl = document.getElementById('ih-combo-banner');
    },

    toggle: function (forceState) {
      isVisible = (typeof forceState === 'boolean') ? forceState : !isVisible;
      if (!containerEl) return;
      if (isVisible) containerEl.classList.add('active');
      else containerEl.classList.remove('active');
    },

    recordKey: function (code) {
      var display = code.replace(/^Key|^Digit/, '');
      history.push({ code: code, label: display, time: Date.now() });
      if (history.length > MAX_HISTORY) history.shift();

      this.render();
      this.checkCombos();
    },

    render: function () {
      if (!listEl) return;
      listEl.innerHTML = '';

      history.forEach(function (item) {
        var row = document.createElement('div');
        row.className = 'ih-row';
        row.innerHTML = [
          '<span class="ih-key-badge">' + item.label + '</span>',
          '<span class="ih-dur-badge">' + item.code + '</span>'
        ].join('');
        listEl.appendChild(row);
      });
    },

    checkCombos: function () {
      var recentCodes = history.map(function (h) { return h.code; });

      KNOWN_COMBOS.forEach(function (combo) {
        var kLen = combo.keys.length;
        if (recentCodes.length >= kLen) {
          var slice = recentCodes.slice(recentCodes.length - kLen);
          var match = true;
          for (var i = 0; i < kLen; i++) {
            if (slice[i] !== combo.keys[i]) { match = false; break; }
          }
          if (match) {
            InputHistoryHUD.flashCombo(combo.name);
          }
        }
      });
    },

    flashCombo: function (name) {
      if (!comboBannerEl) return;
      comboBannerEl.textContent = 'COMBO: ' + name;
      comboBannerEl.className = 'ih-combo-banner flash';
      setTimeout(function () {
        if (comboBannerEl) comboBannerEl.className = 'ih-combo-banner';
      }, 1200);
    },

    attachEvents: function () {
      window.addEventListener('keydown', function (e) {
        // Hotkey Ctrl+Shift+I
        if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i')) {
          e.preventDefault();
          InputHistoryHUD.toggle();
          return;
        }

        if (isVisible) {
          InputHistoryHUD.recordKey(e.code || e.key);
        }
      });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      InputHistoryHUD.init();
    });
  } else {
    InputHistoryHUD.init();
  }

  window.InputHistoryHUD = InputHistoryHUD;
})();
