/**
 * ArcadeVerse Game Speed & Frame-Pacing Regulator
 * Universal accessibility time-dilation engine & in-modal velocity controller
 * Author: hrshjswniii (@hrshjswniii)
 * Open Source for ArcadeVerse - NSOC Winter Edition 2026
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'arcadeverse_game_speed';
  const SPEED_LEVELS = [0.5, 0.75, 1.0, 1.25, 1.5];
  const SPEED_LABELS = {
    0.5: '0.5x (Slow-Mo Assist)',
    0.75: '0.75x (Relaxed Pace)',
    1.0: '1.0x (Standard Velocity)',
    1.25: '1.25x (Accelerated)',
    1.5: '1.5x (Turbo Overdrive)'
  };

  const GameSpeedRegulator = {
    speed: 1.0,
    isOpen: false,
    initialized: false,
    announcerEl: null,

    init() {
      if (this.initialized) return;

      this.loadPersistedSpeed();
      this.injectStyles();
      this.createAriaLiveRegion();
      this.mountControls();
      this.bindEvents();

      this.initialized = true;
    },

    loadPersistedSpeed() {
      try {
        // First check if global Accessibility Hub preference is set
        const a11ySaved = localStorage.getItem('arcadeverse_a11y_prefs');
        if (a11ySaved) {
          const parsed = JSON.parse(a11ySaved);
          if (parsed && typeof parsed.defaultGameSpeed === 'number') {
            this.speed = parsed.defaultGameSpeed;
          }
        }

        // Direct user override takes precedence
        const saved = parseFloat(localStorage.getItem(STORAGE_KEY));
        if (!isNaN(saved) && SPEED_LEVELS.includes(saved)) {
          this.speed = saved;
        }
      } catch (_) {
        this.speed = 1.0;
      }
    },

    savePersistedSpeed() {
      try {
        localStorage.setItem(STORAGE_KEY, String(this.speed));
      } catch (_) {}
    },

    injectStyles() {
      if (document.getElementById('game-speed-regulator-styles')) return;
      const link = document.createElement('link');
      link.id = 'game-speed-regulator-styles';
      link.rel = 'stylesheet';
      link.href = 'assets/css/game-speed-regulator.css';
      document.head.appendChild(link);
    },

    createAriaLiveRegion() {
      if (document.getElementById('speed-regulator-announcer')) return;
      const el = document.createElement('div');
      el.id = 'speed-regulator-announcer';
      el.className = 'sr-only';
      el.setAttribute('aria-live', 'polite');
      el.setAttribute('aria-atomic', 'true');
      document.body.appendChild(el);
      this.announcerEl = el;
    },

    announce(message) {
      if (!this.announcerEl) {
        this.announcerEl = document.getElementById('speed-regulator-announcer');
      }
      if (this.announcerEl) {
        this.announcerEl.textContent = message;
      }
    },

    mountControls() {
      // Find modal controls bar
      const modalControls = document.querySelector('.modal-controls');
      if (!modalControls || document.getElementById('modal-speed-regulator-wrap')) return;

      const wrap = document.createElement('div');
      wrap.id = 'modal-speed-regulator-wrap';
      wrap.className = 'speed-regulator-wrap';

      wrap.innerHTML = `
        <button type="button" class="btn btn-sm btn-icon btn-speed-trigger" id="modal-speed-btn"
          aria-haspopup="true" aria-expanded="false" aria-label="Game Velocity Regulator: ${this.speed}x"
          title="Game Speed Regulator ([ / ] to cycle)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="speed-meter-icon" aria-hidden="true">
            <path d="m12 14 4-4"></path>
            <path d="M3.34 19a10 10 0 1 1 17.32 0"></path>
          </svg>
          <span class="speed-current-val" id="speed-current-val">${this.speed}x</span>
        </button>

        <div class="speed-regulator-menu" id="speed-regulator-menu" role="menu" aria-label="Game Velocity Options" hidden>
          <div class="speed-menu-header">
            <div class="speed-menu-title-row">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              <span>GAME VELOCITY</span>
            </div>
            <span class="speed-menu-sub">Pacing & frame-rate assist</span>
          </div>

          <div class="speed-menu-options" role="group">
            ${SPEED_LEVELS.map(s => `
              <button type="button" role="menuitemradio" class="speed-menu-item ${s === this.speed ? 'active' : ''}"
                data-speed="${s}" aria-checked="${s === this.speed ? 'true' : 'false'}">
                <span class="speed-item-check" aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </span>
                <span class="speed-item-label">${SPEED_LABELS[s]}</span>
                <span class="speed-item-badge ${s < 1.0 ? 'slowmo' : (s > 1.0 ? 'turbo' : 'normal')}">${s}x</span>
              </button>
            `).join('')}
          </div>

          <div class="speed-menu-footer">
            <span class="speed-hotkey-hint">
              <kbd class="speed-kbd">[</kbd> Slow &bull; <kbd class="speed-kbd">]</kbd> Fast
            </span>
            <button type="button" class="speed-reset-link" id="speed-reset-btn">Reset 1.0x</button>
          </div>
        </div>
      `;

      // Insert before reload-btn or close-modal-btn
      const soundBtn = document.getElementById('modal-sound-btn');
      const reloadBtn = document.getElementById('reload-btn');
      if (reloadBtn) {
        modalControls.insertBefore(wrap, reloadBtn);
      } else if (soundBtn && soundBtn.nextSibling) {
        modalControls.insertBefore(wrap, soundBtn.nextSibling);
      } else {
        modalControls.appendChild(wrap);
      }

      this.updateVisualState();
    },

    bindEvents() {
      // Toggle menu button
      document.addEventListener('click', (e) => {
        const trigger = e.target.closest('#modal-speed-btn');
        if (trigger) {
          e.preventDefault();
          e.stopPropagation();
          this.toggleMenu();
          return;
        }

        // Option click
        const optionBtn = e.target.closest('.speed-menu-item[data-speed]');
        if (optionBtn) {
          e.preventDefault();
          const targetSpeed = parseFloat(optionBtn.dataset.speed);
          if (!isNaN(targetSpeed)) {
            this.setSpeed(targetSpeed);
            this.closeMenu();
          }
          return;
        }

        // Reset click
        if (e.target.closest('#speed-reset-btn')) {
          e.preventDefault();
          this.setSpeed(1.0);
          this.closeMenu();
          return;
        }

        // Click outside menu closes it
        const menu = document.getElementById('speed-regulator-menu');
        if (this.isOpen && menu && !e.target.closest('#modal-speed-regulator-wrap')) {
          this.closeMenu();
        }
      });

      // Global keyboard shortcut listeners
      window.addEventListener('keydown', (e) => {
        const gameModal = document.getElementById('game-modal');
        const isModalActive = gameModal && gameModal.classList.contains('active');
        if (!isModalActive) return;

        // Skip if typing in an input field
        const activeTag = (document.activeElement && document.activeElement.tagName ? document.activeElement.tagName.toLowerCase() : '');
        if (activeTag === 'input' || activeTag === 'textarea' || (document.activeElement && document.activeElement.isContentEditable)) {
          return;
        }

        // [ key: decrease speed
        if (e.key === '[' || e.key === '{') {
          e.preventDefault();
          this.cycleSpeed(-1);
          return;
        }

        // ] key: increase speed
        if (e.key === ']' || e.key === '}') {
          e.preventDefault();
          this.cycleSpeed(1);
          return;
        }

        // Escape closes speed menu if open
        if (e.key === 'Escape' && this.isOpen) {
          e.preventDefault();
          this.closeMenu();
          const trigger = document.getElementById('modal-speed-btn');
          if (trigger) trigger.focus();
        }
      });

      // Message listener for shortcuts forwarded from iframe or speed queries
      window.addEventListener('message', (e) => {
        if (!e.data || typeof e.data !== 'object') return;

        // Forwarded keyboard shortcuts from inside iframe
        if (e.data.type === 'ARCADEVERSE_KEY_SHORTCUT' && e.data.payload) {
          const key = e.data.payload.key;
          if (key === '[' || key === '{') {
            this.cycleSpeed(-1);
          } else if (key === ']' || key === '}') {
            this.cycleSpeed(1);
          }
        }

        // Iframe child requesting current speed config on startup
        if (e.data.type === 'ARCADEVERSE_REQUEST_SPEED_CONFIG' || e.data.type === 'AV_REQUEST_SPEED_CONFIG') {
          this.broadcastSpeedConfig();
        }
      });
    },

    toggleMenu() {
      if (this.isOpen) {
        this.closeMenu();
      } else {
        this.openMenu();
      }
    },

    openMenu() {
      const menu = document.getElementById('speed-regulator-menu');
      const trigger = document.getElementById('modal-speed-btn');
      if (!menu || !trigger) return;

      this.isOpen = true;
      menu.hidden = false;
      menu.classList.add('active');
      trigger.setAttribute('aria-expanded', 'true');
      trigger.classList.add('active');

      // Focus active option
      const activeOption = menu.querySelector('.speed-menu-item.active');
      if (activeOption) {
        activeOption.focus();
      }
    },

    closeMenu() {
      const menu = document.getElementById('speed-regulator-menu');
      const trigger = document.getElementById('modal-speed-btn');
      if (!menu || !trigger) return;

      this.isOpen = false;
      menu.hidden = true;
      menu.classList.remove('active');
      trigger.setAttribute('aria-expanded', 'false');
      trigger.classList.remove('active');
    },

    setSpeed(newSpeed, isUserAction = true) {
      if (!SPEED_LEVELS.includes(newSpeed)) {
        // Find closest valid speed
        newSpeed = SPEED_LEVELS.reduce((prev, curr) => {
          return Math.abs(curr - newSpeed) < Math.abs(prev - newSpeed) ? curr : prev;
        });
      }

      this.speed = newSpeed;
      if (isUserAction) {
        this.savePersistedSpeed();
      }

      this.updateVisualState();
      this.broadcastSpeedConfig();

      const label = SPEED_LABELS[this.speed] || `${this.speed}x`;
      this.announce(`Game velocity set to ${label}`);

      try {
        window.dispatchEvent(new CustomEvent('arcadeverse:game-speed-changed', {
          detail: { speed: this.speed, speedMultiplier: this.speed }
        }));
      } catch (_) {}
    },

    cycleSpeed(direction) {
      const currentIndex = SPEED_LEVELS.indexOf(this.speed);
      let nextIndex;
      if (currentIndex === -1) {
        nextIndex = 2; // Default to 1.0x
      } else {
        nextIndex = currentIndex + direction;
      }

      if (nextIndex < 0) nextIndex = 0;
      if (nextIndex >= SPEED_LEVELS.length) nextIndex = SPEED_LEVELS.length - 1;

      if (nextIndex !== currentIndex) {
        this.setSpeed(SPEED_LEVELS[nextIndex]);
      }
    },

    updateVisualState() {
      const valEl = document.getElementById('speed-current-val');
      const trigger = document.getElementById('modal-speed-btn');
      if (valEl) {
        valEl.textContent = `${this.speed}x`;
      }
      if (trigger) {
        trigger.setAttribute('aria-label', `Game Velocity Regulator: ${this.speed}x`);
        trigger.classList.toggle('is-modified', this.speed !== 1.0);
        trigger.classList.toggle('is-slowmo', this.speed < 1.0);
        trigger.classList.toggle('is-turbo', this.speed > 1.0);
      }

      const menu = document.getElementById('speed-regulator-menu');
      if (menu) {
        const items = menu.querySelectorAll('.speed-menu-item[data-speed]');
        items.forEach(item => {
          const s = parseFloat(item.dataset.speed);
          const isSelected = s === this.speed;
          item.classList.toggle('active', isSelected);
          item.setAttribute('aria-checked', isSelected ? 'true' : 'false');
        });
      }
    },

    broadcastSpeedConfig() {
      const gameIframe = document.getElementById('game-iframe');
      if (gameIframe && gameIframe.contentWindow) {
        try {
          gameIframe.contentWindow.postMessage({
            type: 'ARCADEVERSE_SET_SPEED',
            speed: this.speed,
            speedMultiplier: this.speed
          }, '*');

          gameIframe.contentWindow.postMessage({
            type: 'AV_SET_GAME_SPEED',
            speed: this.speed,
            speedMultiplier: this.speed
          }, '*');
        } catch (_) {}
      }
    }
  };

  window.GameSpeedRegulator = GameSpeedRegulator;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => GameSpeedRegulator.init());
  } else {
    GameSpeedRegulator.init();
  }
})();
