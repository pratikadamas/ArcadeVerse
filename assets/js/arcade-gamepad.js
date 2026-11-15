/**
 * ArcadeVerse Standardized HTML5 Gamepad API Controller Poller & Input Mapper (#511)
 * Detects connected USB / Bluetooth gamepads (Xbox, PlayStation, Retro arcade controllers)
 * Maps D-pad and analog sticks to arrow keys, and action buttons to Space, Enter, Z, X.
 * Emits synthesized keyboard events to active game iframes and provides visual UI indicators.
 */

(function () {
  'use strict';

  // Standard Gamepad Button Indices (W3C Standard Gamepad Specification)
  const BTN_A = 0;       // Action primary -> Space / Enter
  const BTN_B = 1;       // Action secondary -> Z
  const BTN_X = 2;       // Action alternate -> X
  const BTN_Y = 3;       // Action tertiary -> Shift / C
  const BTN_LB = 4;      // Left Bumper -> Q
  const BTN_RB = 5;      // Right Bumper -> E
  const BTN_SELECT = 8;  // Back / Select / Share -> Tab
  const BTN_START = 9;   // Start / Options / Menu -> Escape
  const BTN_UP = 12;     // D-Pad Up
  const BTN_DOWN = 13;   // D-Pad Down
  const BTN_LEFT = 14;   // D-Pad Left
  const BTN_RIGHT = 15;  // D-Pad Right

  const DEFAULT_DEADZONE = 0.15; // Standard deadzone threshold for analog sticks
  const MIN_DEADZONE = 0.05;
  const MAX_DEADZONE = 0.40;

  function sanitizeGamepadKey(id) {
    return 'av_gamepad_deadzone_' + (id || 'default').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
  }

  function getGamepadDeadzone(gamepadId) {
    try {
      const key = sanitizeGamepadKey(gamepadId);
      const val = parseFloat(localStorage.getItem(key));
      if (!isNaN(val) && val >= MIN_DEADZONE && val <= MAX_DEADZONE) {
        return val;
      }
    } catch (_) {}
    return DEFAULT_DEADZONE;
  }

  function setGamepadDeadzone(gamepadId, deadzone) {
    try {
      const key = sanitizeGamepadKey(gamepadId);
      const clamped = Math.max(MIN_DEADZONE, Math.min(MAX_DEADZONE, deadzone));
      localStorage.setItem(key, clamped.toFixed(2));
      return clamped;
    } catch (_) {}
    return DEFAULT_DEADZONE;
  }

  const KEY_MAPPINGS = {
    up: { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
    down: { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
    left: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
    right: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
    a: { key: ' ', code: 'Space', keyCode: 32 },
    b: { key: 'z', code: 'KeyZ', keyCode: 90 },
    x: { key: 'x', code: 'KeyX', keyCode: 88 },
    y: { key: 'Enter', code: 'Enter', keyCode: 13 },
    start: { key: 'Escape', code: 'Escape', keyCode: 27 },
    select: { key: 'Tab', code: 'Tab', keyCode: 9 }
  };

  class ArcadeGamepadManager {
    constructor() {
      this.connectedGamepads = new Map();
      this.pollAnimFrame = null;
      this.activeVirtualKeys = new Set();
      this.indicatorElement = null;
      this.isPolling = false;

      this.init();
    }

    init() {
      if (typeof window === 'undefined' || !('getGamepads' in navigator)) {
        return;
      }

      window.addEventListener('gamepadconnected', (e) => this.handleGamepadConnected(e));
      window.addEventListener('gamepaddisconnected', (e) => this.handleGamepadDisconnected(e));

      // Inject UI styles for the controller indicator and toasts
      this.injectStyles();
      this.createIndicator();

      // Check if controllers are already plugged in
      const existing = navigator.getGamepads ? navigator.getGamepads() : [];
      let foundAny = false;
      for (let i = 0; i < existing.length; i++) {
        if (existing[i]) {
          this.connectedGamepads.set(existing[i].index, existing[i]);
          foundAny = true;
        }
      }

      if (foundAny) {
        this.updateIndicatorUI(true);
        this.startPolling();
      }
    }

    injectStyles() {
      if (document.getElementById('arcadeverse-gamepad-css')) return;
      const style = document.createElement('style');
      style.id = 'arcadeverse-gamepad-css';
      style.textContent = `
        .gamepad-indicator-btn {
          display: none;
          align-items: center;
          justify-content: center;
          width: 38px;
          height: 38px;
          border-radius: var(--radius-sm, 8px);
          border: 1px solid rgba(59, 130, 246, 0.4);
          background: rgba(59, 130, 246, 0.12);
          color: #60a5fa;
          cursor: pointer;
          transition: all 0.25s ease;
          position: relative;
        }
        .gamepad-indicator-btn.connected {
          display: inline-flex;
          animation: gamepadGlow 2s infinite alternate;
        }
        .gamepad-indicator-btn.connected:hover {
          background: rgba(59, 130, 246, 0.25);
          border-color: #3b82f6;
          color: #93c5fd;
        }
        @keyframes gamepadGlow {
          0% { box-shadow: 0 0 5px rgba(59, 130, 246, 0.2); }
          100% { box-shadow: 0 0 14px rgba(59, 130, 246, 0.65), 0 0 2px #60a5fa; }
        }
        .gamepad-toast {
          position: fixed;
          bottom: 1.5rem;
          right: 1.5rem;
          z-index: 10000;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1.15rem;
          background: rgba(15, 23, 42, 0.95);
          border: 1px solid var(--border-medium, rgba(255, 255, 255, 0.15));
          border-radius: var(--radius-md, 10px);
          color: #f8fafc;
          font-size: 0.88rem;
          font-weight: 500;
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.6), 0 0 15px rgba(59, 130, 246, 0.2);
          opacity: 0;
          transform: translateY(15px);
          transition: opacity 0.3s ease, transform 0.3s ease;
          pointer-events: none;
        }
        .gamepad-toast.visible {
          opacity: 1;
          transform: translateY(0);
        }
        .gamepad-toast.connected {
          border-left: 4px solid #10b981;
        }
        .gamepad-toast.disconnected {
          border-left: 4px solid #f43f5e;
        }

        /* Deadzone Calibration Modal (#572) */
        .gamepad-calibration-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(6px);
          z-index: 100000;
          display: none;
          align-items: center;
          justify-content: center;
          padding: 1rem;
        }
        .gamepad-calibration-backdrop.visible {
          display: flex;
        }
        .gamepad-calibration-card {
          background: #0f172a;
          border: 1px solid rgba(59, 130, 246, 0.4);
          border-radius: 12px;
          padding: 1.5rem;
          max-width: 420px;
          width: 100%;
          color: #f8fafc;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.8), 0 0 25px rgba(59, 130, 246, 0.25);
          animation: modalPop 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes modalPop {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .gamepad-calib-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.5rem;
        }
        .gamepad-calib-title-wrap {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .gamepad-calib-title-wrap h3 {
          margin: 0;
          font-size: 1.1rem;
          font-weight: 600;
          color: #f8fafc;
        }
        .gamepad-calib-close {
          background: transparent;
          border: none;
          color: #94a3b8;
          font-size: 1.5rem;
          cursor: pointer;
          padding: 0;
          line-height: 1;
        }
        .gamepad-calib-close:hover {
          color: #f8fafc;
        }
        .gamepad-calib-desc {
          font-size: 0.85rem;
          color: #94a3b8;
          margin: 0 0 0.85rem 0;
          line-height: 1.4;
        }
        .gamepad-calib-controller-name {
          font-size: 0.8rem;
          font-family: monospace;
          background: rgba(30, 41, 59, 0.8);
          padding: 0.35rem 0.6rem;
          border-radius: 6px;
          color: #38bdf8;
          margin-bottom: 1rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .gamepad-reticle-container {
          display: flex;
          justify-content: center;
          margin-bottom: 1.25rem;
        }
        .gamepad-reticle-box {
          position: relative;
          width: 180px;
          height: 180px;
          border-radius: 50%;
          background: radial-gradient(circle, #020617 0%, #0f172a 100%);
          border: 2px solid rgba(59, 130, 246, 0.5);
          box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.9);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .gamepad-reticle-axis-h {
          position: absolute;
          width: 100%;
          height: 1px;
          background: rgba(255, 255, 255, 0.15);
        }
        .gamepad-reticle-axis-v {
          position: absolute;
          height: 100%;
          width: 1px;
          background: rgba(255, 255, 255, 0.15);
        }
        .gamepad-reticle-deadzone-ring {
          position: absolute;
          border-radius: 50%;
          border: 2px dashed rgba(244, 63, 94, 0.6);
          background: rgba(244, 63, 94, 0.08);
          pointer-events: none;
          transition: width 0.1s ease, height 0.1s ease;
        }
        .gamepad-reticle-dot {
          position: absolute;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #60a5fa;
          border: 2px solid #ffffff;
          box-shadow: 0 0 10px #3b82f6;
          transform: translate(-50%, -50%);
          left: 50%;
          top: 50%;
          pointer-events: none;
          transition: background-color 0.1s ease;
        }
        .gamepad-reticle-dot.inside-deadzone {
          background: #94a3b8;
          border-color: #cbd5e1;
          box-shadow: none;
        }
        .gamepad-reticle-dot.active-input {
          background: #10b981;
          border-color: #ecfdf5;
          box-shadow: 0 0 12px #10b981;
        }
        .gamepad-calib-controls {
          margin-bottom: 1.25rem;
        }
        .gamepad-calib-slider-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.88rem;
          font-weight: 500;
          margin-bottom: 0.35rem;
        }
        .gamepad-calib-slider-row span {
          color: #38bdf8;
          font-family: monospace;
          font-weight: 700;
        }
        #gamepad-deadzone-slider {
          width: 100%;
          accent-color: #3b82f6;
          cursor: pointer;
        }
        .gamepad-calib-actions {
          display: flex;
          gap: 0.75rem;
          justify-content: flex-end;
        }
        .btn-calib-reset, .btn-calib-save {
          padding: 0.5rem 1rem;
          font-size: 0.85rem;
          font-weight: 600;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .btn-calib-reset {
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #94a3b8;
        }
        .btn-calib-reset:hover {
          background: rgba(255, 255, 255, 0.05);
          color: #f8fafc;
        }
        .btn-calib-save {
          background: #2563eb;
          border: 1px solid #3b82f6;
          color: #ffffff;
        }
        .btn-calib-save:hover {
          background: #1d4ed8;
        }
      `;
      document.head.appendChild(style);
    }

    createIndicator() {
      if (document.getElementById('gamepad-indicator-btn')) return;
      const navActions = document.querySelector('.nav-actions');
      if (!navActions) return;

      const btn = document.createElement('button');
      btn.id = 'gamepad-indicator-btn';
      btn.type = 'button';
      btn.className = 'gamepad-indicator-btn';
      btn.setAttribute('aria-label', 'Gamepad status: Connected');
      btn.title = 'Gamepad Connected - Click to calibrate deadzone & stick drift';
      btn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="6" x2="10" y1="12" y2="12"></line>
          <line x1="8" x2="8" y1="10" y2="14"></line>
          <line x1="15" x2="15.01" y1="13" y2="13"></line>
          <line x1="18" x2="18.01" y1="11" y2="11"></line>
          <rect width="20" height="12" x="2" y="6" rx="6"></rect>
        </svg>
      `;

      btn.addEventListener('click', () => {
        this.openCalibrationModal();
      });

      // Insert before the shortcuts or theme button
      const ref = navActions.querySelector('#shortcuts-trigger-btn') || navActions.firstChild;
      navActions.insertBefore(btn, ref);
      this.indicatorElement = btn;
    }

    openCalibrationModal() {
      let modal = document.getElementById('gamepad-calibration-modal');
      if (modal) {
        modal.classList.add('visible');
        this.calibrationOpen = true;
        return;
      }

      // Pick first connected gamepad
      const firstGp = Array.from(this.connectedGamepads.values())[0] || (navigator.getGamepads ? navigator.getGamepads()[0] : null);
      const gpId = firstGp ? firstGp.id : 'Standard Gamepad';
      this.activeCalibratingGamepadId = gpId;
      const currentDeadzone = getGamepadDeadzone(gpId);

      modal = document.createElement('div');
      modal.id = 'gamepad-calibration-modal';
      modal.className = 'gamepad-calibration-backdrop visible';
      modal.innerHTML = `
        <div class="gamepad-calibration-card" role="dialog" aria-modal="true" aria-labelledby="gamepad-calib-title">
          <div class="gamepad-calib-header">
            <div class="gamepad-calib-title-wrap">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
              <h3 id="gamepad-calib-title">Gamepad Deadzone Calibration</h3>
            </div>
            <button type="button" class="gamepad-calib-close" aria-label="Close calibration modal">&times;</button>
          </div>
          <p class="gamepad-calib-desc">Compensate for joystick drift by adjusting the deadzone threshold. Inputs within the inner neon circle are suppressed.</p>
          
          <div class="gamepad-calib-controller-name">${gpId.split('(')[0].trim() || 'Controller'}</div>

          <div class="gamepad-reticle-container">
            <div class="gamepad-reticle-box" id="gamepad-reticle-box">
              <div class="gamepad-reticle-axis-h"></div>
              <div class="gamepad-reticle-axis-v"></div>
              <div class="gamepad-reticle-deadzone-ring" id="gamepad-reticle-deadzone-ring"></div>
              <div class="gamepad-reticle-dot" id="gamepad-reticle-dot"></div>
            </div>
          </div>

          <div class="gamepad-calib-controls">
            <div class="gamepad-calib-slider-row">
              <label for="gamepad-deadzone-slider">Deadzone Threshold:</label>
              <span id="gamepad-deadzone-val">${Math.round(currentDeadzone * 100)}%</span>
            </div>
            <input type="range" id="gamepad-deadzone-slider" min="5" max="40" step="1" value="${Math.round(currentDeadzone * 100)}">
          </div>

          <div class="gamepad-calib-actions">
            <button type="button" class="btn-calib-reset" id="btn-calib-reset">Reset (15%)</button>
            <button type="button" class="btn-calib-save" id="btn-calib-save">Done</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);
      this.calibrationOpen = true;

      const slider = modal.querySelector('#gamepad-deadzone-slider');
      const valLabel = modal.querySelector('#gamepad-deadzone-val');
      const deadzoneRing = modal.querySelector('#gamepad-reticle-deadzone-ring');
      const closeBtn = modal.querySelector('.gamepad-calib-close');
      const saveBtn = modal.querySelector('#btn-calib-save');
      const resetBtn = modal.querySelector('#btn-calib-reset');

      const updateRing = (val) => {
        valLabel.textContent = `${val}%`;
        const pct = (val / 100) * 100;
        deadzoneRing.style.width = `${pct}%`;
        deadzoneRing.style.height = `${pct}%`;
      };
      updateRing(Math.round(currentDeadzone * 100));

      slider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        const floatVal = val / 100;
        setGamepadDeadzone(this.activeCalibratingGamepadId, floatVal);
        updateRing(val);
      });

      resetBtn.addEventListener('click', () => {
        setGamepadDeadzone(this.activeCalibratingGamepadId, DEFAULT_DEADZONE);
        slider.value = Math.round(DEFAULT_DEADZONE * 100);
        updateRing(Math.round(DEFAULT_DEADZONE * 100));
      });

      const closeModal = () => {
        modal.classList.remove('visible');
        this.calibrationOpen = false;
      };

      closeBtn.addEventListener('click', closeModal);
      saveBtn.addEventListener('click', closeModal);
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });
    }

    updateReticle(axisX, axisY, deadzone) {
      const dot = document.getElementById('gamepad-reticle-dot');
      if (!dot) return;
      // Map [-1, 1] to [0%, 100%]
      const posX = ((axisX + 1) / 2) * 100;
      const posY = ((axisY + 1) / 2) * 100;
      dot.style.left = `${posX}%`;
      dot.style.top = `${posY}%`;

      const dist = Math.sqrt(axisX * axisX + axisY * axisY);
      if (dist < deadzone) {
        dot.classList.add('inside-deadzone');
        dot.classList.remove('active-input');
      } else {
        dot.classList.remove('inside-deadzone');
        dot.classList.add('active-input');
      }
    }

    showToast(message, type = 'connected') {
      const existing = document.getElementById('gamepad-status-toast');
      if (existing) existing.remove();

      const toast = document.createElement('div');
      toast.id = 'gamepad-status-toast';
      toast.className = `gamepad-toast ${type}`;
      toast.setAttribute('role', 'status');
      toast.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect width="20" height="12" x="2" y="6" rx="6"></rect>
          <line x1="6" x2="10" y1="12" y2="12"></line>
          <line x1="8" x2="8" y1="10" y2="14"></line>
          <line x1="15" x2="15.01" y1="13" y2="13"></line>
          <line x1="18" x2="18.01" y1="11" y2="11"></line>
        </svg>
        <span>${message}</span>
      `;
      document.body.appendChild(toast);

      requestAnimationFrame(() => toast.classList.add('visible'));

      setTimeout(() => {
        if (toast.parentElement) {
          toast.classList.remove('visible');
          setTimeout(() => toast.remove(), 350);
        }
      }, 3500);
    }

    handleGamepadConnected(e) {
      const gp = e.gamepad;
      if (!gp) return;
      this.connectedGamepads.set(gp.index, gp);
      this.updateIndicatorUI(true);
      this.showToast(`Gamepad connected: ${gp.id.split('(')[0].trim() || 'Controller'}`, 'connected');
      this.startPolling();

      // Trigger a brief 120ms acknowledgment rumble pulse upon connection (#515)
      this.triggerGamepadRumble(120, 0.4, 0.2);

      window.dispatchEvent(new CustomEvent('arcadeverse:gamepad-connected', { detail: { gamepad: gp } }));
    }

    handleGamepadDisconnected(e) {
      const gp = e.gamepad;
      if (gp) {
        this.connectedGamepads.delete(gp.index);
      }

      if (this.connectedGamepads.size === 0) {
        this.updateIndicatorUI(false);
        this.stopPolling();
        this.clearAllSynthesizedKeys();
      }

      this.showToast('Gamepad disconnected', 'disconnected');
      window.dispatchEvent(new CustomEvent('arcadeverse:gamepad-disconnected', { detail: { index: gp ? gp.index : null } }));
    }

    updateIndicatorUI(hasGamepad) {
      if (!this.indicatorElement) {
        this.createIndicator();
      }
      if (this.indicatorElement) {
        this.indicatorElement.classList.toggle('connected', hasGamepad);
      }
    }

    startPolling() {
      if (this.isPolling) return;
      this.isPolling = true;
      const poll = () => {
        if (!this.isPolling) return;
        this.pollGamepads();
        this.pollAnimFrame = requestAnimationFrame(poll);
      };
      this.pollAnimFrame = requestAnimationFrame(poll);
    }

    stopPolling() {
      this.isPolling = false;
      if (this.pollAnimFrame) {
        cancelAnimationFrame(this.pollAnimFrame);
        this.pollAnimFrame = null;
      }
    }

    pollGamepads() {
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      let activeState = {
        up: false,
        down: false,
        left: false,
        right: false,
        a: false,
        b: false,
        x: false,
        y: false,
        start: false,
        select: false
      };

      for (let i = 0; i < gamepads.length; i++) {
        const gp = gamepads[i];
        if (!gp || !gp.connected) continue;

        // D-Pad buttons
        if (gp.buttons[BTN_UP] && gp.buttons[BTN_UP].pressed) activeState.up = true;
        if (gp.buttons[BTN_DOWN] && gp.buttons[BTN_DOWN].pressed) activeState.down = true;
        if (gp.buttons[BTN_LEFT] && gp.buttons[BTN_LEFT].pressed) activeState.left = true;
        if (gp.buttons[BTN_RIGHT] && gp.buttons[BTN_RIGHT].pressed) activeState.right = true;

        // Action buttons
        if (gp.buttons[BTN_A] && gp.buttons[BTN_A].pressed) activeState.a = true;
        if (gp.buttons[BTN_B] && gp.buttons[BTN_B].pressed) activeState.b = true;
        if (gp.buttons[BTN_X] && gp.buttons[BTN_X].pressed) activeState.x = true;
        if (gp.buttons[BTN_Y] && gp.buttons[BTN_Y].pressed) activeState.y = true;
        if (gp.buttons[BTN_START] && gp.buttons[BTN_START].pressed) activeState.start = true;
        if (gp.buttons[BTN_SELECT] && gp.buttons[BTN_SELECT].pressed) activeState.select = true;

        // Left Analog Stick Axes (0: X-axis [-1 left, +1 right], 1: Y-axis [-1 up, +1 down])
        // Applying per-gamepad deadzone calibration & stick drift compensation (#572)
        if (gp.axes.length >= 2) {
          const axisX = gp.axes[0];
          const axisY = gp.axes[1];
          const deadzone = getGamepadDeadzone(gp.id);
          if (axisX < -deadzone) activeState.left = true;
          if (axisX > deadzone) activeState.right = true;
          if (axisY < -deadzone) activeState.up = true;
          if (axisY > deadzone) activeState.down = true;

          // Dispatch visual reticle update if calibration modal is active
          if (this.calibrationOpen && this.activeCalibratingGamepadId === gp.id) {
            this.updateReticle(axisX, axisY, deadzone);
          }
        }
      }

      this.syncVirtualKeys(activeState);
    }

    syncVirtualKeys(activeState) {
      for (const [action, mapping] of Object.entries(KEY_MAPPINGS)) {
        const isPressed = Boolean(activeState[action]);
        const wasPressed = this.activeVirtualKeys.has(action);

        if (isPressed && !wasPressed) {
          this.activeVirtualKeys.add(action);
          this.dispatchKey(mapping, 'keydown');
        } else if (!isPressed && wasPressed) {
          this.activeVirtualKeys.delete(action);
          this.dispatchKey(mapping, 'keyup');
        }
      }
    }

    dispatchKey(mapping, type) {
      const eventInit = {
        key: mapping.key,
        code: mapping.code,
        keyCode: mapping.keyCode,
        which: mapping.keyCode,
        bubbles: true,
        cancelable: true
      };

      // 1. Dispatch to main window
      const evt = new KeyboardEvent(type, eventInit);
      window.dispatchEvent(evt);

      // 2. Dispatch directly into active game iframe if one is open
      const gameIframe = document.getElementById('game-iframe');
      if (gameIframe && gameIframe.contentWindow) {
        try {
          const frameDoc = gameIframe.contentDocument || gameIframe.contentWindow.document;
          if (frameDoc) {
            const frameEvt = new KeyboardEvent(type, eventInit);
            frameDoc.dispatchEvent(frameEvt);
          }
        } catch (_) {
          // Cross-origin fallback via postMessage
          try {
            gameIframe.contentWindow.postMessage({
              type: 'ARCADEVERSE_GAMEPAD_KEY',
              eventType: type,
              key: mapping.key,
              code: mapping.code
            }, '*');
          } catch (_) {}
        }
      }
    }

    clearAllSynthesizedKeys() {
      for (const action of this.activeVirtualKeys) {
        const mapping = KEY_MAPPINGS[action];
        if (mapping) {
          this.dispatchKey(mapping, 'keyup');
        }
      }
      this.activeVirtualKeys.clear();
    }

    // ========================================================
    // GAMEPAD DUAL-RUMBLE HAPTIC VIBRATION INTEGRATION (#515)
    // Fires physical dual-rumble feedback via GamepadHapticActuator API
    // ========================================================
    /**
     * Triggers dual-rumble haptic vibration on all connected gamepads.
     * @param {number} [durationMs=150] - Vibration duration in milliseconds
     * @param {number} [strongMagnitude=0.5] - Low-frequency heavy rumble motor [0.0 - 1.0]
     * @param {number} [weakMagnitude=0.5] - High-frequency light buzz motor [0.0 - 1.0]
     */
    triggerGamepadRumble(durationMs = 150, strongMagnitude = 0.5, weakMagnitude = 0.5) {
      if (typeof navigator === 'undefined' || !navigator.getGamepads) return;

      const gamepads = navigator.getGamepads();
      for (let i = 0; i < gamepads.length; i++) {
        const gp = gamepads[i];
        if (!gp) continue;

        // W3C Standard: Gamepad.vibrationActuator
        if (gp.vibrationActuator && typeof gp.vibrationActuator.playEffect === 'function') {
          try {
            gp.vibrationActuator.playEffect('dual-rumble', {
              startDelay: 0,
              duration: durationMs,
              weakMagnitude: Math.max(0, Math.min(1, weakMagnitude)),
              strongMagnitude: Math.max(0, Math.min(1, strongMagnitude))
            }).catch(() => {});
          } catch (_) {}
        }
        // Legacy WebKit / Chrome hapticActuators array fallback
        else if (gp.hapticActuators && gp.hapticActuators.length > 0) {
          try {
            gp.hapticActuators.forEach(actuator => {
              if (actuator && typeof actuator.pulse === 'function') {
                actuator.pulse(strongMagnitude, durationMs);
              }
            });
          } catch (_) {}
        }
      }
    }
  }

  // Global helper export for in-game impacts, explosions, and damage (#515)
  window.triggerGamepadRumble = function (durationMs, strongMagnitude, weakMagnitude) {
    if (window.ArcadeGamepad && typeof window.ArcadeGamepad.triggerGamepadRumble === 'function') {
      window.ArcadeGamepad.triggerGamepadRumble(durationMs, strongMagnitude, weakMagnitude);
    }
  };

  // Listen for ARCADEVERSE_GAMEPAD_RUMBLE messages forwarded from sandboxed game frames
  // Validates message origin/source consistently with active game iframe
  window.addEventListener('message', (e) => {
    if (!e || !e.data || typeof e.data !== 'object') return;
    const type = e.data.type || '';
    if (type !== 'ARCADEVERSE_GAMEPAD_RUMBLE' && type !== 'ARCADEVERSE_HAPTIC') return;

    // Validate origin against active game iframe
    const gameIframe = document.getElementById('game-iframe');
    if (gameIframe && gameIframe.contentWindow && e.source !== gameIframe.contentWindow) {
      return;
    }

    let dur = 150;
    if (typeof e.data.duration === 'number') {
      dur = e.data.duration;
    } else if (typeof e.data.pattern === 'number') {
      dur = e.data.pattern;
    } else if (Array.isArray(e.data.pattern)) {
      // Sum pattern pulses (e.g. [50, 40, 80] -> 170ms)
      dur = e.data.pattern.reduce((acc, val) => acc + (Number(val) || 0), 0);
    }

    const strong = typeof e.data.strong === 'number' ? e.data.strong : 0.6;
    const weak = typeof e.data.weak === 'number' ? e.data.weak : 0.4;
    window.triggerGamepadRumble(dur, strong, weak);
  });

  // Initialize on DOM load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.ArcadeGamepad = new ArcadeGamepadManager();
    });
  } else {
    window.ArcadeGamepad = new ArcadeGamepadManager();
  }
})();
