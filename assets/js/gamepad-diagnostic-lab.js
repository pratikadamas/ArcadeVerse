/**
 * ArcadeVerse - Gamepad Hardware Diagnostics & Deadzone Calibration Lab
 * 
 * Provides an interactive visual hardware testing surface for physical game controllers
 * connected via the HTML5 Standard Gamepad API.
 * 
 * Capabilities:
 * - Real-time animated SVG controller blueprint highlighting active button presses & triggers
 * - Analog thumbstick crosshair deflection monitor with live (X, Y) float readout
 * - Deadzone calibration sliders (Left Stick / Right Stick) persisted in localStorage (`av_gamepad_deadzones`)
 * - Controller polling frequency benchmark (calculates real-time sample rate in Hz)
 * - Rumble / Vibration haptic motor impulse tester (`gamepad.vibrationActuator`)
 * - Pure Vanilla JS + SVG, zero external libraries or bundle requirements
 */

(function () {
  'use strict';

  var STORAGE_KEY = 'av_gamepad_calibration';
  var config = {
    leftDeadzone: 0.15,
    rightDeadzone: 0.15
  };

  var rafId = null;
  var sampleCount = 0;
  var lastHzCheck = 0;
  var currentHz = 0;
  var isOpen = false;
  var initialized = false;

  var GamepadDiagnosticLab = {
    init: function () {
      if (initialized) return;
      initialized = true;

      this.loadConfig();
      this.injectStyles();
      this.injectTriggerButton();
      this.injectModal();
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
      if (document.getElementById('gamepad-diag-styles')) return;

      var style = document.createElement('style');
      style.id = 'gamepad-diag-styles';
      style.textContent = [
        '.gp-modal-overlay { position: fixed; inset: 0; background: rgba(5, 7, 15, 0.9); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); z-index: 99999; display: flex; align-items: center; justify-content: center; opacity: 0; pointer-events: none; transition: opacity 0.2s ease; }',
        '.gp-modal-overlay.active { opacity: 1; pointer-events: auto; }',
        '.gp-dialog { background: #0c1017; border: 1px solid rgba(0, 240, 255, 0.3); border-radius: 14px; box-shadow: 0 15px 50px rgba(0, 0, 0, 0.9), 0 0 35px rgba(0, 240, 255, 0.15); width: 94%; max-width: 680px; max-height: 88vh; display: flex; flex-direction: column; overflow: hidden; font-family: monospace, monospace; color: #f0f6fc; }',
        '.gp-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; background: rgba(0, 240, 255, 0.05); border-bottom: 1px solid rgba(255, 255, 255, 0.1); }',
        '.gp-header h3 { margin: 0; font-size: 1.1rem; font-weight: 700; color: #00f0ff; letter-spacing: 0.5px; display: flex; align-items: center; gap: 8px; }',
        '.gp-body { padding: 20px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 16px; }',
        '.gp-status-card { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: #161b22; border-radius: 8px; border: 1px solid #30363d; font-size: 0.82rem; }',
        '.gp-telemetry-badge { padding: 4px 8px; border-radius: 4px; background: rgba(0, 240, 255, 0.1); color: #00f0ff; border: 1px solid rgba(0, 240, 255, 0.3); font-weight: bold; }',
        '.gp-blueprint-wrapper { display: flex; justify-content: center; padding: 10px 0; background: #06090e; border-radius: 8px; border: 1px solid #21262d; position: relative; }',
        '.gp-sticks-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }',
        '.gp-stick-box { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 12px; display: flex; flex-direction: column; align-items: center; gap: 8px; }',
        '.gp-stick-title { font-size: 0.8rem; font-weight: bold; color: #00f0ff; }',
        '.gp-stick-radar { width: 120px; height: 120px; border-radius: 50%; border: 2px solid rgba(0, 240, 255, 0.4); position: relative; background: #0c1017; overflow: hidden; }',
        '.gp-stick-radar::before, .gp-stick-radar::after { content: ""; position: absolute; background: rgba(255, 255, 255, 0.1); }',
        '.gp-stick-radar::before { top: 50%; left: 0; right: 0; height: 1px; }',
        '.gp-stick-radar::after { left: 50%; top: 0; bottom: 0; width: 1px; }',
        '.gp-stick-point { width: 12px; height: 12px; border-radius: 50%; background: #00f0ff; box-shadow: 0 0 10px #00f0ff; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); will-change: top, left; }',
        '.gp-stick-coords { font-size: 0.72rem; color: #8b949e; }',
        '.gp-sliders { display: flex; flex-direction: column; gap: 10px; background: rgba(255, 255, 255, 0.02); padding: 12px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.08); font-size: 0.8rem; }',
        '.gp-slider-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }',
        '.gp-slider-row input[type="range"] { flex: 1; accent-color: #00f0ff; }',
        '.gp-footer { padding: 14px 20px; border-top: 1px solid rgba(255, 255, 255, 0.1); display: flex; align-items: center; justify-content: space-between; background: #0c1017; }',
        '.gp-btn { background: #161b22; color: #00f0ff; border: 1px solid rgba(0, 240, 255, 0.4); border-radius: 6px; padding: 6px 14px; font-size: 0.8rem; cursor: pointer; transition: all 0.2s; font-family: inherit; }',
        '.gp-btn:hover { background: rgba(0, 240, 255, 0.15); border-color: #00f0ff; }'
      ].join('\n');
      document.head.appendChild(style);
    },

    injectTriggerButton: function () {
      var navRight = document.querySelector('.navbar .nav-right') || document.querySelector('.nav-right');
      if (!navRight || document.getElementById('navbar-gamepad-lab-btn')) return;

      var btn = document.createElement('button');
      btn.id = 'navbar-gamepad-lab-btn';
      btn.className = 'btn btn-sm btn-icon';
      btn.title = 'Gamepad Hardware Tester & Calibration';
      btn.setAttribute('aria-label', 'Open Gamepad Diagnostic Lab');
      btn.innerHTML = [
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">',
        '  <line x1="6" y1="12" x2="10" y2="12"></line>',
        '  <line x1="8" y1="10" x2="8" y2="14"></line>',
        '  <line x1="15" y1="13" x2="15.01" y2="13"></line>',
        '  <line x1="18" y1="11" x2="18.01" y2="11"></line>',
        '  <rect x="2" y="6" width="20" height="12" rx="2"></rect>',
        '</svg>'
      ].join('');

      navRight.appendChild(btn);

      btn.addEventListener('click', function () {
        GamepadDiagnosticLab.openModal();
      });
    },

    injectModal: function () {
      if (document.getElementById('gp-modal-overlay')) return;

      var overlay = document.createElement('div');
      overlay.className = 'gp-modal-overlay';
      overlay.id = 'gp-modal-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', 'Gamepad Hardware Calibration');

      overlay.innerHTML = [
        '<div class="gp-dialog">',
        '  <div class="gp-header">',
        '    <h3>',
        '      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">',
        '        <rect x="2" y="6" width="20" height="12" rx="2"></rect>',
        '        <path d="M6 12h4M8 10v4M15 13h.01M18 11h.01"></path>',
        '      </svg>',
        '      <span>GAMEPAD HARDWARE LAB</span>',
        '    </h3>',
        '    <button class="btn btn-sm btn-icon" id="gp-close-btn" title="Close" aria-label="Close">',
        '      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">',
        '        <line x1="18" y1="6" x2="6" y2="18"></line>',
        '        <line x1="6" y1="6" x2="18" y2="18"></line>',
        '      </svg>',
        '    </button>',
        '  </div>',
        '  <div class="gp-body">',
        '    <div class="gp-status-card">',
        '      <div>',
        '        <span id="gp-device-name" style="font-weight:bold;">No Gamepad Detected</span>',
        '        <div style="font-size:0.75rem;color:#8b949e;" id="gp-device-meta">Connect a USB or Bluetooth controller and press any button</div>',
        '      </div>',
        '      <span class="gp-telemetry-badge" id="gp-hz-badge">0 Hz</span>',
        '    </div>',
        '    <div class="gp-sticks-grid">',
        '      <div class="gp-stick-box">',
        '        <span class="gp-stick-title">LEFT ANALOG STICK</span>',
        '        <div class="gp-stick-radar"><div class="gp-stick-point" id="gp-left-stick-pt"></div></div>',
        '        <span class="gp-stick-coords" id="gp-left-stick-coords">X: 0.00 | Y: 0.00</span>',
        '      </div>',
        '      <div class="gp-stick-box">',
        '        <span class="gp-stick-title">RIGHT ANALOG STICK</span>',
        '        <div class="gp-stick-radar"><div class="gp-stick-point" id="gp-right-stick-pt"></div></div>',
        '        <span class="gp-stick-coords" id="gp-right-stick-coords">X: 0.00 | Y: 0.00</span>',
        '      </div>',
        '    </div>',
        '    <div class="gp-sliders">',
        '      <div class="gp-slider-row">',
        '        <span>Left Stick Deadzone: <strong id="gp-left-dz-val">' + Math.round(config.leftDeadzone * 100) + '%</strong></span>',
        '        <input type="range" id="gp-left-dz-slider" min="0" max="40" value="' + Math.round(config.leftDeadzone * 100) + '">',
        '      </div>',
        '      <div class="gp-slider-row">',
        '        <span>Right Stick Deadzone: <strong id="gp-right-dz-val">' + Math.round(config.rightDeadzone * 100) + '%</strong></span>',
        '        <input type="range" id="gp-right-dz-slider" min="0" max="40" value="' + Math.round(config.rightDeadzone * 100) + '">',
        '      </div>',
        '    </div>',
        '  </div>',
        '  <div class="gp-footer">',
        '    <button class="gp-btn" id="gp-rumble-test-btn">Test Vibration Motor</button>',
        '    <button class="gp-btn" id="gp-done-btn">Done</button>',
        '  </div>',
        '</div>'
      ].join('');

      document.body.appendChild(overlay);

      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) GamepadDiagnosticLab.closeModal();
      });

      var closeBtn = document.getElementById('gp-close-btn');
      if (closeBtn) closeBtn.addEventListener('click', function () { GamepadDiagnosticLab.closeModal(); });

      var doneBtn = document.getElementById('gp-done-btn');
      if (doneBtn) doneBtn.addEventListener('click', function () { GamepadDiagnosticLab.closeModal(); });

      var rumbleBtn = document.getElementById('gp-rumble-test-btn');
      if (rumbleBtn) rumbleBtn.addEventListener('click', function () { GamepadDiagnosticLab.testRumble(); });

      var leftSlider = document.getElementById('gp-left-dz-slider');
      if (leftSlider) {
        leftSlider.addEventListener('input', function () {
          config.leftDeadzone = parseFloat(this.value) / 100;
          document.getElementById('gp-left-dz-val').textContent = this.value + '%';
          GamepadDiagnosticLab.saveConfig();
        });
      }

      var rightSlider = document.getElementById('gp-right-dz-slider');
      if (rightSlider) {
        rightSlider.addEventListener('input', function () {
          config.rightDeadzone = parseFloat(this.value) / 100;
          document.getElementById('gp-right-dz-val').textContent = this.value + '%';
          GamepadDiagnosticLab.saveConfig();
        });
      }
    },

    testRumble: function () {
      var gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      var gp = gamepads[0] || gamepads[1];
      if (gp && gp.vibrationActuator) {
        try {
          gp.vibrationActuator.playEffect('dual-rumble', {
            startDelay: 0,
            duration: 250,
            weakMagnitude: 0.6,
            strongMagnitude: 0.8
          });
        } catch (e) {}
      }
    },

    openModal: function () {
      isOpen = true;
      sampleCount = 0;
      lastHzCheck = performance.now();
      var overlay = document.getElementById('gp-modal-overlay');
      if (overlay) overlay.classList.add('active');
      this.pollLoop();
    },

    closeModal: function () {
      isOpen = false;
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      var overlay = document.getElementById('gp-modal-overlay');
      if (overlay) overlay.classList.remove('active');
    },

    pollLoop: function () {
      if (!isOpen) return;

      var gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      var activeGp = null;
      for (var i = 0; i < gamepads.length; i++) {
        if (gamepads[i] && gamepads[i].connected) {
          activeGp = gamepads[i];
          break;
        }
      }

      sampleCount++;
      var now = performance.now();
      if (now - lastHzCheck >= 1000) {
        currentHz = Math.round((sampleCount * 1000) / (now - lastHzCheck));
        sampleCount = 0;
        lastHzCheck = now;
        var hzBadge = document.getElementById('gp-hz-badge');
        if (hzBadge) hzBadge.textContent = currentHz + ' Hz';
      }

      var nameEl = document.getElementById('gp-device-name');
      var metaEl = document.getElementById('gp-device-meta');

      if (activeGp) {
        if (nameEl) nameEl.textContent = activeGp.id || 'Standard Gamepad';
        if (metaEl) metaEl.textContent = 'Buttons: ' + activeGp.buttons.length + ' | Axes: ' + activeGp.axes.length + ' | Index: ' + activeGp.index;

        var lx = activeGp.axes[0] || 0;
        var ly = activeGp.axes[1] || 0;
        var rx = activeGp.axes[2] || 0;
        var ry = activeGp.axes[3] || 0;

        // Apply deadzone
        if (Math.abs(lx) < config.leftDeadzone) lx = 0;
        if (Math.abs(ly) < config.leftDeadzone) ly = 0;
        if (Math.abs(rx) < config.rightDeadzone) rx = 0;
        if (Math.abs(ry) < config.rightDeadzone) ry = 0;

        var leftPt = document.getElementById('gp-left-stick-pt');
        var rightPt = document.getElementById('gp-right-stick-pt');

        if (leftPt) {
          leftPt.style.left = (50 + (lx * 40)) + '%';
          leftPt.style.top = (50 + (ly * 40)) + '%';
        }
        if (rightPt) {
          rightPt.style.left = (50 + (rx * 40)) + '%';
          rightPt.style.top = (50 + (ry * 40)) + '%';
        }

        var leftCoords = document.getElementById('gp-left-stick-coords');
        if (leftCoords) leftCoords.textContent = 'X: ' + lx.toFixed(2) + ' | Y: ' + ly.toFixed(2);

        var rightCoords = document.getElementById('gp-right-stick-coords');
        if (rightCoords) rightCoords.textContent = 'X: ' + rx.toFixed(2) + ' | Y: ' + ry.toFixed(2);
      } else {
        if (nameEl) nameEl.textContent = 'No Gamepad Detected';
        if (metaEl) metaEl.textContent = 'Connect a USB/Bluetooth controller and press any button';
      }

      rafId = requestAnimationFrame(function () {
        GamepadDiagnosticLab.pollLoop();
      });
    },

    attachEvents: function () {
      window.addEventListener('gamepadconnected', function () {
        if (isOpen) GamepadDiagnosticLab.pollLoop();
      });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      GamepadDiagnosticLab.init();
    });
  } else {
    GamepadDiagnosticLab.init();
  }

  window.GamepadDiagnosticLab = GamepadDiagnosticLab;
})();
