/**
 * ArcadeVerse Virtual Arcade Pinball Dual Flipper & Haptic Spring Plunger Touch Controls (#1104)
 *
 * Architecture:
 * 1. Auto-Detection: Automatically activates on touch devices when a game in "Pinball", "Physics",
 *    or games with pinball mechanics are launched.
 * 2. Ergonomic Dual-Flipper Zones: Splits lower screen into left and right transparent touch zones
 *    with independent multi-touch tracking (Set-based touch tracking) for simultaneous actuation.
 * 3. Spring Plunger (Hooke's Law F = -kx): Pull-and-release vertical slider with spring compression,
 *    dynamic power gauge, and launch impulse calculation.
 * 4. Web Haptics Engine: Subtle haptic vibration pulses (navigator.vibrate([15])) on flipper taps
 *    and proportional feedback on spring plunger release.
 * 5. Input Dispatch: Dispatches KeyboardEvents (ArrowLeft/KeyA/KeyZ, ArrowRight/KeyD/Slash, Space)
 *    and postMessages to the active game iframe.
 *
 * Strictly zero Unicode emojis across all code, comments, styles, and UI elements.
 */

(function (root, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory();
  } else {
    const api = factory();
    root.PinballTouchController = api;
    root.ArcadePinballControls = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MAX_PLUNGER_PULL = 120; // 120px max pull distance
  const SPRING_CONSTANT_K = 1.0; // Hooke's law k factor
  const DEFAULT_HAPTIC_DURATION = 15; // 15ms pulse

  // Pinball Game Classifier
  function isPinballGame(game) {
    if (!game) return false;
    const cat = String(game.category || '').toLowerCase();
    const title = String(game.title || '').toLowerCase();
    const desc = String(game.description || '').toLowerCase();
    const id = String(game.id || '').toLowerCase();

    return cat.includes('pinball') ||
      cat.includes('physics') ||
      title.includes('pinball') ||
      title.includes('pachinko') ||
      title.includes('flipper') ||
      desc.includes('pinball') ||
      desc.includes('pachinko') ||
      desc.includes('flipper') ||
      id.includes('pinball') ||
      id.includes('pachinko') ||
      id.includes('flipper');
  }

  // Touch capability detector
  function isTouchDevice() {
    if (typeof window === 'undefined') return false;
    return Boolean(
      ('ontouchstart' in window) ||
      (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) ||
      (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
    );
  }

  /**
   * Calculates launch force based on Hooke's Law (F = -kx).
   *
   * @param {number} pullDistance Downward drag distance in pixels
   * @param {number} [maxPull=120] Maximum compression distance
   * @param {number} [k=1.0] Spring stiffness constant
   * @returns {object} Calculated compression ratio, force, and launch velocity
   */
  function calculatePlungerForce(pullDistance, maxPull = MAX_PLUNGER_PULL, k = SPRING_CONSTANT_K) {
    const clampedDistance = Math.max(0, Math.min(maxPull, Number(pullDistance) || 0));
    const compressionRatio = maxPull > 0 ? clampedDistance / maxPull : 0;
    const force = k * compressionRatio;
    const velocity = compressionRatio * 100; // 0 to 100% velocity

    return {
      distance: clampedDistance,
      compressionRatio: Number(compressionRatio.toFixed(3)),
      force: Number(force.toFixed(3)),
      velocity: Number(velocity.toFixed(1))
    };
  }

  /**
   * Safely dispatches Web Haptics vibration pulse.
   *
   * @param {number|number[]} pattern Duration in milliseconds or pulse pattern
   * @returns {boolean} True if vibration was dispatched
   */
  function triggerHaptic(pattern = DEFAULT_HAPTIC_DURATION) {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        return Boolean(navigator.vibrate(pattern));
      } catch (_) {
        return false;
      }
    }
    return false;
  }

  /**
   * Core Pinball Controller State
   */
  class PinballController {
    constructor(options = {}) {
      this.enabled = options.autoEnable !== false;
      this.forceDesktop = Boolean(options.forceDesktop);
      this.mounted = false;
      this.visible = false;
      this.activeGame = null;

      // Independent multi-touch sets for zero lag & multi-finger chord safety
      this.leftTouchIds = new Set();
      this.rightTouchIds = new Set();
      this.plungerTouchId = null;
      this.plungerStartY = 0;
      this.currentPlungerDistance = 0;

      // Flipper states
      this.leftFlipperActive = false;
      this.rightFlipperActive = false;

      // DOM Elements
      this.overlayEl = null;
      this.leftZoneEl = null;
      this.rightZoneEl = null;
      this.plungerContainerEl = null;
      this.plungerHandleEl = null;
      this.plungerSpringEl = null;
      this.plungerMeterEl = null;
      this.toggleBtnEl = null;

      // Bound event listeners
      this._boundTouchStart = this.handleTouchStart.bind(this);
      this._boundTouchMove = this.handleTouchMove.bind(this);
      this._boundTouchEnd = this.handleTouchEnd.bind(this);
      this._boundTouchCancel = this.handleTouchCancel.bind(this);
    }

    /**
     * Resolves the target game window for KeyboardEvent and postMessage dispatch.
     */
    getTargetWindow() {
      if (typeof document === 'undefined') return null;
      const iframe = document.getElementById('game-iframe') || document.getElementById('game-frame');
      if (iframe && iframe.contentWindow) {
        return iframe.contentWindow;
      }
      return typeof window !== 'undefined' ? window : null;
    }

    /**
     * Synthesizes and dispatches KeyboardEvents to target window and local document.
     */
    dispatchKey(key, code, type) {
      const win = this.getTargetWindow();
      if (!win) return;

      const eventInit = {
        key,
        code,
        bubbles: true,
        cancelable: true
      };

      try {
        const evt = new win.KeyboardEvent(type, eventInit);
        (win.document || win).dispatchEvent(evt);
      } catch (_) {
        try {
          const fallbackEvt = new KeyboardEvent(type, eventInit);
          document.dispatchEvent(fallbackEvt);
        } catch (__) {}
      }
    }

    /**
     * Sets left flipper state (press or release).
     */
    setLeftFlipper(active) {
      if (this.leftFlipperActive === active) return;
      this.leftFlipperActive = active;

      const type = active ? 'keydown' : 'keyup';
      // Dispatch ArrowLeft, KeyA, KeyZ for universal compatibility across games
      this.dispatchKey('ArrowLeft', 'ArrowLeft', type);
      this.dispatchKey('a', 'KeyA', type);
      this.dispatchKey('z', 'KeyZ', type);

      if (this.leftZoneEl) {
        if (active) {
          this.leftZoneEl.classList.add('flipper-active');
        } else {
          this.leftZoneEl.classList.remove('flipper-active');
        }
      }

      if (active) {
        triggerHaptic(DEFAULT_HAPTIC_DURATION);
      }

      this.notifyGameMessage('flipper_left', active);
    }

    /**
     * Sets right flipper state (press or release).
     */
    setRightFlipper(active) {
      if (this.rightFlipperActive === active) return;
      this.rightFlipperActive = active;

      const type = active ? 'keydown' : 'keyup';
      // Dispatch ArrowRight, KeyD, Slash
      this.dispatchKey('ArrowRight', 'ArrowRight', type);
      this.dispatchKey('d', 'KeyD', type);
      this.dispatchKey('/', 'Slash', type);

      if (this.rightZoneEl) {
        if (active) {
          this.rightZoneEl.classList.add('flipper-active');
        } else {
          this.rightZoneEl.classList.remove('flipper-active');
        }
      }

      if (active) {
        triggerHaptic(DEFAULT_HAPTIC_DURATION);
      }

      this.notifyGameMessage('flipper_right', active);
    }

    /**
     * Fires spring plunger launch impulse.
     */
    firePlunger(pullDistance) {
      const physics = calculatePlungerForce(pullDistance, MAX_PLUNGER_PULL, SPRING_CONSTANT_K);
      if (physics.compressionRatio <= 0.05) return physics; // Ignore tiny accidental drags

      // Dispatch Space key impulse
      this.dispatchKey(' ', 'Space', 'keydown');
      setTimeout(() => {
        this.dispatchKey(' ', 'Space', 'keyup');
      }, 150);

      // Discretionary ArrowDown impulse
      this.dispatchKey('ArrowDown', 'ArrowDown', 'keydown');
      setTimeout(() => {
        this.dispatchKey('ArrowDown', 'ArrowDown', 'keyup');
      }, 150);

      // Proportional haptic response (e.g. 15ms to 40ms pulse)
      const hapticDuration = Math.round(15 + physics.compressionRatio * 25);
      triggerHaptic(hapticDuration);

      // PostMessage payload with launch physics
      this.notifyGameMessage('plunger_launch', true, physics);

      return physics;
    }

    /**
     * Sends standardized postMessage event to active iframe.
     */
    notifyGameMessage(action, state, data = {}) {
      const win = this.getTargetWindow();
      if (win && typeof win.postMessage === 'function') {
        win.postMessage({
          type: 'ARCADEVERSE_PINBALL_INPUT',
          action,
          state,
          ...data
        }, '*');
      }
    }

    /**
     * Touchstart event handler.
     */
    handleTouchStart(e) {
      if (!this.visible || !e.changedTouches) return;

      const plungerRect = this.plungerContainerEl ? this.plungerContainerEl.getBoundingClientRect() : null;
      const leftRect = this.leftZoneEl ? this.leftZoneEl.getBoundingClientRect() : null;
      const rightRect = this.rightZoneEl ? this.rightZoneEl.getBoundingClientRect() : null;

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const tx = touch.clientX;
        const ty = touch.clientY;

        // 1. Check Plunger Area
        if (plungerRect && tx >= plungerRect.left && tx <= plungerRect.right && ty >= plungerRect.top && ty <= plungerRect.bottom) {
          if (this.plungerTouchId === null) {
            this.plungerTouchId = touch.identifier;
            this.plungerStartY = ty;
            this.currentPlungerDistance = 0;
            this.updatePlungerVisual(0);
            if (e.cancelable) e.preventDefault();
            continue;
          }
        }

        // 2. Check Left Flipper Zone
        if (leftRect && tx >= leftRect.left && tx <= leftRect.right && ty >= leftRect.top && ty <= leftRect.bottom) {
          this.leftTouchIds.add(touch.identifier);
          this.setLeftFlipper(true);
          if (e.cancelable) e.preventDefault();
          continue;
        }

        // 3. Check Right Flipper Zone
        if (rightRect && tx >= rightRect.left && tx <= rightRect.right && ty >= rightRect.top && ty <= rightRect.bottom) {
          this.rightTouchIds.add(touch.identifier);
          this.setRightFlipper(true);
          if (e.cancelable) e.preventDefault();
          continue;
        }
      }
    }

    /**
     * Touchmove event handler (Plunger spring compression).
     */
    handleTouchMove(e) {
      if (!this.visible || this.plungerTouchId === null || !e.changedTouches) return;

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.plungerTouchId) {
          const dy = Math.max(0, touch.clientY - this.plungerStartY);
          this.currentPlungerDistance = Math.min(MAX_PLUNGER_PULL, dy);
          this.updatePlungerVisual(this.currentPlungerDistance);
          if (e.cancelable) e.preventDefault();
          break;
        }
      }
    }

    /**
     * Touchend event handler.
     */
    handleTouchEnd(e) {
      if (!this.visible || !e.changedTouches) return;

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const tid = touch.identifier;

        // Plunger release
        if (tid === this.plungerTouchId) {
          this.firePlunger(this.currentPlungerDistance);
          this.plungerTouchId = null;
          this.currentPlungerDistance = 0;
          this.snapBackPlungerVisual();
          continue;
        }

        // Left Flipper release
        if (this.leftTouchIds.has(tid)) {
          this.leftTouchIds.delete(tid);
          if (this.leftTouchIds.size === 0) {
            this.setLeftFlipper(false);
          }
        }

        // Right Flipper release
        if (this.rightTouchIds.has(tid)) {
          this.rightTouchIds.delete(tid);
          if (this.rightTouchIds.size === 0) {
            this.setRightFlipper(false);
          }
        }
      }
    }

    /**
     * Touchcancel safety handler.
     */
    handleTouchCancel(e) {
      this.handleTouchEnd(e);
      this.releaseAll();
    }

    /**
     * Releases all touches and keys cleanly.
     */
    releaseAll() {
      this.leftTouchIds.clear();
      this.rightTouchIds.clear();
      this.plungerTouchId = null;
      this.currentPlungerDistance = 0;
      this.setLeftFlipper(false);
      this.setRightFlipper(false);
      this.snapBackPlungerVisual();
    }

    /**
     * Updates plunger handle position, spring compression, and tension meter.
     */
    updatePlungerVisual(distance) {
      if (!this.plungerHandleEl) return;

      const ratio = Math.max(0, Math.min(1, distance / MAX_PLUNGER_PULL));
      this.plungerHandleEl.style.transform = `translateY(${distance}px)`;

      if (this.plungerSpringEl) {
        // Compress spring height vertically
        const scaleY = Math.max(0.3, 1 - ratio * 0.7);
        this.plungerSpringEl.style.transform = `scaleY(${scaleY})`;
      }

      if (this.plungerMeterEl) {
        const pct = Math.round(ratio * 100);
        this.plungerMeterEl.style.height = `${pct}%`;
        if (pct > 75) {
          this.plungerMeterEl.style.background = '#ef4444';
          this.plungerMeterEl.style.boxShadow = '0 0 10px #ef4444';
        } else if (pct > 40) {
          this.plungerMeterEl.style.background = '#f59e0b';
          this.plungerMeterEl.style.boxShadow = '0 0 10px #f59e0b';
        } else {
          this.plungerMeterEl.style.background = '#00f0ff';
          this.plungerMeterEl.style.boxShadow = '0 0 10px #00f0ff';
        }
      }
    }

    /**
     * Snaps plunger back with spring bounce animation.
     */
    snapBackPlungerVisual() {
      if (!this.plungerHandleEl) return;

      this.plungerHandleEl.classList.add('snapping');
      this.plungerHandleEl.style.transform = 'translateY(0px)';

      if (this.plungerSpringEl) {
        this.plungerSpringEl.classList.add('snapping');
        this.plungerSpringEl.style.transform = 'scaleY(1)';
      }

      if (this.plungerMeterEl) {
        this.plungerMeterEl.style.height = '0%';
      }

      setTimeout(() => {
        if (this.plungerHandleEl) this.plungerHandleEl.classList.remove('snapping');
        if (this.plungerSpringEl) this.plungerSpringEl.classList.remove('snapping');
      }, 250);
    }

    /**
     * Mounts the touch controls DOM overlay into #game-modal.
     */
    mount() {
      if (typeof document === 'undefined' || this.mounted) return;

      const modal = document.getElementById('game-modal');
      const frameWrapper = document.querySelector('#game-modal .modal-frame-wrapper') || modal;
      if (!frameWrapper) return;

      const overlay = document.createElement('div');
      overlay.id = 'pinball-touch-overlay';
      overlay.className = 'pinball-touch-overlay';
      overlay.setAttribute('role', 'region');
      overlay.setAttribute('aria-label', 'Pinball Touch Controller');
      overlay.style.display = 'none';

      overlay.innerHTML = `
        <!-- Left Flipper Touch Half -->
        <div class="pinball-flipper-zone pinball-zone-left" id="pinball-zone-left" aria-label="Left Flipper">
          <div class="flipper-indicator flipper-indicator-left">
            <svg width="44" height="24" viewBox="0 0 44 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M4 12 C14 8, 30 5, 40 18" stroke-linecap="round"></path>
              <circle cx="4" cy="12" r="3" fill="currentColor"></circle>
            </svg>
            <span class="flipper-label">LEFT FLIPPER</span>
          </div>
        </div>

        <!-- Right Flipper Touch Half -->
        <div class="pinball-flipper-zone pinball-zone-right" id="pinball-zone-right" aria-label="Right Flipper">
          <div class="flipper-indicator flipper-indicator-right">
            <span class="flipper-label">RIGHT FLIPPER</span>
            <svg width="44" height="24" viewBox="0 0 44 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M40 12 C30 8, 14 5, 4 18" stroke-linecap="round"></path>
              <circle cx="40" cy="12" r="3" fill="currentColor"></circle>
            </svg>
          </div>
        </div>

        <!-- Spring-Loaded Plunger Column -->
        <div class="pinball-plunger-column" id="pinball-plunger-container" aria-label="Spring Plunger">
          <div class="plunger-track">
            <div class="plunger-tension-meter">
              <div class="plunger-tension-fill" id="plunger-tension-fill"></div>
            </div>
            <div class="plunger-spring" id="plunger-spring">
              <svg width="18" height="60" viewBox="0 0 18 60" fill="none" stroke="#94a3b8" stroke-width="2">
                <path d="M9 0 L15 6 L3 12 L15 18 L3 24 L15 30 L3 36 L15 42 L3 48 L15 54 L9 60"></path>
              </svg>
            </div>
            <div class="plunger-knob" id="plunger-knob">
              <div class="plunger-knob-handle">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <polyline points="7 13 12 18 17 13"></polyline>
                  <polyline points="7 6 12 11 17 6"></polyline>
                </svg>
              </div>
              <span class="plunger-knob-label">PULL</span>
            </div>
          </div>
        </div>
      `;

      frameWrapper.appendChild(overlay);

      this.overlayEl = overlay;
      this.leftZoneEl = document.getElementById('pinball-zone-left');
      this.rightZoneEl = document.getElementById('pinball-zone-right');
      this.plungerContainerEl = document.getElementById('pinball-plunger-container');
      this.plungerHandleEl = document.getElementById('plunger-knob');
      this.plungerSpringEl = document.getElementById('plunger-spring');
      this.plungerMeterEl = document.getElementById('plunger-tension-fill');

      // Bind touch events to overlay
      overlay.addEventListener('touchstart', this._boundTouchStart, { passive: false });
      overlay.addEventListener('touchmove', this._boundTouchMove, { passive: false });
      overlay.addEventListener('touchend', this._boundTouchEnd, { passive: false });
      overlay.addEventListener('touchcancel', this._boundTouchCancel, { passive: false });

      // In-modal toggle button for manual override
      this.injectToggleButton();

      this.mounted = true;
    }

    /**
     * Injects a quick manual toggle button in the modal controls.
     */
    injectToggleButton() {
      const modalControls = document.querySelector('#game-modal .modal-controls');
      if (!modalControls || document.getElementById('pinball-controls-toggle')) return;

      const toggleBtn = document.createElement('button');
      toggleBtn.id = 'pinball-controls-toggle';
      toggleBtn.className = 'btn btn-sm btn-icon';
      toggleBtn.title = 'Toggle Virtual Pinball Touch Controls';
      toggleBtn.setAttribute('aria-label', 'Toggle Pinball Touch Controls');
      toggleBtn.style.display = 'none';

      toggleBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="16"></line>
          <line x1="8" y1="12" x2="16" y2="12"></line>
        </svg>
      `;

      const reloadBtn = document.getElementById('reload-btn');
      if (reloadBtn) {
        modalControls.insertBefore(toggleBtn, reloadBtn);
      } else {
        modalControls.appendChild(toggleBtn);
      }

      toggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.visible) {
          this.hide();
        } else {
          this.show();
        }
      });

      this.toggleBtnEl = toggleBtn;
    }

    /**
     * Shows the pinball touch controls.
     */
    show() {
      this.mount();
      if (this.overlayEl) {
        this.overlayEl.style.display = 'flex';
        this.visible = true;
      }
      if (this.toggleBtnEl) {
        this.toggleBtnEl.style.display = 'inline-flex';
        this.toggleBtnEl.classList.add('active');
      }
    }

    /**
     * Hides the pinball touch controls and releases keys.
     */
    hide() {
      if (this.overlayEl) {
        this.overlayEl.style.display = 'none';
        this.visible = false;
      }
      if (this.toggleBtnEl) {
        this.toggleBtnEl.classList.remove('active');
      }
      this.releaseAll();
    }

    /**
     * Handles game launch lifecycle event.
     */
    onGameLaunch(game) {
      this.activeGame = game;
      const isPinball = isPinballGame(game);
      const touchReady = isTouchDevice() || this.forceDesktop;

      if (isPinball && touchReady && this.enabled) {
        this.show();
      } else {
        this.hide();
        if (!isPinball && this.toggleBtnEl) {
          this.toggleBtnEl.style.display = 'none';
        }
      }
    }

    /**
     * Handles game close lifecycle event.
     */
    onGameClose() {
      this.activeGame = null;
      this.hide();
      if (this.toggleBtnEl) {
        this.toggleBtnEl.style.display = 'none';
      }
    }
  }

  // Global singleton
  let controllerInstance = null;

  function getInstance(options) {
    if (!controllerInstance) {
      controllerInstance = new PinballController(options);
    }
    return controllerInstance;
  }

  /**
   * Initializes listeners and global hooks.
   */
  function init() {
    if (typeof window === 'undefined') return;

    const controller = getInstance();

    window.addEventListener('arcadeverse:game-launched', (e) => {
      controller.onGameLaunch(e.detail);
    });

    window.addEventListener('arcadeverse:game-closed', () => {
      controller.onGameClose();
    });
  }

  // Auto-bootstrap in browser environment
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  return {
    PinballController,
    isPinballGame,
    isTouchDevice,
    calculatePlungerForce,
    triggerHaptic,
    getInstance,
    init,
    show: () => getInstance().show(),
    hide: () => getInstance().hide()
  };
});
