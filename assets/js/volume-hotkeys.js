/**
 * ArcadeVerse - Master Volume Keyboard Hotkeys HUD Overlay
 * Architectural Implementation for Issue #1496
 *
 * - Global keyboard shortcuts:
 *   - '[' or Ctrl+ArrowDown: Volume Down (-5%)
 *   - ']' or Ctrl+ArrowUp: Volume Up (+5%)
 *   - 'M' (outside text inputs): Toggle Mute
 * - Updates global SoundEngine / <audio> / <video> master volume and persists
 *   to localStorage ('arcadeverse_master_volume').
 * - Renders floating OSD HUD overlay with speaker icon, percentage, and 20-segment bar,
 *   auto-fading after 1.5 seconds of inactivity.
 * - 100% Vanilla JS; zero external dependencies.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ArcadeVolumeHotkeys = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VOLUME_KEY = 'arcadeverse_master_volume';
  var MUTE_KEY = 'arcadeverse_muted';
  var SOUND_SETTINGS_KEY = 'arcadeverse_sound_settings';
  var STEP_PERCENT = 5;
  var HUD_TIMEOUT_MS = 1500;
  var TOTAL_SEGMENTS = 20;

  var volumePercent = loadVolumePercent();
  var muted = loadMuted();
  var hudTimerId = null;
  var hudVisible = false;

  function clampPercent(val) {
    var n = Math.round(Number(val));
    if (isNaN(n)) return 28;
    return Math.max(0, Math.min(100, n));
  }

  function loadVolumePercent() {
    try {
      if (typeof localStorage !== 'undefined') {
        var raw = localStorage.getItem(VOLUME_KEY);
        if (raw !== null) {
          var f = parseFloat(raw);
          if (!isNaN(f)) return clampPercent(f * 100);
        }
        var settings = localStorage.getItem(SOUND_SETTINGS_KEY);
        if (settings) {
          var parsed = JSON.parse(settings);
          if (parsed && typeof parsed.volume === 'number') {
            return clampPercent(parsed.volume * 100);
          }
        }
      }
    } catch (_) {}
    return 28;
  }

  function loadMuted() {
    try {
      if (typeof localStorage !== 'undefined') {
        if (localStorage.getItem(MUTE_KEY) === 'true') return true;
        var settings = localStorage.getItem(SOUND_SETTINGS_KEY);
        if (settings) {
          var parsed = JSON.parse(settings);
          if (parsed && typeof parsed.enabled === 'boolean') {
            return !parsed.enabled;
          }
        }
      }
    } catch (_) {}
    return false;
  }

  function saveState() {
    var volFloat = Math.round((volumePercent / 100) * 1000) / 1000;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(VOLUME_KEY, String(volFloat));
        localStorage.setItem(MUTE_KEY, muted ? 'true' : 'false');
        localStorage.setItem(SOUND_SETTINGS_KEY, JSON.stringify({
          enabled: !muted,
          volume: volFloat
        }));
      }
    } catch (_) {}
  }

  function applyAudioBus() {
    var volFloat = Math.round((volumePercent / 100) * 1000) / 1000;

    if (typeof window !== 'undefined' && window.SoundEngine) {
      window.SoundEngine.volume = volFloat;
      window.SoundEngine.enabled = !muted;
      if (typeof window.SoundEngine.broadcastAudioConfig === 'function') {
        window.SoundEngine.broadcastAudioConfig();
      }
      if (typeof window.SoundEngine.updateUI === 'function') {
        window.SoundEngine.updateUI();
      }
    }

    if (typeof document !== 'undefined') {
      var mediaEls = document.querySelectorAll('audio, video');
      for (var i = 0; i < mediaEls.length; i++) {
        mediaEls[i].volume = volFloat;
        mediaEls[i].muted = muted;
      }
    }

    if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
      window.dispatchEvent(new CustomEvent('arcadeverse:sound-mode-changed', {
        detail: {
          enabled: !muted,
          muted: muted,
          volume: volFloat
        }
      }));
    }
  }

  function setVolumePercent(nextPercent, showHudFlag) {
    volumePercent = clampPercent(nextPercent);
    if (volumePercent > 0 && muted) {
      muted = false;
    }
    saveState();
    applyAudioBus();
    if (showHudFlag !== false) showHud();
    return volumePercent;
  }

  function adjustVolume(deltaPercent) {
    return setVolumePercent(volumePercent + deltaPercent, true);
  }

  function toggleMute() {
    muted = !muted;
    saveState();
    applyAudioBus();
    showHud();
    return muted;
  }

  function isTextInputElement(target) {
    if (!target) return false;
    var tag = target.tagName ? String(target.tagName).toUpperCase() : '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    return Boolean(target.isContentEditable);
  }

  function ensureHudEl() {
    if (typeof document === 'undefined' || !document.body) return null;
    var existing = document.getElementById('volume-hotkeys-hud');
    if (existing) return existing;

    var hud = document.createElement('div');
    hud.id = 'volume-hotkeys-hud';
    hud.className = 'volume-hud-overlay';
    hud.setAttribute('role', 'status');
    hud.setAttribute('aria-live', 'polite');
    hud.setAttribute('aria-hidden', 'true');

    var segmentsHtml = '';
    for (var i = 0; i < TOTAL_SEGMENTS; i++) {
      segmentsHtml += '<span class="volume-hud-segment"></span>';
    }

    hud.innerHTML =
      '<div class="volume-hud-icon" id="volume-hud-icon" aria-hidden="true"></div>' +
      '<div class="volume-hud-body">' +
      '  <div class="volume-hud-top">' +
      '    <span id="volume-hud-label">Master Volume</span>' +
      '    <span class="volume-hud-percent" id="volume-hud-percent">28%</span>' +
      '  </div>' +
      '  <div class="volume-hud-segments" id="volume-hud-segments">' + segmentsHtml + '</div>' +
      '</div>';

    document.body.appendChild(hud);
    return hud;
  }

  function hideHud() {
    hudVisible = false;
    if (hudTimerId) {
      clearTimeout(hudTimerId);
      hudTimerId = null;
    }
    if (typeof document !== 'undefined') {
      var hud = document.getElementById('volume-hotkeys-hud');
      if (hud) {
        hud.classList.remove('is-visible');
        hud.setAttribute('aria-hidden', 'true');
      }
    }
  }

  function showHud(timeoutMs) {
    hudVisible = true;
    if (hudTimerId) clearTimeout(hudTimerId);

    var delay = typeof timeoutMs === 'number' ? timeoutMs : HUD_TIMEOUT_MS;
    hudTimerId = setTimeout(hideHud, delay);

    if (typeof document === 'undefined') return;
    var hud = ensureHudEl();
    if (!hud) return;

    var isMutedNow = muted || volumePercent === 0;
    hud.classList.toggle('is-muted', isMutedNow);

    var iconEl = document.getElementById('volume-hud-icon');
    if (iconEl) {
      iconEl.innerHTML = isMutedNow
        ? '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>'
        : '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>';
    }

    var labelEl = document.getElementById('volume-hud-label');
    var pctEl = document.getElementById('volume-hud-percent');
    if (labelEl) labelEl.textContent = isMutedNow ? 'Audio Muted' : 'Master Volume';
    if (pctEl) pctEl.textContent = isMutedNow ? 'MUTED' : volumePercent + '%';

    var filledCount = Math.round((volumePercent / 100) * TOTAL_SEGMENTS);
    var segs = hud.querySelectorAll('.volume-hud-segment');
    for (var i = 0; i < segs.length; i++) {
      segs[i].classList.toggle('is-filled', i < filledCount);
    }

    hud.classList.add('is-visible');
    hud.setAttribute('aria-hidden', 'false');
  }

  /**
   * Handles keyboard shortcuts for volume up, volume down, and mute toggle.
   *
   * @param {Object} e - KeyboardEvent
   * @returns {boolean} True if handled
   */
  function handleKeyDown(e) {
    if (!e || isTextInputElement(e.target)) return false;

    var key = e.key;
    if (key === '[' || (e.ctrlKey && key === 'ArrowDown')) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      adjustVolume(-STEP_PERCENT);
      return true;
    }
    if (key === ']' || (e.ctrlKey && key === 'ArrowUp')) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      adjustVolume(STEP_PERCENT);
      return true;
    }
    if ((key === 'm' || key === 'M') && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      toggleMute();
      return true;
    }
    return false;
  }

  function init() {
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', handleKeyDown);
  }

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  return {
    VOLUME_KEY: VOLUME_KEY,
    STEP_PERCENT: STEP_PERCENT,
    HUD_TIMEOUT_MS: HUD_TIMEOUT_MS,
    setVolumePercent: setVolumePercent,
    adjustVolume: adjustVolume,
    toggleMute: toggleMute,
    handleKeyDown: handleKeyDown,
    showHud: showHud,
    hideHud: hideHud,
    getState: function () {
      return {
        volumePercent: volumePercent,
        muted: muted,
        hudVisible: hudVisible
      };
    }
  };
});
