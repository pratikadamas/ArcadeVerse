/**
 * ArcadeVerse High-Legibility Font Switcher
 * Accessibility toggle for OpenDyslexic / Atkinson Hyperlegible typographic profiles.
 * Applies generous letter-spacing (+0.08em), word-spacing (+0.16em), and 1.6x line heights
 * across catalog cards, leaderboards, modals, and buttons with guaranteed text wrapping.
 * Pure Vanilla JS - no frameworks, no bundlers.
 * Author: Khushi Shah (@shahkhushi0307) - NSOC Winter Edition 2026
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'arcadeverse_a11y_font_mode';
  const MODES = ['off', 'opendyslexic', 'atkinson'];

  const MODE_LABELS = {
    off: 'High-Legibility Font',
    opendyslexic: 'OpenDyslexic Font',
    atkinson: 'Atkinson Hyperlegible Font'
  };

  const MODE_SUB = {
    off: 'Switch to OpenDyslexic or Atkinson Hyperlegible for easier reading',
    opendyslexic: 'OpenDyslexic - weighted letterforms for dyslexia-friendly reading',
    atkinson: 'Atkinson Hyperlegible - maximized character distinction for low vision'
  };

  const FontSwitcher = {
    mode: 'off',

    init() {
      this.load();
      this.apply();
      this.ensureDrawerRow();
      this.bindEvents();
    },

    load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw && MODES.includes(raw)) {
          this.mode = raw;
        }
      } catch (_) {}
    },

    save() {
      try {
        localStorage.setItem(STORAGE_KEY, this.mode);
      } catch (_) {}
    },

    setMode(mode) {
      if (!MODES.includes(mode)) return;
      this.mode = mode;
      this.save();
      this.apply();
      this.syncDrawerUI();
      this.announce();
    },

    cycle() {
      const idx = MODES.indexOf(this.mode);
      this.setMode(MODES[(idx + 1) % MODES.length]);
    },

    apply() {
      const root = document.documentElement;
      root.classList.remove('a11y-font-off', 'a11y-font-opendyslexic', 'a11y-font-atkinson');
      root.classList.add('a11y-font-' + this.mode);
      window.dispatchEvent(new CustomEvent('arcadeverse:a11y-font-changed', {
        detail: { mode: this.mode }
      }));
    },

    announce() {
      const announcer = document.getElementById('a11y-announcer');
      if (announcer) {
        announcer.textContent = MODE_LABELS[this.mode] + ' mode ' + (this.mode === 'off' ? 'disabled' : 'enabled');
      }
    },

    ensureDrawerRow() {
      const list = document.getElementById('a11y-options-list');
      if (!list) return;
      if (document.getElementById('a11y-font-row')) return;

      const row = document.createElement('label');
      row.id = 'a11y-font-row';
      row.className = 'a11y-toggle-row a11y-select-row';
      row.innerHTML =
        '<div>' +
        '<strong class="a11y-toggle-title">' + MODE_LABELS[this.mode] + '</strong>' +
        '<span class="a11y-toggle-sub">' + MODE_SUB[this.mode] + '</span>' +
        '</div>' +
        '<select id="a11y-opt-font" class="a11y-select" aria-label="High-legibility font mode">' +
        '<option value="off"' + (this.mode === 'off' ? ' selected' : '') + '>Off (System Font)</option>' +
        '<option value="opendyslexic"' + (this.mode === 'opendyslexic' ? ' selected' : '') + '>OpenDyslexic</option>' +
        '<option value="atkinson"' + (this.mode === 'atkinson' ? ' selected' : '') + '>Atkinson Hyperlegible</option>' +
        '</select>';
      list.appendChild(row);
    },

    syncDrawerUI() {
      const select = document.getElementById('a11y-opt-font');
      const title = document.querySelector('#a11y-font-row .a11y-toggle-title');
      const sub = document.querySelector('#a11y-font-row .a11y-toggle-sub');
      if (select) select.value = this.mode;
      if (title) title.textContent = MODE_LABELS[this.mode];
      if (sub) sub.textContent = MODE_SUB[this.mode];
    },

    bindEvents() {
      document.addEventListener('change', (e) => {
        if (e.target.id === 'a11y-opt-font') {
          this.setMode(e.target.value);
        }
      });
    },

    getMode() {
      return this.mode;
    }
  };

  window.FontSwitcher = FontSwitcher;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => FontSwitcher.init());
  } else {
    FontSwitcher.init();
  }
})();
