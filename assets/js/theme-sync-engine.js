/**
 * ArcadeVerse System prefers-color-scheme Live Media Listener & Auto-Sync Engine
 * Author: Babin123456
 *
 * Implements real-time synchronization between browser/OS color preferences (prefers-color-scheme)
 * and ArcadeVerse hub theme modes. Honors manual overrides through localStorage flags:
 * - arcadeverse_theme_mode / arcadeverse_theme
 * - arcadeverse_theme_manual
 */

(function () {
  'use strict';

  const STORAGE_KEY_THEME = 'arcadeverse_theme_mode';
  const STORAGE_KEY_ALT = 'arcadeverse_theme';
  const STORAGE_KEY_MANUAL = 'arcadeverse_theme_manual';

  let darkMedia = null;
  let lightMedia = null;

  /**
   * Determine whether the user has explicitly set a manual theme override
   */
  function hasManualOverride() {
    try {
      if (localStorage.getItem(STORAGE_KEY_MANUAL) === 'true') {
        return true;
      }
      const themeVal = localStorage.getItem(STORAGE_KEY_THEME) || localStorage.getItem(STORAGE_KEY_ALT);
      if (themeVal === 'light' || themeVal === 'dark') {
        // If theme key is present and flagged as manual, return true
        return localStorage.getItem(STORAGE_KEY_MANUAL) !== 'false';
      }
    } catch (_) {}
    return false;
  }

  /**
   * Queries operating system preference
   */
  function getSystemPreferredTheme() {
    if (typeof window !== 'undefined' && window.matchMedia) {
      if (window.matchMedia('(prefers-color-scheme: light)').matches) {
        return 'light';
      }
    }
    return 'dark';
  }

  /**
   * Resolves the active theme on boot
   */
  function resolveEffectiveTheme() {
    try {
      const isManual = localStorage.getItem(STORAGE_KEY_MANUAL) === 'true';
      const storedTheme = localStorage.getItem(STORAGE_KEY_THEME) || localStorage.getItem(STORAGE_KEY_ALT);

      if (isManual && (storedTheme === 'light' || storedTheme === 'dark')) {
        return storedTheme;
      }
    } catch (_) {}

    return getSystemPreferredTheme();
  }

  /**
   * Applies the theme to DOM and synchronizes UI toggle buttons
   * @param {string} mode - 'light' | 'dark'
   * @param {boolean} isManualAction - whether triggered by direct user click
   */
  function applyTheme(mode, isManualAction = false) {
    const root = document.documentElement;
    root.setAttribute('data-theme', mode);

    try {
      localStorage.setItem(STORAGE_KEY_THEME, mode);
      localStorage.setItem(STORAGE_KEY_ALT, mode);
      if (isManualAction) {
        localStorage.setItem(STORAGE_KEY_MANUAL, 'true');
      }
    } catch (_) {}

    // Update Theme Toggle Buttons
    document.querySelectorAll('.theme-toggle-btn').forEach((btn) => {
      const nextLabel = mode === 'light' ? 'Switch to dark theme' : 'Switch to light theme';
      btn.setAttribute('aria-label', nextLabel);
      btn.setAttribute('title', nextLabel);
      const iconWrap = btn.querySelector('.theme-icon-wrap');
      if (iconWrap) {
        iconWrap.innerHTML = mode === 'light' ? '<i data-lucide="moon"></i>' : '<i data-lucide="sun"></i>';
      }
      const labelText = btn.querySelector('.theme-label-text');
      if (labelText) {
        labelText.textContent = mode === 'light' ? 'Switch to Dark Theme' : 'Switch to Light Theme';
      }
    });

    if (window.lucide) {
      lucide.createIcons();
    }

    // Broadcast theme change event
    window.dispatchEvent(new CustomEvent('arcadeverse:theme-mode-changed', {
      detail: {
        mode: mode,
        isManual: isManualAction,
        systemMode: getSystemPreferredTheme()
      }
    }));
  }

  /**
   * Initializes Live System Media Query Listeners
   */
  function setupLiveMediaListeners() {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    darkMedia = window.matchMedia('(prefers-color-scheme: dark)');
    lightMedia = window.matchMedia('(prefers-color-scheme: light)');

    const handleSystemChange = (e) => {
      try {
        const manualSaved = localStorage.getItem(STORAGE_KEY_MANUAL);
        // Only react automatically if user has not explicitly set a manual preference
        if (manualSaved !== 'true') {
          const newSystemTheme = e.matches ? (e.media.includes('dark') ? 'dark' : 'light') : (e.media.includes('dark') ? 'light' : 'dark');
          applyTheme(newSystemTheme, false);
          console.log(`[ThemeSync] System prefers-color-scheme changed: applied "${newSystemTheme}".`);
        }
      } catch (err) {
        console.warn('[ThemeSync] Media change handler error:', err);
      }
    };

    if (typeof darkMedia.addEventListener === 'function') {
      darkMedia.addEventListener('change', handleSystemChange);
    } else if (typeof darkMedia.addListener === 'function') {
      darkMedia.addListener(handleSystemChange);
    }

    if (typeof lightMedia.addEventListener === 'function') {
      lightMedia.addEventListener('change', handleSystemChange);
    } else if (typeof lightMedia.addListener === 'function') {
      lightMedia.addListener(handleSystemChange);
    }
  }

  /**
   * Bind Theme Toggle Button clicks to record manual override
   */
  function bindManualToggleInterceptors() {
    document.querySelectorAll('.theme-toggle-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme') || 'dark';
        const next = current === 'light' ? 'dark' : 'light';
        applyTheme(next, true);
      });
    });
  }

  // Initial Boot Execution: Apply immediately to prevent FOUC
  const initialTheme = resolveEffectiveTheme();
  document.documentElement.setAttribute('data-theme', initialTheme);

  // Setup DOM and listeners
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      applyTheme(initialTheme, false);
      setupLiveMediaListeners();
      bindManualToggleInterceptors();
    });
  } else {
    applyTheme(initialTheme, false);
    setupLiveMediaListeners();
    bindManualToggleInterceptors();
  }

  // Global Export
  window.ArcadeThemeSync = {
    getTheme: () => document.documentElement.getAttribute('data-theme') || resolveEffectiveTheme(),
    getSystemTheme: getSystemPreferredTheme,
    isManualOverride: hasManualOverride,
    applyTheme: (m) => applyTheme(m, true),
    resetToSystem: () => {
      try {
        localStorage.removeItem(STORAGE_KEY_MANUAL);
      } catch (_) {}
      applyTheme(getSystemPreferredTheme(), false);
    }
  };
})();
