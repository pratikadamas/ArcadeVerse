/**
 * Accessibility Input Macro Sequence Recorder & Assisted Playback Bot
 * Pure Vanilla JavaScript & ARIA A11y Engine
 * Records multi-step key sequences with millisecond precision,
 * maps one-key triggers, dispatches sanitized virtual KeyboardEvents
 * with rate capping (max 20 inputs/sec), and persists macro profiles.
 *
 * @module InputMacroRecorder
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
    root.ArcadeVerse.InputMacroRecorder = factory();
    root.InputMacroRecorder = root.ArcadeVerse.InputMacroRecorder;
  }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var STORAGE_PREFIX = 'av_macro_profile_';
  var MAX_RATE_LIMIT = 20; // Maximum virtual inputs per second to prevent event queue jamming

  function InputMacroRecorder(options) {
    this.options = Object.assign({
      gameId: 'global',
      maxInputsPerSecond: MAX_RATE_LIMIT,
      maxSequenceLength: 100,
      targetWindow: typeof window !== 'undefined' ? window : null
    }, options);

    this.isRecording = false;
    this.isPlaying = false;
    this.recordStartTime = 0;
    this.recordedSequence = []; // Array of { type: 'keydown'|'keyup', key, code, timeOffset }
    this.triggerKey = 'Space'; // Default one-key playback switch
    this.playbackTimeouts = [];
    this.lastDispatchedTime = -Infinity;

    this.loadProfile();
  }

  InputMacroRecorder.prototype.loadProfile = function () {
    try {
      if (typeof localStorage !== 'undefined') {
        var raw = localStorage.getItem(STORAGE_PREFIX + this.options.gameId);
        if (raw) {
          var parsed = JSON.parse(raw);
          if (Array.isArray(parsed.sequence)) {
            this.recordedSequence = parsed.sequence;
          }
          if (parsed.triggerKey) {
            this.triggerKey = parsed.triggerKey;
          }
        }
      }
    } catch (e) {
      // Storage unavailable or quota exceeded
    }
  };

  InputMacroRecorder.prototype.saveProfile = function () {
    try {
      if (typeof localStorage !== 'undefined') {
        var payload = {
          gameId: this.options.gameId,
          triggerKey: this.triggerKey,
          sequence: this.recordedSequence,
          updatedAt: Date.now()
        };
        localStorage.setItem(STORAGE_PREFIX + this.options.gameId, JSON.stringify(payload));
      }
    } catch (e) {
      // Storage write error
    }
  };

  InputMacroRecorder.prototype.startRecording = function () {
    this.isRecording = true;
    this.recordedSequence = [];
    this.recordStartTime = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    this.announce('Macro recording started. Perform your input combination now.');
  };

  InputMacroRecorder.prototype.stopRecording = function () {
    if (!this.isRecording) return;
    this.isRecording = false;
    this.saveProfile();
    this.announce('Macro recording stopped. ' + this.recordedSequence.length + ' input events saved.');
    return this.recordedSequence;
  };

  InputMacroRecorder.prototype.captureEvent = function (e) {
    if (!this.isRecording) return;
    if (this.recordedSequence.length >= this.options.maxSequenceLength) {
      this.stopRecording();
      return;
    }

    var now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    var timeOffset = Math.max(0, Math.round(now - this.recordStartTime));

    // Exclude macro trigger key itself from being recorded to prevent feedback loops
    if (e.code === this.triggerKey || e.key === this.triggerKey) {
      return;
    }

    this.recordedSequence.push({
      type: e.type, // 'keydown' or 'keyup'
      key: e.key,
      code: e.code,
      keyCode: e.keyCode || 0,
      timeOffset: timeOffset
    });
  };

  InputMacroRecorder.prototype.setTriggerKey = function (keyOrCode) {
    if (!keyOrCode) return;
    this.triggerKey = keyOrCode;
    this.saveProfile();
    this.announce('Assistive macro trigger mapped to: ' + keyOrCode);
  };

  /**
   * Dispatches synthetic KeyboardEvent with rate-capping sanitization
   */
  InputMacroRecorder.prototype.dispatchVirtualKey = function (eventItem, targetElement) {
    var now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    var minInterval = 1000 / this.options.maxInputsPerSecond;

    // Rate-capping protection against event queue flooding
    if (now - this.lastDispatchedTime < minInterval) {
      return false;
    }
    this.lastDispatchedTime = now;

    var target = targetElement || this.options.targetWindow || (typeof window !== 'undefined' ? window : null);
    if (!target) return false;

    try {
      var evt;
      if (typeof KeyboardEvent === 'function') {
        evt = new KeyboardEvent(eventItem.type, {
          key: eventItem.key,
          code: eventItem.code,
          keyCode: eventItem.keyCode,
          which: eventItem.keyCode,
          bubbles: true,
          cancelable: true
        });
      } else {
        evt = {
          type: eventItem.type,
          key: eventItem.key,
          code: eventItem.code,
          keyCode: eventItem.keyCode,
          bubbles: true,
          cancelable: true
        };
      }

      if (evt && target.dispatchEvent) {
        target.dispatchEvent(evt);
        return true;
      }
    } catch (err) {
      // Fallback
    }
    return false;
  };

  /**
   * Assisted playback bot loop reproducing exact millisecond timings
   */
  InputMacroRecorder.prototype.playMacro = function (targetElement, onComplete) {
    if (this.isPlaying || this.recordedSequence.length === 0) return false;
    this.isPlaying = true;
    this.clearPlaybackTimeouts();
    this.announce('Assistive macro playback active.');

    var self = this;
    var totalEvents = this.recordedSequence.length;

    for (var i = 0; i < totalEvents; i++) {
      (function (item, isLast) {
        var tid = setTimeout(function () {
          self.dispatchVirtualKey(item, targetElement);
          if (isLast) {
            self.isPlaying = false;
            self.announce('Assistive macro playback finished.');
            if (typeof onComplete === 'function') onComplete();
          }
        }, item.timeOffset);
        self.playbackTimeouts.push(tid);
      })(this.recordedSequence[i], i === totalEvents - 1);
    }
    return true;
  };

  InputMacroRecorder.prototype.clearPlaybackTimeouts = function () {
    for (var i = 0; i < this.playbackTimeouts.length; i++) {
      clearTimeout(this.playbackTimeouts[i]);
    }
    this.playbackTimeouts = [];
  };

  InputMacroRecorder.prototype.stopPlayback = function () {
    this.clearPlaybackTimeouts();
    this.isPlaying = false;
    this.announce('Macro playback cancelled.');
  };

  /**
   * Screen reader ARIA live region announcement
   */
  InputMacroRecorder.prototype.announce = function (message) {
    if (typeof document === 'undefined') return;
    var liveRegion = document.getElementById('av-a11y-macro-announcer');
    if (!liveRegion) {
      liveRegion = document.createElement('div');
      liveRegion.id = 'av-a11y-macro-announcer';
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.setAttribute('aria-atomic', 'true');
      liveRegion.className = 'sr-only';
      liveRegion.style.position = 'absolute';
      liveRegion.style.width = '1px';
      liveRegion.style.height = '1px';
      liveRegion.style.overflow = 'hidden';
      liveRegion.style.clip = 'rect(1px, 1px, 1px, 1px)';
      document.body.appendChild(liveRegion);
    }
    liveRegion.textContent = message;
  };

  return InputMacroRecorder;
});
