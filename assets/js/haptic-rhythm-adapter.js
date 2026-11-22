/**
 * Virtual Gamepad Haptic Rhythm & Pulse Feedback Vibration Pattern Adapter
 * Pure JavaScript & Gamepad Haptics / Vibration API Engine
 * Interfaces navigator.vibrate and gamepad.vibrationActuator.playEffect with calibrated
 * vibration patterns (Soft Tap, Heavy Impact, Dual Heartbeat, Failure Buzz), audio-linked
 * rhythm pulse synchronization, user preference toggles, and graceful hardware fallbacks.
 *
 * @module HapticRhythmAdapter
 * @version 1.0.0
 * ArcadeVerse Nexus Spring Of Code 2026
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ArcadeVerse = root.ArcadeVerse || {};
    root.ArcadeVerse.HapticRhythmAdapter = factory();
    root.HapticRhythmAdapter = root.ArcadeVerse.HapticRhythmAdapter;
  }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var STORAGE_KEY = 'av_haptic_feedback_enabled';

  var PATTERNS = {
    soft_tap: [15],
    heavy_impact: [60],
    dual_heartbeat: [35, 60, 45],
    failure_buzz: [80, 50, 120]
  };

  function HapticRhythmAdapter(options) {
    this.options = Object.assign({
      enabled: true,
      weakMagnitude: 0.4,
      strongMagnitude: 0.8
    }, options);

    this.enabled = this.loadPreference();
    this.bindBeatListener();
  }

  HapticRhythmAdapter.PATTERNS = PATTERNS;

  HapticRhythmAdapter.prototype.loadPreference = function () {
    try {
      if (typeof localStorage !== 'undefined') {
        var val = localStorage.getItem(STORAGE_KEY);
        if (val !== null) return val === 'true';
      }
    } catch (e) {}
    return this.options.enabled;
  };

  HapticRhythmAdapter.prototype.setEnabled = function (enabled) {
    this.enabled = !!enabled;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, this.enabled.toString());
      }
    } catch (e) {}
  };

  /**
   * Dispatches vibration pulse to mobile touchscreen or gamepad actuator
   */
  HapticRhythmAdapter.prototype.playPattern = function (patternName) {
    if (!this.enabled) return false;
    var pattern = PATTERNS[patternName] || PATTERNS.soft_tap;

    // 1. Mobile touch navigator.vibrate
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(pattern);
      } catch (e) {}
    }

    // 2. Physical Gamepad dual-rumble actuator
    if (typeof navigator !== 'undefined' && navigator.getGamepads) {
      try {
        var pads = navigator.getGamepads();
        for (var i = 0; i < pads.length; i++) {
          var pad = pads[i];
          if (pad && pad.vibrationActuator && pad.vibrationActuator.playEffect) {
            var duration = pattern[0] || 40;
            pad.vibrationActuator.playEffect('dual-rumble', {
              duration: duration,
              strongMagnitude: this.options.strongMagnitude,
              weakMagnitude: this.options.weakMagnitude
            });
          }
        }
      } catch (err) {}
    }

    return true;
  };

  /**
   * Synchronizes rhythmic micro-pulses to 'arcade-beat' DOM events
   */
  HapticRhythmAdapter.prototype.bindBeatListener = function () {
    if (typeof window === 'undefined') return;
    var self = this;
    this._onBeat = function (e) {
      if (!self.enabled) return;
      var intensity = (e.detail && e.detail.intensity) || 0.5;
      if (intensity > 0.6) {
        self.playPattern('soft_tap');
      }
    };
    window.addEventListener('arcade-beat', this._onBeat);
  };

  HapticRhythmAdapter.prototype.destroy = function () {
    if (typeof window !== 'undefined' && this._onBeat) {
      window.removeEventListener('arcade-beat', this._onBeat);
    }
  };

  return HapticRhythmAdapter;
});
