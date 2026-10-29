/**
 * ArcadeVerse Theme Customizer & Centralized Master Sound Preferences
 * Folder: others/theme-sound-preferences-pratik/
 * Author: Pratik Giri (NSOC Winter Edition 2026)
 *
 * Implements accessible, persistent dark/light theme switching with OS preference sync,
 * and a centralized master audio mute preference for compatible games.
 */
(() => {
  'use strict';

  // Prevent multiple initializations if loaded repeatedly
  if (window.__ArcadePreferencesInitialized) {
    return;
  }
  window.__ArcadePreferencesInitialized = true;


  /* --------------------------------------------------------------------------
     1. Constants & Storage Keys
     -------------------------------------------------------------------------- */
  const STORAGE_KEY_THEME = 'arcadeverse:preferences:theme';
  const STORAGE_KEY_MUTED = 'arcadeverse:preferences:muted';

  // Legacy keys preserved for backward compatibility with existing platform engines
  const LEGACY_KEY_THEME_MODE = 'arcadeverse_theme_mode';
  const LEGACY_KEY_THEME = 'arcadeverse_theme';
  const LEGACY_KEY_SOUND_ENABLED = 'arcadeverse_sound_enabled';

  const SVG_ICONS = {
    sun: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path></svg>`,
    moon: `<svg viewBox="0 0 24 24"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path></svg>`,
    volumeHigh: `<svg viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`,
    volumeMute: `<svg viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>`,
    sliders: `<svg viewBox="0 0 24 24"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>`,
    reset: `<svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>`,
    info: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`
  };

  /* --------------------------------------------------------------------------
     2. Safe Storage Wrapper
     -------------------------------------------------------------------------- */
  function storageGet(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function storageSet(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      return false;
    }
  }

  function storageRemove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      return false;
    }
  }

  /* --------------------------------------------------------------------------
     3. Theme State & Logic
     -------------------------------------------------------------------------- */
  function getSystemTheme() {
    try {
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        return 'light';
      }
    } catch (e) { }
    return 'dark';
  }

  function getSavedThemePreference() {
    const directVal = storageGet(STORAGE_KEY_THEME);
    if (directVal === 'light' || directVal === 'dark') {
      return directVal;
    }
    // Fall back to legacy keys if set
    const legacyMode = storageGet(LEGACY_KEY_THEME_MODE);
    if (legacyMode === 'light' || legacyMode === 'dark') {
      return legacyMode;
    }
    const legacyTheme = storageGet(LEGACY_KEY_THEME);
    if (legacyTheme === 'light' || legacyTheme === 'dark') {
      return legacyTheme;
    }
    return null;
  }

  function hasExplicitThemePreference() {
    const val = storageGet(STORAGE_KEY_THEME);
    return val === 'light' || val === 'dark';
  }

  let currentTheme = getSavedThemePreference() || getSystemTheme();

  function applyTheme(theme, isExplicitUserAction = false) {
    currentTheme = theme === 'light' ? 'light' : 'dark';

    if (isExplicitUserAction) {
      storageSet(STORAGE_KEY_THEME, currentTheme);
      // Synchronize legacy keys
      storageSet(LEGACY_KEY_THEME_MODE, currentTheme);
      storageSet(LEGACY_KEY_THEME, currentTheme);
    }

    const root = document.documentElement;
    root.setAttribute('data-theme-mode', currentTheme);
    root.setAttribute('data-theme', currentTheme);

    if (currentTheme === 'light') {
      root.classList.add('light-theme');
      root.classList.remove('dark-theme');
    } else {
      root.classList.add('dark-theme');
      root.classList.remove('light-theme');
    }

    updateThemeUI();

    // Broadcast standard platform theme events
    window.dispatchEvent(new CustomEvent('arcadeverse:preferences:theme-changed', {
      detail: {
        theme: currentTheme,
        isLight: currentTheme === 'light',
        isExplicit: hasExplicitThemePreference()
      }
    }));
    window.dispatchEvent(new CustomEvent('arcadeverse:theme-change', {
      detail: { theme: currentTheme, isLight: currentTheme === 'light' }
    }));
  }

  function resetThemeToSystem() {
    storageRemove(STORAGE_KEY_THEME);
    storageRemove(LEGACY_KEY_THEME_MODE);
    storageRemove(LEGACY_KEY_THEME);
    applyTheme(getSystemTheme(), false);
  }

  function toggleTheme() {
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme, true);
    return nextTheme;
  }

  // Early theme application to avoid visible theme flashing
  applyTheme(currentTheme, false);

  // OS theme change listener: only reacts while user has NOT explicitly saved a theme
  if (window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
    const handleSystemThemeChange = (e) => {
      if (!hasExplicitThemePreference()) {
        applyTheme(e.matches ? 'light' : 'dark', false);
      }
    };
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleSystemThemeChange);
    } else if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(handleSystemThemeChange);
    }
  }

  /* --------------------------------------------------------------------------
     4. Master Sound State & Logic
     -------------------------------------------------------------------------- */
  function getSavedMutedPreference() {
    const directVal = storageGet(STORAGE_KEY_MUTED);
    if (directVal === 'true') return true;
    if (directVal === 'false') return false;

    // Check legacy sound enabled flag if present
    const legacySound = storageGet(LEGACY_KEY_SOUND_ENABLED);
    if (legacySound === 'false') return true;
    if (legacySound === 'true') return false;

    // Default to unmuted per requirement
    return false;
  }

  let isMuted = getSavedMutedPreference();

  function notifyCompatibleGames(mutedState) {
    // 1. Send cross-frame message to game-iframe
    const iframe = document.getElementById('game-iframe');
    if (iframe && iframe.contentWindow) {
      try {
        iframe.contentWindow.postMessage({
          type: 'arcadeverse:sound-toggle',
          enabled: !mutedState,
          muted: mutedState
        }, '*');
      } catch (e) {
        // Cross-origin access restrictions handled safely
      }
    }
  }

  function setMuted(muted, persist = true) {
    isMuted = Boolean(muted);

    if (persist) {
      storageSet(STORAGE_KEY_MUTED, isMuted ? 'true' : 'false');
      // Sync legacy key so games reading it directly observe the master state
      storageSet(LEGACY_KEY_SOUND_ENABLED, isMuted ? 'false' : 'true');
    }

    // Synchronize with existing shared ArcadeSoundEngine if present
    if (window.ArcadeSoundEngine && typeof window.ArcadeSoundEngine.isEnabled === 'function') {
      const soundEngineEnabled = window.ArcadeSoundEngine.isEnabled();
      const shouldBeEnabled = !isMuted;
      if (soundEngineEnabled !== shouldBeEnabled) {
        if (typeof window.ArcadeSoundEngine.setMuted === 'function') {
          window.ArcadeSoundEngine.setMuted(isMuted);
        } else if (typeof window.ArcadeSoundEngine.toggle === 'function') {
          window.ArcadeSoundEngine.toggle(shouldBeEnabled);
        }
      }
    }

    notifyCompatibleGames(isMuted);
    updateSoundUI();

    // Broadcast standard platform audio events
    window.dispatchEvent(new CustomEvent('arcadeverse:preferences:sound-changed', {
      detail: { muted: isMuted, enabled: !isMuted }
    }));
    window.dispatchEvent(new CustomEvent('arcadeverse:sound-change', {
      detail: { muted: isMuted, enabled: !isMuted }
    }));

    return isMuted;
  }

  function toggleMuted() {
    return setMuted(!isMuted, true);
  }

  // When a game is loaded into the modal, ensure master mute is dispatched
  window.addEventListener('arcadeverse:game-launched', () => {
    notifyCompatibleGames(isMuted);
  });

  /* --------------------------------------------------------------------------
     5. Cross-Tab Preference Synchronization
     -------------------------------------------------------------------------- */
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY_THEME || e.key === LEGACY_KEY_THEME_MODE) {
      const updatedTheme = getSavedThemePreference();
      if (updatedTheme && updatedTheme !== currentTheme) {
        applyTheme(updatedTheme, false);
      } else if (!updatedTheme) {
        applyTheme(getSystemTheme(), false);
      }
    }

    if (e.key === STORAGE_KEY_MUTED || e.key === LEGACY_KEY_SOUND_ENABLED) {
      const updatedMuted = getSavedMutedPreference();
      if (updatedMuted !== isMuted) {
        setMuted(updatedMuted, false);
      }
    }
  });

  /* --------------------------------------------------------------------------
     6. UI Synchronization & Accessible Control Binding
     -------------------------------------------------------------------------- */
  function updateThemeUI() {
    const isLight = currentTheme === 'light';
    const isExplicit = hasExplicitThemePreference();

    // Injected / Standalone Segmented Controls
    document.querySelectorAll('[data-pref-theme-segment]').forEach((btn) => {
      const targetTheme = btn.getAttribute('data-pref-theme-segment');
      const isSelected = targetTheme === currentTheme;
      btn.classList.toggle('active', isSelected);
      btn.setAttribute('aria-checked', isSelected ? 'true' : 'false');
      btn.tabIndex = isSelected ? 0 : -1;
    });

    // Injected Status Badge
    document.querySelectorAll('[data-pref-theme-status]').forEach((el) => {
      if (isExplicit) {
        el.textContent = isLight ? 'User: Light' : 'User: Dark';
      } else {
        el.textContent = `System: ${isLight ? 'Light' : 'Dark'}`;
      }
    });

    // Reset button visibility
    document.querySelectorAll('[data-pref-reset-theme-btn]').forEach((btn) => {
      btn.style.display = isExplicit ? 'inline-flex' : 'none';
    });

    // Synchronize existing navbar theme button (#theme-toggle-btn) if present
    const desktopThemeBtn = document.getElementById('theme-toggle-btn');
    if (desktopThemeBtn) {
      desktopThemeBtn.innerHTML = isLight ? SVG_ICONS.moon : SVG_ICONS.sun;
      desktopThemeBtn.setAttribute('aria-label', isLight ? 'Switch to dark theme' : 'Switch to light theme');
      desktopThemeBtn.setAttribute('title', isLight ? 'Theme: Light (Click for Dark)' : 'Theme: Dark (Click for Light)');
      desktopThemeBtn.setAttribute('aria-pressed', isLight ? 'true' : 'false');
      desktopThemeBtn.classList.toggle('is-light', isLight);
    }

    // Synchronize existing mobile drawer theme button (#mobile-theme-btn) if present
    const mobileThemeBtn = document.getElementById('mobile-theme-btn');
    if (mobileThemeBtn) {
      const iconSlot = mobileThemeBtn.querySelector('.theme-icon-slot');
      const labelSlot = mobileThemeBtn.querySelector('.theme-label-slot');
      if (iconSlot) iconSlot.innerHTML = isLight ? SVG_ICONS.moon : SVG_ICONS.sun;
      if (labelSlot) labelSlot.textContent = isLight ? 'Theme: Light' : 'Theme: Dark';
      mobileThemeBtn.setAttribute('aria-label', isLight ? 'Switch to dark theme' : 'Switch to light theme');
      mobileThemeBtn.setAttribute('title', isLight ? 'Switch to dark theme' : 'Switch to light theme');
      mobileThemeBtn.classList.toggle('is-light', isLight);
    }
  }

  function updateSoundUI() {
    // Injected Switch Checkboxes
    document.querySelectorAll('[data-pref-sound-switch]').forEach((input) => {
      // Checked = Unmuted (Audio on)
      input.checked = !isMuted;
      input.setAttribute('aria-checked', (!isMuted) ? 'true' : 'false');
    });

    // Standalone / Injected Sound Status Labels
    document.querySelectorAll('[data-pref-sound-status]').forEach((el) => {
      el.textContent = isMuted ? 'Muted' : 'Unmuted';
    });

    // Sound toggle card classes and icons
    document.querySelectorAll('.sound-toggle-card').forEach((card) => {
      card.classList.toggle('is-muted', isMuted);
      const iconSlot = card.querySelector('.sound-toggle-icon');
      if (iconSlot) {
        iconSlot.innerHTML = isMuted ? SVG_ICONS.volumeMute : SVG_ICONS.volumeHigh;
      }
    });

    // Synchronize existing navbar sound button (#sound-toggle-btn) if present
    const desktopSoundBtn = document.getElementById('sound-toggle-btn');
    if (desktopSoundBtn) {
      desktopSoundBtn.innerHTML = isMuted ? SVG_ICONS.volumeMute : SVG_ICONS.volumeHigh;
      desktopSoundBtn.setAttribute('aria-label', isMuted ? 'Unmute master audio' : 'Mute master audio');
      desktopSoundBtn.setAttribute('title', isMuted ? 'Master Sound: MUTED (Click to unmute)' : 'Master Sound: ON (Click to mute)');
      desktopSoundBtn.classList.toggle('sound-on', !isMuted);
      desktopSoundBtn.classList.toggle('sound-muted', isMuted);
    }

    // Synchronize existing mobile drawer sound button (#mobile-sound-btn) if present
    const mobileSoundBtn = document.getElementById('mobile-sound-btn');
    if (mobileSoundBtn) {
      const iconSlot = mobileSoundBtn.querySelector('.sound-icon-slot');
      const labelSlot = mobileSoundBtn.querySelector('.sound-label-slot');
      if (iconSlot) iconSlot.innerHTML = isMuted ? SVG_ICONS.volumeMute : SVG_ICONS.volumeHigh;
      if (labelSlot) labelSlot.textContent = isMuted ? 'Sound: MUTED' : 'Sound: ON';
      mobileSoundBtn.setAttribute('aria-label', isMuted ? 'Unmute master audio' : 'Mute master audio');
      mobileSoundBtn.setAttribute('title', isMuted ? 'Unmute master audio' : 'Mute master audio');
      mobileSoundBtn.classList.toggle('sound-on', !isMuted);
    }

    // Synchronize modal sound button (#modal-sound-btn) if present
    const modalSoundBtn = document.getElementById('modal-sound-btn');
    if (modalSoundBtn) {
      modalSoundBtn.innerHTML = isMuted ? SVG_ICONS.volumeMute : SVG_ICONS.volumeHigh;
      modalSoundBtn.setAttribute('aria-label', isMuted ? 'Unmute master audio' : 'Mute master audio');
      modalSoundBtn.setAttribute('title', isMuted ? 'Master Sound: MUTED' : 'Master Sound: ON');
      modalSoundBtn.classList.toggle('sound-on', !isMuted);
    }
  }

  /* --------------------------------------------------------------------------
     7. Dynamic Injected Panel for index.html (Background Plugin Mode)
     -------------------------------------------------------------------------- */
  function injectPreferencesUI() {
    // Only inject navbar trigger on platform pages with .nav-actions
    const navActions = document.querySelector('.nav-actions');
    if (navActions && !document.getElementById('preferences-nav-btn')) {
      const prefBtn = document.createElement('button');
      prefBtn.id = 'preferences-nav-btn';
      prefBtn.className = 'btn btn-icon preferences-nav-btn';
      prefBtn.type = 'button';
      prefBtn.setAttribute('title', 'Preferences: Theme & Sound (Click to configure)');
      prefBtn.setAttribute('aria-label', 'Open Theme and Master Sound Preferences');
      prefBtn.setAttribute('aria-expanded', 'false');
      prefBtn.setAttribute('aria-controls', 'preferences-panel');
      prefBtn.innerHTML = SVG_ICONS.sliders;

      // Insert before mobile menu button or at the end
      const mobileBtn = document.getElementById('mobile-menu-btn');
      if (mobileBtn) {
        navActions.insertBefore(prefBtn, mobileBtn);
      } else {
        navActions.appendChild(prefBtn);
      }

      // Flyout Panel
      let panel = document.getElementById('preferences-panel');
      if (!panel) {
        panel = document.createElement('div');
        panel.id = 'preferences-panel';
        panel.className = 'preferences-panel';
        panel.setAttribute('role', 'region');
        panel.setAttribute('aria-label', 'ArcadeVerse Preferences');
        panel.innerHTML = `
          <div class="preferences-panel-header">
            <h3 class="preferences-panel-title">
              ${SVG_ICONS.sliders} Preferences
            </h3>
            <button type="button" class="preferences-close-btn" id="preferences-close-btn" aria-label="Close preferences panel">
              &times;
            </button>
          </div>

          <div class="preferences-group">
            <div class="preferences-label-row">
              <span class="preferences-group-label" id="theme-group-label">Theme Mode</span>
              <span class="preferences-status-badge" data-pref-theme-status>Dark</span>
            </div>
            <div class="theme-segmented-control" role="radiogroup" aria-labelledby="theme-group-label">
              <button type="button" class="theme-segment-btn" role="radio" data-pref-theme-segment="dark" aria-label="Dark Theme" aria-checked="false">
                ${SVG_ICONS.moon} Dark
              </button>
              <button type="button" class="theme-segment-btn" role="radio" data-pref-theme-segment="light" aria-label="Light Theme" aria-checked="false">
                ${SVG_ICONS.sun} Light
              </button>
            </div>
          </div>

          <div class="preferences-group">
            <div class="preferences-label-row">
              <span class="preferences-group-label">Master Audio</span>
              <span class="preferences-status-badge" data-pref-sound-status>Unmuted</span>
            </div>
            <div class="sound-toggle-card">
              <div class="sound-toggle-info">
                <div class="sound-toggle-icon">
                  ${SVG_ICONS.volumeHigh}
                </div>
                <div class="sound-toggle-meta">
                  <span class="sound-toggle-title">Game Audio & SFX</span>
                  <span class="sound-toggle-subtitle">Centralized master mute</span>
                </div>
              </div>
              <label class="switch-control" for="panel-sound-switch">
                <input type="checkbox" id="panel-sound-switch" data-pref-sound-switch aria-label="Master sound toggle">
                <span class="switch-slider"></span>
              </label>
            </div>
          </div>

          <div class="preferences-compat-note">
            ${SVG_ICONS.info}
            <span>Master mute is broadcast to compatible games via postMessage and parent engine while preserving in-game volume settings.</span>
          </div>

          <div class="preferences-panel-actions">
            <button type="button" class="preferences-action-btn" data-pref-reset-theme-btn style="display: none;">
              ${SVG_ICONS.reset} Match System
            </button>
            <a href="others/theme-sound-preferences-pratik/feature.html" class="preferences-action-btn" title="Open full preferences and test page">
              Advanced Tester &rarr;
            </a>
          </div>
        `;
        document.body.appendChild(panel);
      }

      // Panel toggle interaction
      prefBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = panel.classList.toggle('open');
        prefBtn.classList.toggle('active', isOpen);
        prefBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      });

      const closeBtn = panel.querySelector('#preferences-close-btn');
      if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          panel.classList.remove('open');
          prefBtn.classList.remove('active');
          prefBtn.setAttribute('aria-expanded', 'false');
          prefBtn.focus();
        });
      }

      panel.addEventListener('click', (e) => {
        e.stopPropagation();
      });

      document.addEventListener('click', () => {
        if (panel.classList.contains('open')) {
          panel.classList.remove('open');
          prefBtn.classList.remove('active');
          prefBtn.setAttribute('aria-expanded', 'false');
        }
      });

      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && panel.classList.contains('open')) {
          panel.classList.remove('open');
          prefBtn.classList.remove('active');
          prefBtn.setAttribute('aria-expanded', 'false');
          prefBtn.focus();
        }
      });
    }

    bindPreferenceControls();
  }

  /* --------------------------------------------------------------------------
     8. Event Binding for Controls (Panel & Standalone Page)
     -------------------------------------------------------------------------- */
  function bindPreferenceControls() {
    // Theme Segmented Buttons
    document.querySelectorAll('[data-pref-theme-segment]').forEach((btn) => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = 'true';

      btn.addEventListener('click', () => {
        const theme = btn.getAttribute('data-pref-theme-segment');
        applyTheme(theme, true);
      });

      // Keyboard navigation for segmented radio control (Arrow keys)
      btn.addEventListener('keydown', (e) => {
        const parent = btn.closest('[role="radiogroup"]');
        if (!parent) return;
        const segments = Array.from(parent.querySelectorAll('[data-pref-theme-segment]'));
        const idx = segments.indexOf(btn);

        let nextIdx = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          nextIdx = (idx + 1) % segments.length;
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          nextIdx = (idx - 1 + segments.length) % segments.length;
        } else if (e.key === 'Home') {
          nextIdx = 0;
        } else if (e.key === 'End') {
          nextIdx = segments.length - 1;
        }

        if (nextIdx !== null) {
          e.preventDefault();
          segments[nextIdx].focus();
          const targetTheme = segments[nextIdx].getAttribute('data-pref-theme-segment');
          applyTheme(targetTheme, true);
        }
      });
    });

    // Reset to System Theme Buttons
    document.querySelectorAll('[data-pref-reset-theme-btn]').forEach((btn) => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = 'true';
      btn.addEventListener('click', () => {
        resetThemeToSystem();
      });
    });

    // Sound Switch Checkboxes
    document.querySelectorAll('[data-pref-sound-switch]').forEach((input) => {
      if (input.dataset.bound) return;
      input.dataset.bound = 'true';
      input.addEventListener('change', (e) => {
        // Checked = Unmuted -> muted is !checked
        setMuted(!e.target.checked, true);
      });
    });

    // Sound Toggle Card Click (Whole row toggle convenience)
    document.querySelectorAll('.sound-toggle-card').forEach((card) => {
      if (card.dataset.bound) return;
      card.dataset.bound = 'true';
      card.addEventListener('click', (e) => {
        if (e.target.closest('label') || e.target.closest('input')) return;
        toggleMuted();
      });
    });

    // Intercept existing platform theme/sound buttons to ensure full sync
    const existingThemeBtn = document.getElementById('theme-toggle-btn');
    if (existingThemeBtn && !existingThemeBtn.dataset.prefSyncBound) {
      existingThemeBtn.dataset.prefSyncBound = 'true';
      existingThemeBtn.addEventListener('click', (e) => {
        // Allow theme.js or default handler, then update our state
        setTimeout(() => {
          const rootTheme = document.documentElement.getAttribute('data-theme-mode') || document.documentElement.getAttribute('data-theme');
          if (rootTheme && rootTheme !== currentTheme) {
            applyTheme(rootTheme, true);
          }
        }, 10);
      });
    }

    const existingSoundBtn = document.getElementById('sound-toggle-btn');
    if (existingSoundBtn && !existingSoundBtn.dataset.prefSyncBound) {
      existingSoundBtn.dataset.prefSyncBound = 'true';
      existingSoundBtn.addEventListener('click', () => {
        setTimeout(() => {
          toggleMuted();
        }, 10);
      });
    }

    updateThemeUI();
    updateSoundUI();
  }

  /* --------------------------------------------------------------------------
     9. Interactive Web Audio Preview Tester (for Standalone Page)
     -------------------------------------------------------------------------- */
  let testAudioCtx = null;

  function playTestTone() {
    if (isMuted) {
      const feedback = document.getElementById('audio-test-feedback');
      if (feedback) {
        feedback.innerHTML = `<span class="muted-state">[MUTED] Audio suppressed. Master mute preference is ACTIVE.</span>`;
      }
      return false;
    }

    try {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtxClass) return false;
      if (!testAudioCtx) {
        testAudioCtx = new AudioCtxClass();
      }
      if (testAudioCtx.state === 'suspended') {
        testAudioCtx.resume();
      }

      const now = testAudioCtx.currentTime;
      const osc = testAudioCtx.createOscillator();
      const gain = testAudioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.12); // G5

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(testAudioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.12);

      const feedback = document.getElementById('audio-test-feedback');
      if (feedback) {
        feedback.innerHTML = `<span class="highlight">[UNMUTED] 8-Bit Tone synthesized via Web Audio API at 523Hz &rarr; 784Hz.</span>`;
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  /* --------------------------------------------------------------------------
     10. Bootstrap & Lifecycle
     -------------------------------------------------------------------------- */
  function init() {
    injectPreferencesUI();
    bindPreferenceControls();

    // Standalone page test button binding
    const testToneBtn = document.getElementById('play-test-sound-btn');
    if (testToneBtn && !testToneBtn.dataset.bound) {
      testToneBtn.dataset.bound = 'true';
      testToneBtn.addEventListener('click', playTestTone);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* --------------------------------------------------------------------------
     11. Public Platform API
     -------------------------------------------------------------------------- */
  window.ArcadePreferences = {
    getTheme: () => currentTheme,
    setTheme: (theme) => applyTheme(theme, true),
    toggleTheme,
    resetThemeToSystem,
    hasExplicitTheme: hasExplicitThemePreference,
    getSystemTheme,
    isMuted: () => isMuted,
    setMuted: (muted) => setMuted(muted, true),
    toggleMuted,
    notifyCompatibleGames: () => notifyCompatibleGames(isMuted),
    playTestTone
  };
})();
