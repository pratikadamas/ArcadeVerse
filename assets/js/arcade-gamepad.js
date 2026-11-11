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

  const AXIS_THRESHOLD = 0.45; // Deadzone threshold for analog sticks

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
      btn.title = 'Gamepad Connected (Standard Controller Active)';
      btn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="6" x2="10" y1="12" y2="12"></line>
          <line x1="8" x2="8" y1="10" y2="14"></line>
          <line x1="15" x2="15.01" y1="13" y2="13"></line>
          <line x1="18" x2="18.01" y1="11" y2="11"></line>
          <rect width="20" height="12" x="2" y="6" rx="6"></rect>
        </svg>
      `;

      // Insert before the shortcuts or theme button
      const ref = navActions.querySelector('#shortcuts-trigger-btn') || navActions.firstChild;
      navActions.insertBefore(btn, ref);
      this.indicatorElement = btn;
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
        if (gp.axes.length >= 2) {
          const axisX = gp.axes[0];
          const axisY = gp.axes[1];
          if (axisX < -AXIS_THRESHOLD) activeState.left = true;
          if (axisX > AXIS_THRESHOLD) activeState.right = true;
          if (axisY < -AXIS_THRESHOLD) activeState.up = true;
          if (axisY > AXIS_THRESHOLD) activeState.down = true;
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
