/**
 * ArcadeVerse Theme Customizer, Solarized Controller & Synthwave Outrun Controller (#1365, #1374)
 * Precision Theme Architecture:
 * - Ethan Schoonover's precision Solarized system (Cyber Dark & Cyber Light)
 * - 1980s Cyberpunk Neon Sunset Synthwave Outrun Theme Studio (Hot Magenta, Electric Cyan,
 *   Sunset Tangerine, Deep Violet, Midnight Indigo) with animated horizon grid and retro duotone card glows.
 *
 * Strictly zero Unicode emojis across all code, logs, and elements.
 */

(function (root, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory();
  } else {
    const api = factory();
    root.ThemeCustomizer = api;
    root.SolarizedThemeController = api;
    root.SynthwaveThemeController = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STORAGE_KEY_PALETTE = 'arcadeverse_solarized_palette';
  const STORAGE_KEY_MODE = 'arcadeverse_solarized_mode'; // 'dark' | 'light'
  const STORAGE_KEY_ACTIVE_THEME = 'arcadeverse_active_custom_theme';

  // Precision Solarized Palettes
  const SOLARIZED_PALETTES = {
    dark: {
      id: 'solarized_cyber_dark',
      name: 'Solarized Cyber Dark',
      mode: 'dark',
      bgMain: '#002b36',      // Base03
      bgCard: '#073642',      // Base02
      accentPrimary: '#2aa198', // Precision Cyan
      accentSecondary: '#b58900', // Precision Yellow
      textPrimary: '#fdf6e3', // Base3 (13.92:1 Contrast Ratio vs Base03, WCAG AAA)
      textSecondary: '#eee8d5', // Base2 (12.25:1 Contrast Ratio vs Base03, WCAG AAA)
      textMuted: '#93a1a1',   // Base1
      badgeBg: '#073642',
      badgeBorder: '#2aa198',
      badgeText: '#fdf6e3',
      buttonBg: '#b58900',
      buttonText: '#001f27'
    },
    light: {
      id: 'solarized_cyber_light',
      name: 'Solarized Cyber Light',
      mode: 'light',
      bgMain: '#fdf6e3',      // Base3
      bgCard: '#eee8d5',      // Base2
      accentPrimary: '#2aa198', // Precision Cyan
      accentSecondary: '#cb4b16', // Precision Orange
      textPrimary: '#002b36', // Base03 (13.92:1 Contrast Ratio vs Base3, WCAG AAA)
      textSecondary: '#073642', // Base02 (12.05:1 Contrast Ratio vs Base3, WCAG AAA)
      textMuted: '#586e75',   // Base01
      badgeBg: '#eee8d5',
      badgeBorder: 'rgba(7, 54, 66, 0.35)',
      badgeText: '#002b36',
      buttonBg: '#cb4b16',
      buttonText: '#ffffff'
    }
  };

  // 1980s Synthwave Outrun Palette Matrix (#1365)
  const SYNTHWAVE_OUTRUN_PALETTE = {
    id: 'synthwave_outrun',
    name: 'Synthwave Outrun',
    bgMain: '#0d001a',          // Midnight Indigo
    bgCard: '#1a0033',          // Deep Violet
    accentPrimary: '#ff007f',   // Hot Magenta
    accentSecondary: '#00f0ff', // Electric Cyan
    accentWarm: '#ff7b00',      // Sunset Tangerine
    textPrimary: '#ffffff',     // Pure White (18.6:1 WCAG AAA on Midnight Indigo)
    textSecondary: '#e0d0f5',   // Light Violet-White
    textMuted: '#b39ddb',       // High Contrast Muted Violet
    badgeBg: '#1a0033',
    badgeBorder: '#00f0ff',
    badgeText: '#00f0ff',
    buttonBg: '#ff007f',
    buttonText: '#ffffff'
  };

  /**
   * Injects or removes the pure CSS animated horizon grid beneath the catalog header.
   * @param {boolean} enable
   */
  function toggleHorizonGrid(enable) {
    if (typeof document === 'undefined') return;

    let grid = document.getElementById('synthwave-horizon-grid');
    if (enable) {
      if (!grid) {
        grid = document.createElement('div');
        grid.id = 'synthwave-horizon-grid';
        grid.className = 'synthwave-horizon-grid';
        grid.setAttribute('aria-hidden', 'true');
        grid.innerHTML = '<div class="synthwave-grid-plane"></div>';

        // Anchor beneath hero section or before games catalog
        const heroSection = document.querySelector('.hero-section');
        const gamesSection = document.getElementById('games');
        if (heroSection) {
          heroSection.style.position = 'relative';
          heroSection.appendChild(grid);
        } else if (gamesSection) {
          gamesSection.style.position = 'relative';
          gamesSection.insertBefore(grid, gamesSection.firstChild);
        } else {
          document.body.appendChild(grid);
        }
      }
    } else if (grid && grid.parentNode) {
      grid.parentNode.removeChild(grid);
    }
  }

  /**
   * Applies the Synthwave / Outrun theme to the document.
   * @param {boolean} persist
   */
  function applySynthwaveOutrun(persist = true) {
    const palette = SYNTHWAVE_OUTRUN_PALETTE;
    const rootEl = typeof document !== 'undefined' ? document.documentElement : null;

    if (rootEl) {
      rootEl.setAttribute('data-theme', 'synthwave-outrun');
      rootEl.style.setProperty('--bg-main', palette.bgMain);
      rootEl.style.setProperty('--bg-card', palette.bgCard);
      rootEl.style.setProperty('--accent-primary', palette.accentPrimary);
      rootEl.style.setProperty('--accent-secondary', palette.accentSecondary);
      rootEl.style.setProperty('--accent-warm', palette.accentWarm);
      rootEl.style.setProperty('--text-primary', palette.textPrimary);
      rootEl.style.setProperty('--border-focus', palette.accentWarm);

      toggleHorizonGrid(true);
    }

    if (persist && typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_ACTIVE_THEME, 'synthwave-outrun');
      } catch (_) {}
    }

    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('arcadeverse:synthwave-theme-changed', {
        detail: { palette }
      }));
    }

    return palette;
  }

  /**
   * Applies selected Solarized mode to DOM root.
   * @param {'dark'|'light'} mode
   * @param {boolean} persist
   */
  function applySolarizedMode(mode, persist = true) {
    const targetMode = mode === 'light' ? 'light' : 'dark';
    const palette = SOLARIZED_PALETTES[targetMode];
    const rootEl = typeof document !== 'undefined' ? document.documentElement : null;

    if (rootEl) {
      toggleHorizonGrid(false);
      rootEl.setAttribute('data-theme', targetMode === 'light' ? 'solarized-light' : 'solarized-dark');
      rootEl.style.setProperty('--bg-main', palette.bgMain);
      rootEl.style.setProperty('--bg-card', palette.bgCard);
      rootEl.style.setProperty('--accent-primary', palette.accentPrimary);
      rootEl.style.setProperty('--text-primary', palette.textPrimary);
      rootEl.style.setProperty('--border-focus', palette.accentSecondary);
    }

    if (persist && typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_MODE, targetMode);
        localStorage.setItem(STORAGE_KEY_PALETTE, JSON.stringify(palette));
        localStorage.setItem(STORAGE_KEY_ACTIVE_THEME, targetMode === 'light' ? 'solarized-light' : 'solarized-dark');
      } catch (_) {}
    }

    // Synchronize UI buttons
    if (typeof document !== 'undefined') {
      const darkBtn = document.getElementById('solarized-mode-dark-btn');
      const lightBtn = document.getElementById('solarized-mode-light-btn');
      if (darkBtn && lightBtn) {
        darkBtn.classList.toggle('active', targetMode === 'dark');
        darkBtn.setAttribute('aria-pressed', targetMode === 'dark' ? 'true' : 'false');
        lightBtn.classList.toggle('active', targetMode === 'light');
        lightBtn.setAttribute('aria-pressed', targetMode === 'light' ? 'true' : 'false');
      }
    }

    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('arcadeverse:solarized-theme-changed', {
        detail: { mode: targetMode, palette }
      }));
    }

    return palette;
  }

  /**
   * Switches theme instantly by key/id.
   * @param {string} themeKey ('synthwave-outrun' | 'synthwave_outrun' | 'solarized-dark' | 'solarized-light' | 'dark' | 'light')
   * @param {boolean} persist
   */
  function switchTheme(themeKey, persist = true) {
    if (themeKey === 'synthwave-outrun' || themeKey === 'synthwave_outrun') {
      return applySynthwaveOutrun(persist);
    }
    if (themeKey === 'solarized-light' || themeKey === 'solarized_cyber_light') {
      return applySolarizedMode('light', persist);
    }
    if (themeKey === 'solarized-dark' || themeKey === 'solarized_cyber_dark') {
      return applySolarizedMode('dark', persist);
    }
    toggleHorizonGrid(false);
    return null;
  }

  /**
   * Toggles between Solarized Dark and Light.
   */
  function toggleSolarizedMode() {
    const current = getActiveMode();
    const next = current === 'dark' ? 'light' : 'dark';
    return applySolarizedMode(next, true);
  }

  /**
   * Returns current active Solarized mode.
   */
  function getActiveMode() {
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_MODE);
        if (saved === 'dark' || saved === 'light') return saved;
      } catch (_) {}
    }
    if (typeof document !== 'undefined') {
      const attr = document.documentElement.getAttribute('data-theme');
      if (attr === 'solarized-light') return 'light';
    }
    return 'dark';
  }

  /**
   * Builds the dual-mode sub-toggle DOM element.
   */
  function createSubToggleDOM() {
    const container = document.createElement('div');
    container.className = 'solarized-subtoggle-group';
    container.id = 'solarized-subtoggle-container';

    container.innerHTML = `
      <div class="solarized-subtoggle-header">
        <span class="solarized-subtoggle-title">SOLARIZED DUAL MODE</span>
        <span class="solarized-subtoggle-badge">WCAG AAA</span>
      </div>
      <div class="solarized-subtoggle-switch" role="group" aria-label="Solarized Lighting Mode Sub-Toggle">
        <button type="button" class="solarized-mode-btn mode-dark" id="solarized-mode-dark-btn" aria-label="Switch to Solarized Cyber Dark">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 3a6 6 0 0 0 9 9 9 0 1 1-9-9Z"></path>
          </svg>
          <span>Cyber Dark</span>
        </button>
        <button type="button" class="solarized-mode-btn mode-light" id="solarized-mode-light-btn" aria-label="Switch to Solarized Cyber Light">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="4"></circle>
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"></path>
          </svg>
          <span>Cyber Light</span>
        </button>
      </div>
    `;

    const darkBtn = container.querySelector('#solarized-mode-dark-btn');
    const lightBtn = container.querySelector('#solarized-mode-light-btn');

    const activeMode = getActiveMode();
    if (activeMode === 'dark') {
      darkBtn.classList.add('active');
      darkBtn.setAttribute('aria-pressed', 'true');
    } else {
      lightBtn.classList.add('active');
      lightBtn.setAttribute('aria-pressed', 'true');
    }

    darkBtn.addEventListener('click', () => {
      applySolarizedMode('dark', true);
    });

    lightBtn.addEventListener('click', () => {
      applySolarizedMode('light', true);
    });

    return container;
  }

  /**
   * Initializes theme customizer integration.
   */
  function init() {
    if (typeof document === 'undefined') return;

    try {
      const activeCustom = localStorage.getItem(STORAGE_KEY_ACTIVE_THEME);
      const rootTheme = document.documentElement.getAttribute('data-theme');

      if (rootTheme === 'synthwave-outrun' || activeCustom === 'synthwave-outrun') {
        applySynthwaveOutrun(false);
      } else if (rootTheme && rootTheme.startsWith('solarized-')) {
        const savedMode = localStorage.getItem(STORAGE_KEY_MODE);
        applySolarizedMode(savedMode === 'light' ? 'light' : 'dark', false);
      }
    } catch (_) {}
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  return {
    SOLARIZED_PALETTES,
    SYNTHWAVE_OUTRUN_PALETTE,
    applySolarizedMode,
    toggleSolarizedMode,
    applySynthwaveOutrun,
    switchTheme,
    toggleHorizonGrid,
    getActiveMode,
    createSubToggleDOM,
    init
  };
});
