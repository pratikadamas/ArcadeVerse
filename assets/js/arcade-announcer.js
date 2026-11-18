/**
 * ArcadeVerse — Retro Robotic Voice Announcer Engine
 * Leverages native Web Speech API (SpeechSynthesis) with pitch/rate shift
 * to emulate an 80s arcade vocoder synthesizer robot announcer.
 *
 * NSOC Winter Edition 2026
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ArcadeAnnouncer = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var STORAGE_KEY = 'arcadeverse_speech_announcer_enabled';
  var isEnabled = true;

  try {
    var stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      isEnabled = stored === 'true';
    }
  } catch (_) {}

  function isSupported() {
    return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
  }

  function setEnabled(enabled) {
    isEnabled = !!enabled;
    try {
      localStorage.setItem(STORAGE_KEY, isEnabled ? 'true' : 'false');
    } catch (_) {}
  }

  function getEnabled() {
    return isEnabled;
  }

  /**
   * Speaks a game announcement phrase with 80s arcade robot inflection
   * @param {string} text
   * @param {Object} [options]
   */
  function announce(text, options) {
    if (!isEnabled || !isSupported() || !text) return;

    options = options || {};
    var isMuted = false;
    try {
      isMuted = localStorage.getItem('arcadeverse_muted') === 'true';
    } catch (_) {}
    if (isMuted) return;

    try {
      window.speechSynthesis.cancel(); // Sever overlapping queues

      var utterance = new SpeechSynthesisUtterance(text);
      // Pitch-shift and speed-shift for authentic retro robotic vocoder cadence
      utterance.rate = options.rate || 0.88;
      utterance.pitch = options.pitch || 0.65;
      utterance.volume = options.volume || 0.9;

      // Select robotic / English system voice if available
      var voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        var robotVoice = voices.find(function (v) {
          return v.lang.startsWith('en') && (v.name.includes('Robot') || v.name.includes('Zira') || v.name.includes('David'));
        }) || voices.find(function (v) {
          return v.lang.startsWith('en');
        });
        if (robotVoice) {
          utterance.voice = robotVoice;
        }
      }

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('[ArcadeVerse:Announcer] Speech error:', e);
    }
  }

  return {
    isSupported: isSupported,
    announce: announce,
    setEnabled: setEnabled,
    getEnabled: getEnabled
  };
});
