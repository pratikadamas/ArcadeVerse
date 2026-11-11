/**
 * ArcadeVerse Universal Virtual Touch D-Pad & Action Buttons Overlay (#517)
 * Provides touch controls for keyboard-centric games on mobile/touchscreen devices.
 * Features smart game detection, user toggle button in header, and robust touch tracking.
 */

(function () {
  'use strict';

  // Games that are mouse/pointer/touch native and do not require virtual keyboard controls
  const TOUCH_NATIVE_GAMES = new Set([
    'dino-dig_mistu7debnath',
    'bubble-burst-arena_mistu7debnath',
    'quantum-2048_babin',
    'neon-solitaire_babin',
    'whack-a-bug_babin',
    'potion-maker_mistu7debnath',
    'potion-panic_joitapaul',
    'fishing-frenzy_mistu7debnath',
    'circuit-connect_arshi',
    'cyber-sudoku_babin',
    'cryptic-wordle_babin',
    'memory-matrix_debasmita',
    'escape-room_debasmita',
    'detective-mystery_babin',
    'code-breaker_babin',
    'hex-match_babin'
  ]);

  class VirtualTouchController {
    constructor() {
      this.overlay = null;
      this.toggleBtn = null;
      this.userEnabled = null; // null = auto, boolean = manual user preference
      this.activeTouches = new Map(); // touchId -> key info
      this.currentActiveGame = null;
      this.init();
    }

    init() {
      if (typeof window === 'undefined') return;

      const hasTouch = ('ontouchstart' in window) ||
        (navigator.maxTouchPoints > 0) ||
        (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

      if (!hasTouch) return;

      this.createOverlay();
      this.createHeaderToggleButton();
      this.bindModalLifecycle();
    }

    isTouchNativeGame(game) {
      if (!game) return false;
      if (TOUCH_NATIVE_GAMES.has(game.id)) return true;

      // Inspect game description / tags for pointer or touch indicators
      const text = ((game.title || '') + ' ' + (game.category || '') + ' ' + (game.description || '') + ' ' + ((game.tags && game.tags.join(' ')) || '')).toLowerCase();
      const isMousePointer = text.includes('mouse') || text.includes('click') || text.includes('touch') || text.includes('drag') || text.includes('tap') || text.includes('board') || text.includes('puzzle') || text.includes('cards');
      const isStrictKeyboard = text.includes('arrow') || text.includes('wasd') || text.includes('keyboard') || text.includes('runner') || text.includes('platformer') || text.includes('spacebar');

      return isMousePointer && !isStrictKeyboard;
    }

    createHeaderToggleButton() {
      const modalControls = document.querySelector('.modal-controls');
      if (!modalControls || document.getElementById('modal-virtual-controller-btn')) return;

      const btn = document.createElement('button');
      btn.id = 'modal-virtual-controller-btn';
      btn.type = 'button';
      btn.className = 'btn btn-sm btn-icon virtual-controller-toggle-btn';
      btn.title = 'Toggle Virtual Touch Controls';
      btn.setAttribute('aria-label', 'Toggle Virtual Touch Controls');
      btn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect width="20" height="12" x="2" y="6" rx="6"></rect>
          <line x1="6" x2="10" y1="12" y2="12"></line>
          <line x1="8" x2="8" y1="10" y2="14"></line>
          <circle cx="16" cy="12" r="1"></circle>
        </svg>
      `;

      btn.addEventListener('click', () => {
        const isCurrentlyActive = this.overlay && this.overlay.classList.contains('active');
        this.userEnabled = !isCurrentlyActive;
        this.updateOverlayVisibility();
      });

      const reloadBtn = document.getElementById('reload-btn');
      if (reloadBtn && reloadBtn.nextSibling) {
        modalControls.insertBefore(btn, reloadBtn.nextSibling);
      } else {
        modalControls.appendChild(btn);
      }
      this.toggleBtn = btn;
    }

    createOverlay() {
      if (document.getElementById('av-virtual-controller')) return;

      const overlay = document.createElement('div');
      overlay.id = 'av-virtual-controller';
      overlay.className = 'av-virtual-controller';
      overlay.setAttribute('aria-hidden', 'true');

      overlay.innerHTML = `
        <div class="virtual-dpad" id="v-dpad">
          <button type="button" class="dpad-btn dpad-up" data-key="ArrowUp" data-code="ArrowUp" data-keycode="38">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"></polyline></svg>
          </button>
          <button type="button" class="dpad-btn dpad-down" data-key="ArrowDown" data-code="ArrowDown" data-keycode="40">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </button>
          <button type="button" class="dpad-btn dpad-left" data-key="ArrowLeft" data-code="ArrowLeft" data-keycode="37">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </button>
          <button type="button" class="dpad-btn dpad-right" data-key="ArrowRight" data-code="ArrowRight" data-keycode="39">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </button>
          <div class="dpad-center"></div>
        </div>
        <div class="virtual-actions" id="v-actions">
          <button type="button" class="action-btn action-b" data-key="z" data-code="KeyZ" data-keycode="90">B</button>
          <button type="button" class="action-btn action-a" data-key=" " data-code="Space" data-keycode="32">A</button>
        </div>
      `;

      const frameWrapper = document.querySelector('.modal-frame-wrapper') || document.body;
      frameWrapper.appendChild(overlay);
      this.overlay = overlay;

      this.bindTouchEvents();
    }

    bindTouchEvents() {
      const buttons = this.overlay.querySelectorAll('button[data-key]');

      const getButtonAtPoint = (touch) => {
        const el = document.elementFromPoint(touch.clientX, touch.clientY);
        return el ? el.closest('button[data-key]') : null;
      };

      const handleTouchStart = (e) => {
        e.preventDefault();
        e.stopPropagation();
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          const btn = getButtonAtPoint(t);
          if (btn) {
            btn.classList.add('pressed');
            const keyInfo = {
              btn,
              key: btn.dataset.key,
              code: btn.dataset.code,
              keyCode: parseInt(btn.dataset.keycode, 10)
            };
            this.activeTouches.set(t.identifier, keyInfo);
            this.dispatchGameKey(keyInfo.key, keyInfo.code, keyInfo.keyCode, 'keydown');
          }
        }
      };

      const handleTouchMove = (e) => {
        e.preventDefault();
        e.stopPropagation();
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          const currentInfo = this.activeTouches.get(t.identifier);
          const hoveredBtn = getButtonAtPoint(t);

          if (currentInfo && currentInfo.btn !== hoveredBtn) {
            // Finger slid off button -> release keydown immediately
            currentInfo.btn.classList.remove('pressed');
            this.dispatchGameKey(currentInfo.key, currentInfo.code, currentInfo.keyCode, 'keyup');
            this.activeTouches.delete(t.identifier);

            // If slid onto a new button -> press new key
            if (hoveredBtn) {
              hoveredBtn.classList.add('pressed');
              const newInfo = {
                btn: hoveredBtn,
                key: hoveredBtn.dataset.key,
                code: hoveredBtn.dataset.code,
                keyCode: parseInt(hoveredBtn.dataset.keycode, 10)
              };
              this.activeTouches.set(t.identifier, newInfo);
              this.dispatchGameKey(newInfo.key, newInfo.code, newInfo.keyCode, 'keydown');
            }
          }
        }
      };

      const handleTouchEndOrCancel = (e) => {
        e.preventDefault();
        e.stopPropagation();
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          const info = this.activeTouches.get(t.identifier);
          if (info) {
            info.btn.classList.remove('pressed');
            this.dispatchGameKey(info.key, info.code, info.keyCode, 'keyup');
            this.activeTouches.delete(t.identifier);
          }
        }
      };

      this.overlay.addEventListener('touchstart', handleTouchStart, { passive: false });
      this.overlay.addEventListener('touchmove', handleTouchMove, { passive: false });
      this.overlay.addEventListener('touchend', handleTouchEndOrCancel, { passive: false });
      this.overlay.addEventListener('touchcancel', handleTouchEndOrCancel, { passive: false });
    }

    releaseAllActiveKeys() {
      for (const [id, info] of this.activeTouches) {
        if (info && info.btn) {
          info.btn.classList.remove('pressed');
          this.dispatchGameKey(info.key, info.code, info.keyCode, 'keyup');
        }
      }
      this.activeTouches.clear();
    }

    dispatchGameKey(key, code, keyCode, type) {
      const eventInit = {
        key,
        code,
        keyCode,
        which: keyCode,
        bubbles: true,
        cancelable: true
      };

      const gameIframe = document.getElementById('game-iframe');
      if (gameIframe && gameIframe.contentWindow) {
        try {
          const doc = gameIframe.contentDocument || gameIframe.contentWindow.document;
          const FrameKeyboardEvent = gameIframe.contentWindow.KeyboardEvent || KeyboardEvent;
          if (doc) {
            doc.dispatchEvent(new FrameKeyboardEvent(type, eventInit));
          }
        } catch (_) {
          try {
            gameIframe.contentWindow.postMessage({
              type: 'ARCADEVERSE_GAMEPAD_KEY',
              eventType: type,
              key,
              code,
              keyCode
            }, '*');
          } catch (_) {}
        }
      }
    }

    updateOverlayVisibility() {
      const gameModal = document.getElementById('game-modal');
      const isModalActive = gameModal && gameModal.classList.contains('active');

      if (!isModalActive) {
        this.releaseAllActiveKeys();
        if (this.overlay) this.overlay.classList.remove('active');
        if (this.toggleBtn) this.toggleBtn.classList.remove('active');
        return;
      }

      let shouldShow = false;
      if (this.userEnabled !== null) {
        shouldShow = this.userEnabled;
      } else {
        shouldShow = !this.isTouchNativeGame(this.currentActiveGame);
      }

      if (this.overlay) {
        this.overlay.classList.toggle('active', shouldShow);
      }
      if (this.toggleBtn) {
        this.toggleBtn.classList.toggle('active', shouldShow);
      }

      if (!shouldShow) {
        this.releaseAllActiveKeys();
      }
    }

    bindModalLifecycle() {
      const gameModal = document.getElementById('game-modal');
      if (!gameModal) return;

      window.addEventListener('arcadeverse:game-launched', (e) => {
        this.currentActiveGame = e.detail;
        this.userEnabled = null; // reset to auto for new game
        this.updateOverlayVisibility();
      });

      const observer = new MutationObserver(() => {
        this.updateOverlayVisibility();
      });

      observer.observe(gameModal, { attributes: true, attributeFilter: ['class'] });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.VirtualTouchController = new VirtualTouchController();
    });
  } else {
    window.VirtualTouchController = new VirtualTouchController();
  }
})();
