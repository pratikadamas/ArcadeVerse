/**
 * ArcadeVerse Mobile Quick-Action Bottom Dock
 * Ergonomic glassmorphic bottom navigation for mobile viewports (< 768px).
 * Provides one-handed access to Home, Search, Favorites, Streak, and Theme Studio.
 * Fixed at viewport bottom with env(safe-area-inset-bottom) padding.
 * Pure Vanilla JS - no frameworks, no bundlers.
 * Author: Khushi Shah (@shahkhushi0307) - NSOC Winter Edition 2026
 */

(function () {
  'use strict';

  const MOBILE_BREAKPOINT = 768;

  const MobileDock = {
    el: null,
    initialized: false,

    // Button definitions: id, icon, label, action handler
    buttons: [
      {
        id: 'dock-home',
        icon: 'gamepad-2',
        label: 'Home',
        action: () => {
          window.scrollTo({ top: 0, behavior: 'smooth' });
          MobileDock.announce('Home');
        }
      },
      {
        id: 'dock-search',
        icon: 'search',
        label: 'Search',
        action: () => {
          const input = document.getElementById('game-search-input');
          if (input) {
            input.focus();
            input.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          MobileDock.announce('Search');
        }
      },
      {
        id: 'dock-favorites',
        icon: 'heart',
        label: 'Favorites',
        action: () => {
          const favLink = document.getElementById('mobile-favorites-link');
          const favPill = document.querySelector('.category-pills .pill[data-category="favorites"]');
          const target = favLink || favPill;
          if (target) {
            target.click();
          }
          MobileDock.announce('Favorites');
        }
      },
      {
        id: 'dock-streak',
        icon: 'flame',
        label: 'Streak',
        action: () => {
          const mount = document.getElementById('daily-challenge-mount');
          if (mount) {
            mount.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          MobileDock.announce('Daily Streak');
        }
      },
      {
        id: 'dock-theme',
        icon: 'sun',
        label: 'Theme Studio',
        action: () => {
          const btn = document.getElementById('theme-studio-trigger-btn');
          if (btn) {
            btn.click();
          }
          MobileDock.announce('Theme Studio');
        }
      }
    ],

    init() {
      if (this.initialized) return;
      this.initialized = true;

      this.render();
      this.bindEvents();
      this.syncVisibility();
      window.addEventListener('resize', () => this.syncVisibility());
    },

    render() {
      if (document.getElementById('mobile-dock')) return;

      const dock = document.createElement('nav');
      dock.id = 'mobile-dock';
      dock.className = 'mobile-dock';
      dock.setAttribute('role', 'navigation');
      dock.setAttribute('aria-label', 'Mobile Quick Actions');

      const html = this.buttons.map(b => `
        <button type="button" class="dock-btn" id="${b.id}" aria-label="${b.label}" title="${b.label}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><i data-lucide="${b.icon}"></i></svg>
          <span class="dock-label">${b.label}</span>
        </button>
      `).join('');

      dock.innerHTML = html;
      document.body.appendChild(dock);
    },

    bindEvents() {
      document.addEventListener('click', (e) => {
        const btn = e.target.closest('#mobile-dock button.dock-btn');
        if (!btn) return;
        e.preventDefault();
        const id = btn.id;
        const def = this.buttons.find(b => b.id === id);
        if (def && typeof def.action === 'function') {
          def.action();
          this.bounce(btn);
        }
      });

      // Lucide icon hydration for dock icons
      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons({ nodes: document.querySelectorAll('#mobile-dock [data-lucide]') });
      }
    },

    bounce(btn) {
      btn.classList.add('dock-bounce');
      setTimeout(() => btn.classList.remove('dock-bounce'), 180);
    },

    syncVisibility() {
      const dock = document.getElementById('mobile-dock');
      if (!dock) return;
      const isMobile = window.innerWidth < MOBILE_BREAKPOINT;
      dock.style.display = isMobile ? 'flex' : 'none';
    },

    announce(text) {
      const announcer = document.getElementById('a11y-announcer');
      if (announcer) {
        announcer.textContent = text;
      }
    }
  };

  window.MobileDock = MobileDock;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => MobileDock.init());
  } else {
    MobileDock.init();
  }
})();
