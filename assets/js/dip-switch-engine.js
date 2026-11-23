/**
 * ArcadeVerse - Hardware DIP Switch & Gameplay Modifier Engine
 * 
 * Simulates vintage arcade PCB dual-inline package (DIP) physical rock switches.
 * Enables players and developers to toggle gameplay modifiers:
 * 1. Infinite Lives / God Mode
 * 2. Turbo Speed (1.5x simulation rate)
 * 3. Low Gravity Moon Jump
 * 4. Hitbox Wireframe Debug Mode
 * 5. Free Play / Infinite Credits
 * 6. Slow-Motion Practice Mode (0.6x simulation rate)
 * 7. Hardcore One-Hit Elimination
 * 8. Mirror Flip Mode
 * 
 * Safety & Leaderboard Governance:
 * When any active cheat switch is toggled ON, the session marks the run as UNRANKED
 * and broadcasts an ARCADEVERSE_LEADERBOARD_VOID event preventing tainted high-score submissions.
 */

(function () {
  'use strict';

  var DIP_SWITCHES = [
    { id: 'god_mode', num: 1, label: 'GOD MODE', desc: 'Infinite health and collision invincibility' },
    { id: 'turbo_speed', num: 2, label: 'TURBO 1.5X', desc: 'Accelerates game loop clock by +50%' },
    { id: 'moon_gravity', num: 3, label: 'MOON JUMP', desc: 'Reduces gravitational velocity clamp by 60%' },
    { id: 'debug_hitboxes', num: 4, label: 'HITBOXES', desc: 'Renders red collision wireframes around entities' },
    { id: 'free_play', num: 5, label: 'FREE PLAY', desc: 'Unlimited arcade token insert credits' },
    { id: 'slow_mo', num: 6, label: 'SLOW-MO', desc: 'Reduces game clock to 0.6x for precision practice' },
    { id: 'one_hit_ko', num: 7, label: 'HARDCORE 1-HIT', desc: 'Any damage triggers instant game-over' },
    { id: 'mirror_mode', num: 8, label: 'MIRROR X', desc: 'Inverts viewport coordinate rendering matrix' }
  ];

  var STORAGE_KEY = 'av_dip_switches_state';
  var state = {};
  var audioCtx = null;
  var initialized = false;

  var DipSwitchEngine = {
    init: function () {
      if (initialized) return;
      initialized = true;

      this.loadState();
      this.injectStyles();
      this.injectTriggerButton();
      this.injectModal();
      this.attachListeners();
    },

    loadState: function () {
      state = {};
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (raw) state = JSON.parse(raw);
      } catch (e) {}

      DIP_SWITCHES.forEach(function (sw) {
        if (typeof state[sw.id] !== 'boolean') {
          state[sw.id] = false;
        }
      });
    },

    saveState: function () {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (e) {}
    },

    playClickSound: function (isTurnOn) {
      try {
        var AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        if (!audioCtx) audioCtx = new AudioCtx();
        if (audioCtx.state === 'suspended') audioCtx.resume();

        var osc = audioCtx.createOscillator();
        var gain = audioCtx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(isTurnOn ? 880 : 440, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(isTurnOn ? 1760 : 220, audioCtx.currentTime + 0.04);

        gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.04);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start();
        osc.stop(audioCtx.currentTime + 0.045);
      } catch (err) {}
    },

    injectStyles: function () {
      if (document.getElementById('dip-switch-styles')) return;

      var style = document.createElement('style');
      style.id = 'dip-switch-styles';
      style.textContent = [
        '.dip-modal-overlay { position: fixed; inset: 0; background: rgba(5, 7, 15, 0.88); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); z-index: 99999; display: flex; align-items: center; justify-content: center; opacity: 0; pointer-events: none; transition: opacity 0.2s ease; }',
        '.dip-modal-overlay.active { opacity: 1; pointer-events: auto; }',
        '.dip-dialog { background: #0c1017; border: 2px solid #b32a2a; border-radius: 12px; box-shadow: 0 12px 50px rgba(0, 0, 0, 0.9), 0 0 30px rgba(179, 42, 42, 0.25); width: 92%; max-width: 580px; max-height: 85vh; display: flex; flex-direction: column; overflow: hidden; font-family: monospace, monospace; color: #f0f6fc; }',
        '.dip-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; background: linear-gradient(90deg, #3d0c0c 0%, #161b22 100%); border-bottom: 2px solid #b32a2a; }',
        '.dip-header h3 { margin: 0; font-size: 1.1rem; font-weight: 700; color: #ff5555; letter-spacing: 1px; display: flex; align-items: center; gap: 10px; }',
        '.dip-header-status { font-size: 0.75rem; padding: 3px 8px; border-radius: 4px; font-weight: bold; }',
        '.dip-header-status.clean { background: rgba(46, 160, 67, 0.2); color: #3fb950; border: 1px solid #3fb950; }',
        '.dip-header-status.cheated { background: rgba(248, 81, 73, 0.2); color: #ff7b72; border: 1px solid #f85149; }',
        '.dip-pcb-body { padding: 20px; background: #060a0f; background-image: radial-gradient(#15202b 1px, transparent 1px); background-size: 12px 12px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 10px; }',
        '.dip-pcb-housing { background: #c5221f; border: 2px solid #7a1513; border-radius: 6px; padding: 12px 16px; box-shadow: inset 0 2px 8px rgba(0,0,0,0.6), 0 4px 14px rgba(0,0,0,0.8); display: flex; flex-direction: column; gap: 8px; }',
        '.dip-housing-title { font-size: 0.72rem; color: #ffebeb; font-weight: bold; text-align: center; letter-spacing: 2px; margin-bottom: 4px; }',
        '.dip-switch-row { display: flex; align-items: center; justify-content: space-between; background: #1a0808; padding: 6px 12px; border-radius: 4px; border: 1px solid #4a1515; }',
        '.dip-switch-meta { display: flex; flex-direction: column; gap: 2px; }',
        '.dip-switch-label { font-size: 0.85rem; font-weight: bold; color: #f0f6fc; }',
        '.dip-switch-desc { font-size: 0.7rem; color: #8b949e; }',
        '.dip-rocker-wrapper { display: flex; align-items: center; gap: 8px; }',
        '.dip-pos-indicator { font-size: 0.7rem; font-weight: bold; color: #6e7681; min-width: 28px; text-align: center; }',
        '.dip-pos-indicator.on { color: #3fb950; text-shadow: 0 0 6px rgba(63, 185, 80, 0.6); }',
        '.dip-switch-btn { width: 50px; height: 24px; background: #21262d; border-radius: 12px; position: relative; cursor: pointer; border: 1px solid #484f58; transition: background 0.2s; outline: none; }',
        '.dip-switch-btn::after { content: ""; position: absolute; top: 2px; left: 3px; width: 18px; height: 18px; background: #e6edf3; border-radius: 50%; transition: transform 0.2s, background 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.5); }',
        '.dip-switch-btn.active { background: #2ea043; border-color: #3fb950; }',
        '.dip-switch-btn.active::after { transform: translateX(25px); background: #ffffff; }',
        '.dip-footer { padding: 14px 20px; border-top: 1px solid rgba(255, 255, 255, 0.1); display: flex; align-items: center; justify-content: space-between; background: #0c1017; }',
        '.dip-footer-btn { background: #21262d; color: #c9d1d9; border: 1px solid #30363d; border-radius: 6px; padding: 6px 14px; font-size: 0.8rem; cursor: pointer; transition: all 0.2s ease; font-family: inherit; }',
        '.dip-footer-btn:hover { background: #30363d; color: #f0f6fc; }',
        '.dip-footer-btn.primary { background: #b32a2a; color: #ffffff; border-color: #ff5555; font-weight: bold; }',
        '.dip-footer-btn.primary:hover { background: #d93838; box-shadow: 0 0 12px rgba(255, 85, 85, 0.5); }',
        '.dip-cheat-warning { font-size: 0.75rem; color: #ff7b72; background: rgba(248, 81, 73, 0.1); border: 1px solid rgba(248, 81, 73, 0.4); padding: 8px 12px; border-radius: 6px; line-height: 1.4; }'
      ].join('\n');
      document.head.appendChild(style);
    },

    injectTriggerButton: function () {
      var controlsContainer = document.querySelector('.modal-controls');
      if (!controlsContainer || document.getElementById('modal-dip-switch-btn')) return;

      var btn = document.createElement('button');
      btn.className = 'btn btn-sm btn-icon';
      btn.id = 'modal-dip-switch-btn';
      btn.title = 'Arcade Cabinet DIP Switches (Cheats & Modifiers)';
      btn.setAttribute('aria-label', 'Arcade Cabinet DIP Switches');
      btn.innerHTML = [
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">',
        '  <rect x="2" y="6" width="20" height="12" rx="2"></rect>',
        '  <circle cx="7" cy="12" r="2"></circle>',
        '  <circle cx="12" cy="12" r="2"></circle>',
        '  <circle cx="17" cy="12" r="2"></circle>',
        '</svg>'
      ].join('');

      var keybindsBtn = document.getElementById('modal-keybinds-btn');
      if (keybindsBtn && keybindsBtn.parentNode) {
        keybindsBtn.parentNode.insertBefore(btn, keybindsBtn.nextSibling);
      } else {
        controlsContainer.appendChild(btn);
      }

      btn.addEventListener('click', function () {
        DipSwitchEngine.openModal();
      });
    },

    injectModal: function () {
      if (document.getElementById('dip-modal-overlay')) return;

      var overlay = document.createElement('div');
      overlay.className = 'dip-modal-overlay';
      overlay.id = 'dip-modal-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', 'Arcade Cabinet DIP Switches');

      overlay.innerHTML = [
        '<div class="dip-dialog">',
        '  <div class="dip-header">',
        '    <h3>',
        '      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">',
        '        <rect x="2" y="6" width="20" height="12" rx="2"></rect>',
        '        <line x1="6" y1="12" x2="6" y2="12"></line>',
        '        <line x1="10" y1="12" x2="10" y2="12"></line>',
        '        <line x1="14" y1="12" x2="14" y2="12"></line>',
        '        <line x1="18" y1="12" x2="18" y2="12"></line>',
        '      </svg>',
        '      <span>PCB DIP SWITCH BANK #1</span>',
        '    </h3>',
        '    <span class="dip-header-status clean" id="dip-board-status">RANKED / CLEAN</span>',
        '  </div>',
        '  <div class="dip-pcb-body">',
        '    <div class="dip-cheat-warning">',
        '      ATTENTION: Toggling hardware DIP switches alters the simulation engine. Any active modifier flags your gameplay run as UNRANKED and disables leaderboard score submissions.',
        '    </div>',
        '    <div class="dip-pcb-housing" id="dip-switches-container">',
        '      <div class="dip-housing-title">ARCADE PCB 8-PIN ROCKER MATRIX</div>',
        '    </div>',
        '  </div>',
        '  <div class="dip-footer">',
        '    <button class="dip-footer-btn" id="dip-reset-all-btn">Reset All OFF</button>',
        '    <button class="dip-footer-btn primary" id="dip-close-btn">Done</button>',
        '  </div>',
        '</div>'
      ].join('');

      document.body.appendChild(overlay);

      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) DipSwitchEngine.closeModal();
      });

      var closeBtn = document.getElementById('dip-close-btn');
      if (closeBtn) closeBtn.addEventListener('click', function () { DipSwitchEngine.closeModal(); });

      var resetBtn = document.getElementById('dip-reset-all-btn');
      if (resetBtn) resetBtn.addEventListener('click', function () { DipSwitchEngine.resetAll(); });

      this.renderSwitches();
    },

    renderSwitches: function () {
      var container = document.getElementById('dip-switches-container');
      if (!container) return;

      var existingRows = container.querySelectorAll('.dip-switch-row');
      existingRows.forEach(function (r) { r.remove(); });

      var anyActive = false;

      DIP_SWITCHES.forEach(function (sw) {
        var isOn = !!state[sw.id];
        if (isOn) anyActive = true;

        var row = document.createElement('div');
        row.className = 'dip-switch-row';

        row.innerHTML = [
          '<div class="dip-switch-meta">',
          '  <span class="dip-switch-label">SW' + sw.num + ': ' + sw.label + '</span>',
          '  <span class="dip-switch-desc">' + sw.desc + '</span>',
          '</div>',
          '<div class="dip-rocker-wrapper">',
          '  <span class="dip-pos-indicator ' + (isOn ? 'on' : '') + '">' + (isOn ? 'ON' : 'OFF') + '</span>',
          '  <button class="dip-switch-btn ' + (isOn ? 'active' : '') + '" data-switch-id="' + sw.id + '" aria-pressed="' + isOn + '"></button>',
          '</div>'
        ].join('');

        var toggleBtn = row.querySelector('.dip-switch-btn');
        toggleBtn.addEventListener('click', function () {
          DipSwitchEngine.toggleSwitch(sw.id);
        });

        container.appendChild(row);
      });

      var statusEl = document.getElementById('dip-board-status');
      if (statusEl) {
        if (anyActive) {
          statusEl.className = 'dip-header-status cheated';
          statusEl.textContent = 'UNRANKED / MODS ON';
        } else {
          statusEl.className = 'dip-header-status clean';
          statusEl.textContent = 'RANKED / CLEAN';
        }
      }
    },

    toggleSwitch: function (switchId) {
      state[switchId] = !state[switchId];
      this.playClickSound(state[switchId]);
      this.saveState();
      this.renderSwitches();
      this.broadcastModifiers();
    },

    resetAll: function () {
      DIP_SWITCHES.forEach(function (sw) {
        state[sw.id] = false;
      });
      this.playClickSound(false);
      this.saveState();
      this.renderSwitches();
      this.broadcastModifiers();
    },

    broadcastModifiers: function () {
      var iframe = document.getElementById('game-frame');
      var anyActive = false;
      for (var k in state) {
        if (state[k]) { anyActive = true; break; }
      }

      if (iframe && iframe.contentWindow) {
        try {
          iframe.contentWindow.postMessage({
            type: 'ARCADEVERSE_MODIFIERS',
            modifiers: Object.assign({}, state),
            isUnranked: anyActive
          }, '*');
        } catch (e) {}
      }

      // Also dispatch custom event for site components
      window.dispatchEvent(new CustomEvent('arcadeverse:modifiers-changed', {
        detail: { modifiers: Object.assign({}, state), isUnranked: anyActive }
      }));
    },

    openModal: function () {
      this.loadState();
      this.renderSwitches();
      var overlay = document.getElementById('dip-modal-overlay');
      if (overlay) overlay.classList.add('active');
    },

    closeModal: function () {
      var overlay = document.getElementById('dip-modal-overlay');
      if (overlay) overlay.classList.remove('active');
    },

    attachListeners: function () {
      window.addEventListener('arcadeverse:game-launched', function () {
        setTimeout(function () {
          DipSwitchEngine.broadcastModifiers();
        }, 350);
      });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      DipSwitchEngine.init();
    });
  } else {
    DipSwitchEngine.init();
  }

  window.DipSwitchEngine = DipSwitchEngine;
})();
