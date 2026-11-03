/**
 * ArcadeVerse Universal Accessibility (a11y) Engine
 * Manages WCAG 2.1 compliance modes, sensory toggles, and drawer state.
 * Author: Babin Bid (@Babin123456)
 * Open Source for ArcadeVerse - NSOC Winter Edition 2026
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'arcadeverse_a11y_prefs';

  const A11yEngine = {
    prefs: {
      reducedMotion: false,
      highContrast: false,
      largeText: false,
      focusHighlight: false
    },
    lastFocusedElement: null,

    init() {
      this.loadPrefs();
      this.detectSystemMotionPreference();
      this.applyPrefs();
      this.renderDrawer();
      this.bindEvents();
    },

    detectSystemMotionPreference() {
      // Synchronize with system prefers-reduced-motion media query
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      if (localStorage.getItem(STORAGE_KEY) === null && mediaQuery.matches) {
        this.prefs.reducedMotion = true;
      }

      if (typeof mediaQuery.addEventListener === 'function') {
        mediaQuery.addEventListener('change', (e) => {
          if (localStorage.getItem(STORAGE_KEY) === null) {
            this.prefs.reducedMotion = e.matches;
            this.applyPrefs();
            const checkbox = document.getElementById('a11y-opt-motion');
            if (checkbox) checkbox.checked = e.matches;
          }
        });
      }
    },

    loadPrefs() {
      try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (saved && typeof saved === 'object') {
          Object.assign(this.prefs, saved);
        }
      } catch (_) {}
    },

    savePrefs() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.prefs));
      } catch (_) {}
    },

    applyPrefs() {
      const root = document.documentElement;
      root.classList.toggle('a11y-reduced-motion', Boolean(this.prefs.reducedMotion));
      root.classList.toggle('a11y-high-contrast', Boolean(this.prefs.highContrast));
      root.classList.toggle('a11y-large-text', Boolean(this.prefs.largeText));
      root.classList.toggle('a11y-focus-highlight', Boolean(this.prefs.focusHighlight));
      window.dispatchEvent(new CustomEvent('arcadeverse:a11y-motion-changed', { detail: { reducedMotion: this.prefs.reducedMotion } }));
    },

    renderDrawer() {
      // 1. Navbar Trigger Button fallback if not present in static HTML
      const navActions = document.querySelector('.nav-actions');
      if (navActions && !document.getElementById('a11y-trigger-btn')) {
        const btn = document.createElement('button');
        btn.id = 'a11y-trigger-btn';
        btn.className = 'a11y-btn-trigger';
        btn.type = 'button';
        btn.setAttribute('aria-label', 'Open Accessibility Hub');
        btn.title = 'Accessibility Hub';
        btn.innerHTML = `
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="m4.93 4.93 4.24 4.24"></path>
            <path d="m14.83 9.17 4.24-4.24"></path>
            <path d="m14.83 14.83 4.24 4.24"></path>
            <path d="m9.17 14.83-4.24 4.24"></path>
            <circle cx="12" cy="12" r="4"></circle>
          </svg>
        `;
        const themeBtn = navActions.querySelector('.theme-toggle-btn');
        if (themeBtn) {
          navActions.insertBefore(btn, themeBtn);
        } else {
          navActions.appendChild(btn);
        }
      }

      // 2. Sliding Drawer Modal
      if (!document.getElementById('a11y-drawer')) {
        const drawer = document.createElement('aside');
        drawer.id = 'a11y-drawer';
        drawer.className = 'a11y-drawer';
        drawer.setAttribute('role', 'dialog');
        drawer.setAttribute('aria-modal', 'true');
        drawer.setAttribute('aria-label', 'Accessibility Controls');
        drawer.innerHTML = `
          <div class="a11y-drawer-header">
            <h3>Accessibility Hub</h3>
            <button id="a11y-close-btn" class="a11y-close-btn" aria-label="Close Accessibility Hub" type="button">&times;</button>
          </div>
          <p class="a11y-desc">Customize sensory, motion, and contrast settings for an optimal arcade experience.</p>
          <div class="a11y-options-list">
            <label class="a11y-toggle-row" for="a11y-opt-motion">
              <div>
                <strong class="a11y-toggle-title">Reduced Motion</strong>
                <span class="a11y-toggle-sub">Stops ambient glow orbs, grids, and transitions</span>
              </div>
              <input type="checkbox" id="a11y-opt-motion" class="a11y-checkbox" ${this.prefs.reducedMotion ? 'checked' : ''}>
            </label>
            <label class="a11y-toggle-row" for="a11y-opt-contrast">
              <div>
                <strong class="a11y-toggle-title">High Contrast Mode</strong>
                <span class="a11y-toggle-sub">Maximizes background & text legibility</span>
              </div>
              <input type="checkbox" id="a11y-opt-contrast" class="a11y-checkbox" ${this.prefs.highContrast ? 'checked' : ''}>
            </label>
            <label class="a11y-toggle-row" for="a11y-opt-largetext">
              <div>
                <strong class="a11y-toggle-title">Large Typography</strong>
                <span class="a11y-toggle-sub">Scales catalog text and cards by 118%</span>
              </div>
              <input type="checkbox" id="a11y-opt-largetext" class="a11y-checkbox" ${this.prefs.largeText ? 'checked' : ''}>
            </label>
            <label class="a11y-toggle-row" for="a11y-opt-focus">
              <div>
                <strong class="a11y-toggle-title">Enhanced Focus Rings</strong>
                <span class="a11y-toggle-sub">High-visibility blue outlines for keyboard navigation</span>
              </div>
              <input type="checkbox" id="a11y-opt-focus" class="a11y-checkbox" ${this.prefs.focusHighlight ? 'checked' : ''}>
            </label>
          </div>
          <button id="a11y-reset-btn" class="a11y-reset-btn" type="button">Reset All to Default</button>
        `;
        document.body.appendChild(drawer);

        // Backdrop
        const backdrop = document.createElement('div');
        backdrop.id = 'a11y-backdrop';
        backdrop.className = 'a11y-backdrop';
        backdrop.setAttribute('aria-hidden', 'true');
        document.body.appendChild(backdrop);
      }
    },

    bindEvents() {
      document.addEventListener('click', (e) => {
        if (e.target.closest('#a11y-trigger-btn')) {
          e.preventDefault();
          this.openDrawer();
        } else if (e.target.closest('#a11y-close-btn, #a11y-backdrop')) {
          e.preventDefault();
          this.closeDrawer();
        } else if (e.target.closest('#a11y-reset-btn')) {
          e.preventDefault();
          this.resetPrefs();
        }
      });

      document.addEventListener('change', (e) => {
        if (e.target.id === 'a11y-opt-motion') {
          this.prefs.reducedMotion = e.target.checked;
          this.savePrefs();
          this.applyPrefs();
        } else if (e.target.id === 'a11y-opt-contrast') {
          this.prefs.highContrast = e.target.checked;
          this.savePrefs();
          this.applyPrefs();
        } else if (e.target.id === 'a11y-opt-largetext') {
          this.prefs.largeText = e.target.checked;
          this.savePrefs();
          this.applyPrefs();
        } else if (e.target.id === 'a11y-opt-focus') {
          this.prefs.focusHighlight = e.target.checked;
          this.savePrefs();
          this.applyPrefs();
        }
      });

      // Close on Escape key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          const drawer = document.getElementById('a11y-drawer');
          if (drawer && drawer.classList.contains('active')) {
            this.closeDrawer();
          }
        }
      });
    },

    openDrawer() {
      const drawer = document.getElementById('a11y-drawer');
      const backdrop = document.getElementById('a11y-backdrop');
      if (drawer && backdrop) {
        this.lastFocusedElement = document.activeElement;
        drawer.classList.add('active');
        backdrop.classList.add('active');
        const closeBtn = document.getElementById('a11y-close-btn');
        if (closeBtn) closeBtn.focus();
      }
    },

    closeDrawer() {
      const drawer = document.getElementById('a11y-drawer');
      const backdrop = document.getElementById('a11y-backdrop');
      if (drawer && backdrop) {
        drawer.classList.remove('active');
        backdrop.classList.remove('active');
        if (this.lastFocusedElement && typeof this.lastFocusedElement.focus === 'function') {
          this.lastFocusedElement.focus();
        }
      }
    },


    isMotionReduced() {
      return Boolean(this.prefs.reducedMotion);
    },

    onMotionPreferenceChange(callback) {
      if (typeof callback === 'function') {
        window.addEventListener('arcadeverse:a11y-motion-changed', (e) => {
          callback(e.detail.reducedMotion);
        });
      }
    },
    resetPrefs() {
      this.prefs = {
        reducedMotion: false,
        highContrast: false,
        largeText: false,
        focusHighlight: false
      };
      this.savePrefs();
      this.applyPrefs();
      document.querySelectorAll('.a11y-checkbox').forEach(cb => { cb.checked = false; });
    }
  };

  window.A11yEngine = A11yEngine;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => A11yEngine.init());
  } else {
    A11yEngine.init();
  }
})();
