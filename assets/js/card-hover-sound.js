/**
 * ArcadeVerse - Game Card Hover Sound Feedback with Subtle Retro Click Tones
 * Architectural Implementation for Issue #1508
 *
 * - Lightweight Web Audio API synthesizer producing a crisp 30ms retro blip
 *   (triangle wave at 880Hz decaying rapidly).
 * - Zero external audio files (.mp3/.wav).
 * - Debounced listener on game card mouseenter and keyboard focusin events.
 * - Respects global master mute and volume settings from SoundEngine / localStorage.
 * - Provides a "Card Hover SFX" toggle in audio settings UI.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ArcadeCardHoverSound = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PREF_STORAGE_KEY = 'arcadeverse_card_hover_sfx';
  var SOUND_SETTINGS_KEY = 'arcadeverse_sound_settings';
  var MASTER_MUTE_KEY = 'arcadeverse_muted';
  var MASTER_VOL_KEY = 'arcadeverse_master_volume';

  var BLIP_FREQUENCY_HZ = 880;
  var BLIP_DURATION_SEC = 0.03; // 30ms ultra-short retro blip
  var DEBOUNCE_MS = 55;

  var enabled = loadHoverPref();
  var audioCtx = null;
  var lastBlipTimestamp = 0;

  function loadHoverPref() {
    try {
      if (typeof localStorage !== 'undefined') {
        var raw = localStorage.getItem(PREF_STORAGE_KEY);
        if (raw !== null) {
          return raw === 'true';
        }
      }
    } catch (_) {}
    return true;
  }

  function saveHoverPref(val) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(PREF_STORAGE_KEY, val ? 'true' : 'false');
      }
    } catch (_) {}
  }

  /**
   * Checks whether global master audio is muted.
   *
   * @returns {boolean}
   */
  function isMasterMuted() {
    try {
      if (typeof window !== 'undefined' && window.SoundEngine && typeof window.SoundEngine.enabled === 'boolean') {
        return !window.SoundEngine.enabled;
      }
      if (typeof localStorage !== 'undefined') {
        var settingsRaw = localStorage.getItem(SOUND_SETTINGS_KEY);
        if (settingsRaw) {
          var parsed = JSON.parse(settingsRaw);
          if (parsed && typeof parsed.enabled === 'boolean') {
            return !parsed.enabled;
          }
        }
        if (localStorage.getItem(MASTER_MUTE_KEY) === 'true') {
          return true;
        }
      }
    } catch (_) {}
    return false;
  }

  /**
   * Resolves current master volume in [0.0, 1.0].
   *
   * @returns {number}
   */
  function getMasterVolume() {
    try {
      if (typeof window !== 'undefined' && window.SoundEngine && typeof window.SoundEngine.volume === 'number') {
        return Math.max(0, Math.min(1, window.SoundEngine.volume));
      }
      if (typeof localStorage !== 'undefined') {
        var settingsRaw = localStorage.getItem(SOUND_SETTINGS_KEY);
        if (settingsRaw) {
          var parsed = JSON.parse(settingsRaw);
          if (parsed && typeof parsed.volume === 'number') {
            return Math.max(0, Math.min(1, parsed.volume));
          }
        }
        var rawVol = parseFloat(localStorage.getItem(MASTER_VOL_KEY));
        if (!isNaN(rawVol)) {
          return Math.max(0, Math.min(1, rawVol));
        }
      }
    } catch (_) {}
    return 0.28;
  }

  function resolveAudioContext(ctxOverride) {
    if (ctxOverride) return ctxOverride;
    if (audioCtx) {
      if (audioCtx.state === 'suspended' && typeof audioCtx.resume === 'function') {
        audioCtx.resume().catch(function () {});
      }
      return audioCtx;
    }
    if (typeof window !== 'undefined') {
      // Reuse SoundEngine context if already unlocked, or create lazily after gesture
      if (window.SoundEngine && window.SoundEngine.ctx) {
        audioCtx = window.SoundEngine.ctx;
        return audioCtx;
      }
      var ua = typeof navigator !== 'undefined' ? navigator.userActivation : null;
      if (ua && !ua.hasBeenActive && !(window.SoundEngine && window.SoundEngine.unlocked)) {
        return null;
      }
      var AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        try {
          audioCtx = new AudioContextClass();
        } catch (_) {
          audioCtx = null;
        }
      }
    }
    return audioCtx;
  }

  /**
   * Synthesizes a 30ms retro blip tone (880Hz triangle wave decaying rapidly).
   *
   * @param {Object} [options] - { ctx, nowMs, bypassDebounce }
   * @returns {boolean} True if tone was synthesized
   */
  function playBlip(options) {
    if (!enabled || isMasterMuted()) return false;

    var opts = options || {};
    var nowMs = typeof opts.nowMs === 'number' ? opts.nowMs : Date.now();

    if (!opts.bypassDebounce && (nowMs - lastBlipTimestamp) < DEBOUNCE_MS) {
      return false;
    }

    var ctx = resolveAudioContext(opts.ctx);
    if (!ctx || typeof ctx.createOscillator !== 'function' || typeof ctx.createGain !== 'function') {
      return false;
    }

    try {
      var vol = getMasterVolume();
      if (vol <= 0) return false;

      var now = typeof ctx.currentTime === 'number' ? ctx.currentTime : 0;
      var osc = ctx.createOscillator();
      var gainNode = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(BLIP_FREQUENCY_HZ, now);

      var peakGain = Math.max(0.005, Math.min(0.18, vol * 0.14));
      gainNode.gain.setValueAtTime(peakGain, now);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + BLIP_DURATION_SEC);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + BLIP_DURATION_SEC + 0.002);

      lastBlipTimestamp = nowMs;
      return true;
    } catch (_) {
      return false;
    }
  }

  function setEnabled(state) {
    enabled = Boolean(state);
    saveHoverPref(enabled);
    updateToggleUI();
    return enabled;
  }

  function toggle() {
    return setEnabled(!enabled);
  }

  function isEnabled() {
    return enabled;
  }

  function resetDebounce() {
    lastBlipTimestamp = 0;
  }

  function updateToggleUI() {
    if (typeof document === 'undefined') return;
    var btn = document.getElementById('card-hover-sfx-btn');
    if (btn) {
      var muted = isMasterMuted();
      btn.classList.toggle('is-enabled', enabled);
      btn.classList.toggle('is-master-muted', muted);
      btn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
      btn.setAttribute('title', 'Card Hover SFX: ' + (enabled ? 'ON' : 'OFF') + (muted ? ' (Master Muted)' : ''));
      var label = btn.querySelector('.card-hover-sfx-label');
      if (label) {
        label.textContent = enabled ? 'Card SFX: ON' : 'Card SFX: OFF';
      }
    }
  }

  function renderToggleUI() {
    if (typeof document === 'undefined') return;
    if (document.getElementById('card-hover-sfx-btn')) return;

    var navActions = document.querySelector('.nav-actions');
    if (!navActions) return;

    var btn = document.createElement('button');
    btn.id = 'card-hover-sfx-btn';
    btn.type = 'button';
    btn.className = 'card-hover-sfx-toggle' + (enabled ? ' is-enabled' : '');
    btn.setAttribute('aria-label', 'Toggle Card Hover SFX');
    btn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>' +
      '<path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>' +
      '</svg>' +
      '<span class="card-hover-sfx-label">' + (enabled ? 'Card SFX: ON' : 'Card SFX: OFF') + '</span>';

    btn.addEventListener('click', function () {
      toggle();
      if (enabled && !isMasterMuted()) {
        playBlip({ bypassDebounce: true });
      }
    });

    var soundBtn = document.getElementById('global-sound-toggle-btn');
    if (soundBtn && soundBtn.parentNode === navActions) {
      navActions.insertBefore(btn, soundBtn.nextSibling);
    } else {
      navActions.prepend(btn);
    }

    updateToggleUI();
  }

  function bindCardListeners() {
    if (typeof document === 'undefined') return;

    // Capture mouseenter on .game-card elements
    document.addEventListener('mouseenter', function (e) {
      var target = e.target;
      if (!target || typeof target.classList === 'undefined') return;
      if (target.classList.contains('game-card')) {
        playBlip();
      }
    }, true);

    // Keyboard navigation focus onto cards or primary card buttons
    document.addEventListener('focusin', function (e) {
      var target = e.target;
      if (!target || typeof target.closest !== 'function') return;
      var card = target.closest('.game-card');
      if (card && (target === card || target.classList.contains('btn-play-trigger'))) {
        playBlip();
      }
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('arcadeverse:sound-mode-changed', updateToggleUI);
    }
  }

  function init() {
    renderToggleUI();
    bindCardListeners();
  }

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  return {
    BLIP_FREQUENCY_HZ: BLIP_FREQUENCY_HZ,
    BLIP_DURATION_SEC: BLIP_DURATION_SEC,
    DEBOUNCE_MS: DEBOUNCE_MS,
    isMasterMuted: isMasterMuted,
    getMasterVolume: getMasterVolume,
    playBlip: playBlip,
    setEnabled: setEnabled,
    isEnabled: isEnabled,
    toggle: toggle,
    resetDebounce: resetDebounce,
    init: init
  };
});

