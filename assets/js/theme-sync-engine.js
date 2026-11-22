/**
 * ArcadeVerse System prefers-color-scheme Live Media Listener & Auto-Sync Engine
 * Author: Babin123456
 *
 * Implements real-time synchronization between browser/OS color preferences (prefers-color-scheme)
 * and ArcadeVerse hub theme modes. Integrates seamlessly with navbar.js theme controllers.
 */

(function () {
  'use strict';

  const STORAGE_KEY_THEME = 'arcadeverse_theme_mode';
  const STORAGE_KEY_ALT = 'arcadeverse_theme';
  const STORAGE_KEY_MANUAL = 'arcadeverse_theme_manual';

  let darkMedia = null;
  let lightMedia = null;

  function hasManualOverride() {
    try {
      if (localStorage.getItem(STORAGE_KEY_MANUAL) === 'true') {
        return true;
      }
      const themeVal = localStorage.getItem(STORAGE_KEY_THEME) || localStorage.getItem(STORAGE_KEY_ALT);
      if (themeVal === 'light' || themeVal === 'dark') {
        return localStorage.getItem(STORAGE_KEY_MANUAL) !== 'false';
      }
    } catch (_) {}
    return false;
  }

  function getSystemPreferredTheme() {
    if (typeof window !== 'undefined' && window.matchMedia) {
      if (window.matchMedia('(prefers-color-scheme: light)').matches) {
        return 'light';
      }
    }
    return 'dark';
  }

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

  function applyTheme(mode, isManualAction = false) {
    if (window.ArcadeTheme && typeof window.ArcadeTheme.setTheme === 'function') {
      window.ArcadeTheme.setTheme(mode);
      if (isManualAction) {
        try {
          localStorage.setItem(STORAGE_KEY_MANUAL, 'true');
        } catch (_) {}
      }
      return;
    }

    const root = document.documentElement;
    root.setAttribute('data-theme', mode);

    try {
      localStorage.setItem(STORAGE_KEY_THEME, mode);
      localStorage.setItem(STORAGE_KEY_ALT, mode);
      if (isManualAction) {
        localStorage.setItem(STORAGE_KEY_MANUAL, 'true');
      }
    } catch (_) {}

    document.querySelectorAll('.theme-toggle-btn').forEach((btn) => {
      const nextLabel = mode === 'light' ? 'Switch to dark theme' : 'Switch to light theme';
      btn.setAttribute('aria-label', nextLabel);
      btn.setAttribute('title', nextLabel);
      const iconWrap = btn.querySelector('.theme-icon-wrap') || btn.querySelector('.mobile-nav-icon');
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

    window.dispatchEvent(new CustomEvent('arcadeverse:theme-mode-changed', {
      detail: {
        mode: mode,
        isManual: isManualAction,
        systemMode: getSystemPreferredTheme()
      }
    }));
  }

  function setupLiveMediaListeners() {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    darkMedia = window.matchMedia('(prefers-color-scheme: dark)');
    lightMedia = window.matchMedia('(prefers-color-scheme: light)');

    const handleSystemChange = (e) => {
      try {
        const manualSaved = localStorage.getItem(STORAGE_KEY_MANUAL);
        if (manualSaved !== 'true') {
          const newSystemTheme = e.matches ? (e.media.includes('dark') ? 'dark' : 'light') : (e.media.includes('dark') ? 'light' : 'dark');
          applyTheme(newSystemTheme, false);
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

  // Setup DOM and listeners safely without duplicate click interception
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setupLiveMediaListeners();
    });
  } else {
    setupLiveMediaListeners();
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
