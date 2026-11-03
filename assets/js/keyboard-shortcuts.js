/**
 * ArcadeVerse — Global Keyboard Shortcuts Engine & Command Cheatsheet Modal
 * Provides power-user keyboard navigation across catalog, player, sound, and theme controls
 * Author: Babin Bid (@Babin123456)
 * NSOC Winter Edition 2026
 */

(() => {
  'use strict';

  const ShortcutsEngine = {
    modalEl: null,
    isOpen: false,
    lastFocused: null,

    init() {
      this.injectModal();
      this.injectNavbarTrigger();
      this.bindListeners();
    },

    injectModal() {
      if (document.getElementById('shortcuts-modal')) return;

      const overlay = document.createElement('div');
      overlay.id = 'shortcuts-modal';
      overlay.className = 'shortcuts-modal-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-hidden', 'true');
      overlay.setAttribute('aria-labelledby', 'shortcuts-title-text');

      overlay.innerHTML = `
        <div class="shortcuts-modal-card">
          <div class="shortcuts-header">
            <h2 class="shortcuts-title" id="shortcuts-title-text">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <rect width="20" height="16" x="2" y="4" rx="2"></rect>
                <path d="M6 8h.001M10 8h.001M14 8h.001M18 8h.001M8 12h.001M12 12h.001M16 12h.001M7 16h10"></path>
              </svg>
              Keyboard Shortcuts
            </h2>
            <button type="button" class="shortcuts-close-btn" id="shortcuts-close-btn" aria-label="Close shortcuts cheatsheet (Esc)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <div class="shortcuts-groups-grid">
            <div class="shortcut-group">
              <h3>Navigation & Search</h3>
              <div class="shortcut-list">
                <div class="shortcut-row">
                  <span>Focus Game Search</span>
                  <div class="shortcut-keys"><kbd>/</kbd></div>
                </div>
                <div class="shortcut-row">
                  <span>Open Shortcuts Help</span>
                  <div class="shortcut-keys"><kbd>?</kbd> or <kbd>Shift</kbd>+<kbd>/</kbd></div>
                </div>
                <div class="shortcut-row">
                  <span>Explore Games Hub</span>
                  <div class="shortcut-keys"><kbd>H</kbd></div>
                </div>
                <div class="shortcut-row">
                  <span>Hall of Fame Page</span>
                  <div class="shortcut-keys"><kbd>L</kbd></div>
                </div>
                <div class="shortcut-row">
                  <span>Documentation</span>
                  <div class="shortcut-keys"><kbd>D</kbd></div>
                </div>
                <div class="shortcut-row">
                  <span>FAQs & Help</span>
                  <div class="shortcut-keys"><kbd>Q</kbd></div>
                </div>
                <div class="shortcut-row">
                  <span>Category Filter Pills</span>
                  <div class="shortcut-keys"><kbd>1</kbd> ... <kbd>9</kbd></div>
                </div>
              </div>
            </div>

            <div class="shortcut-group">
              <h3>Game Player Controls</h3>
              <div class="shortcut-list">
                <div class="shortcut-row">
                  <span>Close Active Game / Modal</span>
                  <div class="shortcut-keys"><kbd>Esc</kbd></div>
                </div>
                <div class="shortcut-row">
                  <span>Toggle Game Fullscreen</span>
                  <div class="shortcut-keys"><kbd>F</kbd></div>
                </div>
                <div class="shortcut-row">
                  <span>Reload / Restart Game</span>
                  <div class="shortcut-keys"><kbd>R</kbd></div>
                </div>
                <div class="shortcut-row">
                  <span>Toggle UI Sound SFX</span>
                  <div class="shortcut-keys"><kbd>M</kbd></div>
                </div>
                <div class="shortcut-row">
                  <span>Toggle Dark / Light Theme</span>
                  <div class="shortcut-keys"><kbd>T</kbd></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);
      this.modalEl = overlay;

      const closeBtn = overlay.querySelector('#shortcuts-close-btn');
      if (closeBtn) closeBtn.addEventListener('click', () => this.close());
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) this.close();
      });
    },

    injectNavbarTrigger() {
      let btn = document.getElementById('shortcuts-trigger-btn');
      if (btn) {
        // If already statically present in markup, bind toggle handler once
        if (!btn.dataset.bound) {
          btn.addEventListener('click', () => this.toggle());
          btn.dataset.bound = 'true';
        }
        return;
      }

      const actions = document.querySelector('.nav-actions');
      if (!actions) return;

      btn = document.createElement('button');
      btn.id = 'shortcuts-trigger-btn';
      btn.className = 'keyboard-shortcuts-btn';
      btn.type = 'button';
      btn.setAttribute('aria-label', 'View keyboard shortcuts cheatsheet (?)');
      btn.title = 'Keyboard Shortcuts (?)';
      btn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect width="20" height="16" x="2" y="4" rx="2"></rect>
          <path d="M6 8h.001M10 8h.001M14 8h.001M18 8h.001M8 12h.001M12 12h.001M16 12h.001M7 16h10"></path>
        </svg>
      `;

      btn.addEventListener('click', () => this.toggle());
      btn.dataset.bound = 'true';
      const a11y = actions.querySelector('#a11y-trigger-btn');
      if (a11y) {
        actions.insertBefore(btn, a11y);
      } else {
        actions.prepend(btn);
      }
    },

    open() {
      if (!this.modalEl) return;
      this.lastFocused = document.activeElement;
      this.modalEl.classList.add('active');
      this.modalEl.setAttribute('aria-hidden', 'false');
      this.isOpen = true;
      const closeBtn = this.modalEl.querySelector('#shortcuts-close-btn');
      if (closeBtn) closeBtn.focus();
    },

    close() {
      if (!this.modalEl) return;
      this.modalEl.classList.remove('active');
      this.modalEl.setAttribute('aria-hidden', 'true');
      this.isOpen = false;
      if (this.lastFocused && typeof this.lastFocused.focus === 'function') {
        this.lastFocused.focus();
      }
    },

    toggle() {
      if (this.isOpen) {
        this.close();
      } else {
        this.open();
      }
    },

    bindListeners() {
      window.addEventListener('keydown', (e) => {
        const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
        const isEditing = activeTag === 'input' || activeTag === 'textarea' || document.activeElement.isContentEditable;

        // Esc always closes open modal
        if (e.key === 'Escape') {
          if (this.isOpen) {
            e.preventDefault();
            this.close();
            return;
          }
        }

        // When typing in text input, don't trigger global shortcuts
        if (isEditing) return;

        // ? or Shift + /: Toggle shortcuts modal
        if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
          e.preventDefault();
          this.toggle();
          return;
        }

        // /: Focus search bar
        if (e.key === '/') {
          const searchInput = document.getElementById('game-search-input') || document.getElementById('leaderboard-search-input');
          if (searchInput) {
            e.preventDefault();
            searchInput.focus();
            searchInput.select();
            return;
          }
        }

        // M: Toggle Sound
        if (e.key === 'm' || e.key === 'M') {
          const soundToggleBtn = document.getElementById('global-sound-toggle-btn');
          if (soundToggleBtn) {
            soundToggleBtn.click();
          } else if (window.SoundEngine) {
            window.SoundEngine.enabled = !window.SoundEngine.enabled;
            window.SoundEngine.saveSettings();
          }
          return;
        }

        // T: Toggle Theme
        if (e.key === 't' || e.key === 'T') {
          const themeBtn = document.getElementById('theme-toggle-btn');
          if (themeBtn) themeBtn.click();
          return;
        }

        // H: Go Home
        if (e.key === 'h' || e.key === 'H') {
          if (!window.location.pathname.endsWith('index.html') && !window.location.pathname.endsWith('/')) {
            window.location.href = 'index.html';
          }
          return;
        }

        // L: Go to Leaderboard
        if (e.key === 'l' || e.key === 'L') {
          if (!window.location.pathname.endsWith('leaderboard.html')) {
            window.location.href = 'leaderboard.html';
          }
          return;
        }

        // D: Go to Documentation
        if (e.key === 'd' || e.key === 'D') {
          if (!window.location.pathname.endsWith('docs.html')) {
            window.location.href = 'docs.html';
          }
          return;
        }

        // Q: Go to FAQs
        if (e.key === 'q' || e.key === 'Q') {
          if (!window.location.pathname.endsWith('faqs.html')) {
            window.location.href = 'faqs.html';
          }
          return;
        }

        // F: Toggle Game Fullscreen (when modal is open)
        if (e.key === 'f' || e.key === 'F') {
          const gameModal = document.getElementById('game-modal');
          if (gameModal && gameModal.classList.contains('active')) {
            const fsBtn = document.getElementById('fullscreen-btn');
            if (fsBtn) {
              fsBtn.click();
              e.preventDefault();
            }
          }
          return;
        }

        // R: Reload / Restart Game (when modal is open)
        if (e.key === 'r' || e.key === 'R') {
          const gameModal = document.getElementById('game-modal');
          if (gameModal && gameModal.classList.contains('active')) {
            const reloadBtn = document.getElementById('reload-btn');
            if (reloadBtn) {
              reloadBtn.click();
              e.preventDefault();
            }
          }
          return;
        }

        // 1 to 9: Category pills (including Halloween)
        if (e.key >= '1' && e.key <= '9') {
          const pills = document.querySelectorAll('.category-pills .pill');
          const index = parseInt(e.key, 10) - 1;
          if (pills && pills[index]) {
            pills[index].click();
          }
        }
      });
    }
  };

  window.ArcadeShortcuts = ShortcutsEngine;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ShortcutsEngine.init());
  } else {
    ShortcutsEngine.init();
  }
})();
