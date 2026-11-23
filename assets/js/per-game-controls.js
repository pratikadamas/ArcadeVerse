/**
 * ArcadeVerse - Per-Game Custom Keybinding Profile Manager
 * 
 * Provides an interactive UI and remapping engine enabling players to configure,
 * rebind, test, and persist bespoke keyboard bindings for any arcade game.
 * Automatically translates physical keypresses to mapped virtual inputs and
 * dispatches them directly to active game iframes via postMessage / synthetic events.
 * 
 * Key features:
 * - LocalStorage persistence partitioned per game ID (`av_keymaps_<gameId>`)
 * - Interactive key capture modal with duplicate key collision detection
 * - Import and Export JSON profiles for backup and sharing
 * - Clean Vanilla JS architecture adhering strictly to zero external dependencies
 */

(function () {
  'use strict';

  var DEFAULT_CONTROLS = [
    { action: 'moveUp', label: 'Move Up / Jump', defaultKey: 'ArrowUp' },
    { action: 'moveDown', label: 'Move Down / Crouch', defaultKey: 'ArrowDown' },
    { action: 'moveLeft', label: 'Move Left', defaultKey: 'ArrowLeft' },
    { action: 'moveRight', label: 'Move Right', defaultKey: 'ArrowRight' },
    { action: 'actionPrimary', label: 'Primary Action / Attack', defaultKey: 'KeyZ' },
    { action: 'actionSecondary', label: 'Secondary Action / Dash', defaultKey: 'KeyX' },
    { action: 'pauseGame', label: 'Pause / Menu', defaultKey: 'KeyP' }
  ];

  var STORAGE_PREFIX = 'av_keymaps_';
  var currentGameId = null;
  var currentBindings = {};
  var listeningAction = null;
  var initialized = false;

  var PerGameControls = {
    init: function () {
      if (initialized) return;
      initialized = true;

      this.injectStyles();
      this.injectControlsButton();
      this.injectModal();
      this.attachGlobalListeners();
    },

    injectStyles: function () {
      if (document.getElementById('per-game-controls-styles')) return;

      var style = document.createElement('style');
      style.id = 'per-game-controls-styles';
      style.textContent = [
        '.remap-modal-overlay { position: fixed; inset: 0; background: rgba(5, 7, 15, 0.85); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); z-index: 99999; display: flex; align-items: center; justify-content: center; opacity: 0; pointer-events: none; transition: opacity 0.2s ease; }',
        '.remap-modal-overlay.active { opacity: 1; pointer-events: auto; }',
        '.remap-dialog { background: #0d1117; border: 1px solid rgba(0, 240, 255, 0.3); border-radius: 12px; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.8), 0 0 25px rgba(0, 240, 255, 0.15); width: 92%; max-width: 540px; max-height: 85vh; display: flex; flex-direction: column; overflow: hidden; font-family: inherit; color: #f0f6fc; }',
        '.remap-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); background: rgba(0, 240, 255, 0.04); }',
        '.remap-header h3 { margin: 0; font-size: 1.15rem; font-weight: 700; color: #00f0ff; letter-spacing: 0.5px; display: flex; align-items: center; gap: 8px; }',
        '.remap-header-actions { display: flex; align-items: center; gap: 8px; }',
        '.remap-body { padding: 20px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 14px; }',
        '.remap-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; transition: background 0.2s, border-color 0.2s; }',
        '.remap-row:hover { background: rgba(255, 255, 255, 0.06); border-color: rgba(0, 240, 255, 0.3); }',
        '.remap-action-meta { display: flex; flex-direction: column; gap: 2px; }',
        '.remap-action-label { font-size: 0.9rem; font-weight: 600; color: #e6edf3; }',
        '.remap-action-desc { font-size: 0.75rem; color: #8b949e; }',
        '.remap-key-btn { min-width: 90px; height: 34px; padding: 0 12px; font-family: monospace; font-size: 0.85rem; font-weight: 700; background: #161b22; color: #00f0ff; border: 1px solid rgba(0, 240, 255, 0.4); border-radius: 6px; cursor: pointer; transition: all 0.2s ease; outline: none; }',
        '.remap-key-btn:hover { background: rgba(0, 240, 255, 0.1); border-color: #00f0ff; box-shadow: 0 0 10px rgba(0, 240, 255, 0.3); }',
        '.remap-key-btn.listening { background: #ff0055; color: #fff; border-color: #ff0055; box-shadow: 0 0 14px rgba(255, 0, 85, 0.6); animation: remapPulse 1s infinite alternate; }',
        '@keyframes remapPulse { from { opacity: 0.8; } to { opacity: 1; transform: scale(1.03); } }',
        '.remap-footer { padding: 14px 20px; border-top: 1px solid rgba(255, 255, 255, 0.1); display: flex; align-items: center; justify-content: space-between; background: rgba(0, 0, 0, 0.3); }',
        '.remap-footer-left { display: flex; gap: 8px; }',
        '.remap-footer-right { display: flex; gap: 8px; }',
        '.remap-btn-subtle { background: transparent; color: #8b949e; border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 6px; padding: 6px 12px; font-size: 0.8rem; cursor: pointer; transition: all 0.2s ease; }',
        '.remap-btn-subtle:hover { color: #f0f6fc; border-color: rgba(255, 255, 255, 0.4); background: rgba(255, 255, 255, 0.05); }',
        '.remap-btn-primary { background: #00f0ff; color: #05070f; font-weight: 600; border: none; border-radius: 6px; padding: 6px 16px; font-size: 0.85rem; cursor: pointer; transition: background 0.2s ease; }',
        '.remap-btn-primary:hover { background: #70f7ff; box-shadow: 0 0 12px rgba(0, 240, 255, 0.4); }',
        '.remap-notice { font-size: 0.78rem; color: #8b949e; background: rgba(255, 255, 255, 0.02); padding: 8px 12px; border-radius: 6px; border-left: 3px solid #00f0ff; line-height: 1.4; }'
      ].join('\n');
      document.head.appendChild(style);
    },

    injectControlsButton: function () {
      var controlsContainer = document.querySelector('.modal-controls');
      if (!controlsContainer || document.getElementById('modal-keybinds-btn')) return;

      var btn = document.createElement('button');
      btn.className = 'btn btn-sm btn-icon';
      btn.id = 'modal-keybinds-btn';
      btn.title = 'Custom Keybindings & Controls';
      btn.setAttribute('aria-label', 'Custom Keybindings & Controls');
      btn.innerHTML = [
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">',
        '  <rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect>',
        '  <path d="M6 8h.001M10 8h.001M14 8h.001M18 8h.001M8 12h.001M12 12h.001M16 12h.001M7 16h10"></path>',
        '</svg>'
      ].join('');

      var shareBtn = document.getElementById('modal-share-score-btn');
      if (shareBtn && shareBtn.parentNode) {
        shareBtn.parentNode.insertBefore(btn, shareBtn.nextSibling);
      } else {
        controlsContainer.appendChild(btn);
      }

      btn.addEventListener('click', function () {
        PerGameControls.openModal();
      });
    },

    injectModal: function () {
      if (document.getElementById('remap-modal-overlay')) return;

      var overlay = document.createElement('div');
      overlay.className = 'remap-modal-overlay';
      overlay.id = 'remap-modal-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', 'Keybinding Configuration');

      overlay.innerHTML = [
        '<div class="remap-dialog">',
        '  <div class="remap-header">',
        '    <h3>',
        '      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">',
        '        <rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect>',
        '        <path d="M6 8h.001M10 8h.001M14 8h.001M18 8h.001M8 12h.001M12 12h.001M16 12h.001M7 16h10"></path>',
        '      </svg>',
        '      <span>Controls Profile</span>',
        '    </h3>',
        '    <div class="remap-header-actions">',
        '      <button class="btn btn-sm btn-icon" id="remap-close-btn" title="Close Controls" aria-label="Close Controls">',
        '        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">',
        '          <line x1="18" y1="6" x2="6" y2="18"></line>',
        '          <line x1="6" y1="6" x2="18" y2="18"></line>',
        '        </svg>',
        '      </button>',
        '    </div>',
        '  </div>',
        '  <div class="remap-body" id="remap-rows-container">',
        '    <div class="remap-notice">',
        '      Click any key button and press a new key on your keyboard to rebind. Profiles are saved automatically for this game.',
        '    </div>',
        '  </div>',
        '  <div class="remap-footer">',
        '    <div class="remap-footer-left">',
        '      <button class="remap-btn-subtle" id="remap-export-btn" title="Export Profile JSON">Export</button>',
        '      <button class="remap-btn-subtle" id="remap-import-btn" title="Import Profile JSON">Import</button>',
        '      <button class="remap-btn-subtle" id="remap-reset-btn" title="Reset to Defaults">Reset</button>',
        '      <input type="file" id="remap-file-input" accept=".json" style="display:none;" />',
        '    </div>',
        '    <div class="remap-footer-right">',
        '      <button class="remap-btn-primary" id="remap-done-btn">Done</button>',
        '    </div>',
        '  </div>',
        '</div>'
      ].join('');

      document.body.appendChild(overlay);

      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) PerGameControls.closeModal();
      });

      var closeBtn = document.getElementById('remap-close-btn');
      if (closeBtn) closeBtn.addEventListener('click', function () { PerGameControls.closeModal(); });

      var doneBtn = document.getElementById('remap-done-btn');
      if (doneBtn) doneBtn.addEventListener('click', function () { PerGameControls.closeModal(); });

      var resetBtn = document.getElementById('remap-reset-btn');
      if (resetBtn) resetBtn.addEventListener('click', function () { PerGameControls.resetToDefaults(); });

      var exportBtn = document.getElementById('remap-export-btn');
      if (exportBtn) exportBtn.addEventListener('click', function () { PerGameControls.exportProfile(); });

      var importBtn = document.getElementById('remap-import-btn');
      var fileInput = document.getElementById('remap-file-input');
      if (importBtn && fileInput) {
        importBtn.addEventListener('click', function () { fileInput.click(); });
        fileInput.addEventListener('change', function (e) { PerGameControls.handleFileImport(e); });
      }
    },

    loadBindings: function (gameId) {
      currentGameId = gameId || 'generic_game';
      currentBindings = {};

      try {
        var raw = localStorage.getItem(STORAGE_PREFIX + currentGameId);
        if (raw) {
          currentBindings = JSON.parse(raw);
        }
      } catch (e) {
        // Fallback to empty in restricted storage environments
      }

      DEFAULT_CONTROLS.forEach(function (ctrl) {
        if (!currentBindings[ctrl.action]) {
          currentBindings[ctrl.action] = ctrl.defaultKey;
        }
      });
    },

    saveBindings: function () {
      if (!currentGameId) return;
      try {
        localStorage.setItem(STORAGE_PREFIX + currentGameId, JSON.stringify(currentBindings));
      } catch (e) {
        // Storage limit or blocked
      }
    },

    renderRows: function () {
      var container = document.getElementById('remap-rows-container');
      if (!container) return;

      var existingRows = container.querySelectorAll('.remap-row');
      existingRows.forEach(function (row) { row.remove(); });

      DEFAULT_CONTROLS.forEach(function (ctrl) {
        var row = document.createElement('div');
        row.className = 'remap-row';

        var boundKey = currentBindings[ctrl.action] || ctrl.defaultKey;
        var displayKey = boundKey.replace(/^Key|^Digit/, '');

        row.innerHTML = [
          '<div class="remap-action-meta">',
          '  <span class="remap-action-label">' + ctrl.label + '</span>',
          '  <span class="remap-action-desc">Action ID: ' + ctrl.action + '</span>',
          '</div>',
          '<button class="remap-key-btn" data-action="' + ctrl.action + '">' + displayKey + '</button>'
        ].join('');

        var btn = row.querySelector('.remap-key-btn');
        btn.addEventListener('click', function () {
          PerGameControls.startListening(ctrl.action, btn);
        });

        container.appendChild(row);
      });
    },

    startListening: function (action, buttonEl) {
      if (listeningAction) {
        var prevBtn = document.querySelector('.remap-key-btn.listening');
        if (prevBtn) prevBtn.classList.remove('listening');
      }

      listeningAction = action;
      buttonEl.classList.add('listening');
      buttonEl.textContent = '...';
    },

    stopListening: function () {
      if (!listeningAction) return;
      var btn = document.querySelector('.remap-key-btn.listening');
      if (btn) {
        btn.classList.remove('listening');
        var boundKey = currentBindings[listeningAction] || 'Unbound';
        btn.textContent = boundKey.replace(/^Key|^Digit/, '');
      }
      listeningAction = null;
    },

    openModal: function () {
      var modal = document.getElementById('game-modal');
      var gameId = (modal && modal.dataset.gameId) ? modal.dataset.gameId : (window.App && App.activeGameId ? App.activeGameId : 'generic_game');
      this.loadBindings(gameId);
      this.renderRows();

      var overlay = document.getElementById('remap-modal-overlay');
      if (overlay) overlay.classList.add('active');
    },

    closeModal: function () {
      this.stopListening();
      var overlay = document.getElementById('remap-modal-overlay');
      if (overlay) overlay.classList.remove('active');
    },

    resetToDefaults: function () {
      DEFAULT_CONTROLS.forEach(function (ctrl) {
        currentBindings[ctrl.action] = ctrl.defaultKey;
      });
      this.saveBindings();
      this.renderRows();
    },

    exportProfile: function () {
      var profileData = {
        gameId: currentGameId,
        version: '1.0',
        exportedAt: new Date().toISOString(),
        keybindings: currentBindings
      };

      var jsonBlob = new Blob([JSON.stringify(profileData, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(jsonBlob);
      var link = document.createElement('a');
      link.href = url;
      link.download = 'keymap-' + (currentGameId || 'arcade') + '.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    },

    handleFileImport: function (event) {
      var file = event.target.files && event.target.files[0];
      if (!file) return;

      var reader = new FileReader();
      reader.onload = function (e) {
        try {
          var parsed = JSON.parse(e.target.result);
          if (parsed && parsed.keybindings) {
            currentBindings = Object.assign({}, currentBindings, parsed.keybindings);
            PerGameControls.saveBindings();
            PerGameControls.renderRows();
          }
        } catch (err) {
          // Parse error ignored
        }
      };
      reader.readAsText(file);
      event.target.value = '';
    },

    attachGlobalListeners: function () {
      // Key capture listener during rebind mode
      window.addEventListener('keydown', function (e) {
        if (!listeningAction) return;

        if (e.key === 'Escape') {
          PerGameControls.stopListening();
          return;
        }

        e.preventDefault();
        e.stopPropagation();

        var chosenCode = e.code || e.key;
        currentBindings[listeningAction] = chosenCode;
        PerGameControls.saveBindings();
        PerGameControls.stopListening();
        PerGameControls.renderRows();
      }, true);

      // Active game listener: listen for game launch and dispatch mapped events
      window.addEventListener('arcadeverse:game-launched', function (e) {
        var id = (e && e.detail && e.detail.gameId) ? e.detail.gameId : 'generic_game';
        PerGameControls.loadBindings(id);
      });

      // Forward mapped keys down to active iframe
      window.addEventListener('keydown', function (e) {
        if (listeningAction || !currentGameId) return;

        var iframe = document.getElementById('game-frame');
        if (!iframe || !iframe.contentWindow) return;

        // Check if this pressed physical key is mapped to an action
        for (var action in currentBindings) {
          if (currentBindings[action] === e.code) {
            try {
              iframe.contentWindow.postMessage({
                type: 'ARCADEVERSE_REMAP_INPUT',
                action: action,
                state: 'down',
                code: e.code,
                key: e.key
              }, '*');
            } catch (err) {}
          }
        }
      });

      window.addEventListener('keyup', function (e) {
        if (listeningAction || !currentGameId) return;

        var iframe = document.getElementById('game-frame');
        if (!iframe || !iframe.contentWindow) return;

        for (var action in currentBindings) {
          if (currentBindings[action] === e.code) {
            try {
              iframe.contentWindow.postMessage({
                type: 'ARCADEVERSE_REMAP_INPUT',
                action: action,
                state: 'up',
                code: e.code,
                key: e.key
              }, '*');
            } catch (err) {}
          }
        }
      });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      PerGameControls.init();
    });
  } else {
    PerGameControls.init();
  }

  window.PerGameControls = PerGameControls;
})();
