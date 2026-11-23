/**
 * Chorded Keystroke & Stenographic Arcade Combo Decoder with NKRO
 * Pure Vanilla JavaScript & Keyboard Event Chord Engine
 * Captures multi-key chords within a configurable synchronization window (25ms - 40ms threshold),
 * resolves simultaneous key clusters into composite chord events (e.g. CHORD_PUNCH_KICK),
 * matches incoming sequences against a registered rolling combo dictionary, and renders an on-screen diagnostic HUD.
 *
 * @module ChordedKeyboard
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
    root.ArcadeVerse.ChordedKeyboard = factory();
    root.ChordedKeyboard = root.ArcadeVerse.ChordedKeyboard;
  }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  function ChordedKeyboard(options) {
    this.options = Object.assign({
      chordWindowMs: 35, // Millisecond synchronization threshold
      maxBufferSize: 20,
      onChordResolved: null
    }, options);

    this.activePressedKeys = {}; // key -> timestamp
    this.pendingChordKeys = [];
    this.chordTimer = null;
    this.chordDictionary = {}; // 'KeyA+KeyS' -> 'SUPER_COMBO'
    this.historyBuffer = [];

    this.bindEvents();
  }

  /**
   * Registers a named chord mapping
   * e.g. registerChord(['KeyJ', 'KeyK'], 'CHORD_PUNCH_KICK')
   */
  ChordedKeyboard.prototype.registerChord = function (keysArray, chordName) {
    var sorted = keysArray.slice().sort().join('+');
    this.chordDictionary[sorted] = chordName;
  };

  /**
   * Processes keydown events into pending chord clusters
   */
  ChordedKeyboard.prototype.handleKeyDown = function (code, timestamp) {
    var now = timestamp || (typeof performance !== 'undefined' ? performance.now() : Date.now());
    if (this.activePressedKeys[code]) return; // Ignore OS auto-repeat

    this.activePressedKeys[code] = now;
    this.pendingChordKeys.push(code);

    var self = this;
    if (!this.chordTimer) {
      this.chordTimer = setTimeout(function () {
        self.resolveCurrentChord();
      }, this.options.chordWindowMs);
    }
  };

  ChordedKeyboard.prototype.handleKeyUp = function (code) {
    delete this.activePressedKeys[code];
  };

  /**
   * Resolves buffered keys within time threshold into a single composite chord
   */
  ChordedKeyboard.prototype.resolveCurrentChord = function () {
    this.chordTimer = null;
    if (this.pendingChordKeys.length === 0) return null;

    var sortedKeys = this.pendingChordKeys.slice().sort();
    var chordKey = sortedKeys.join('+');
    var resolvedName = this.chordDictionary[chordKey] || ('CHORD_' + chordKey);

    var chordEvent = {
      chord: resolvedName,
      keys: sortedKeys,
      count: sortedKeys.length,
      timestamp: (typeof performance !== 'undefined' ? performance.now() : Date.now())
    };

    this.historyBuffer.push(chordEvent);
    if (this.historyBuffer.length > this.options.maxBufferSize) {
      this.historyBuffer.shift();
    }

    this.pendingChordKeys = [];

    if (typeof this.options.onChordResolved === 'function') {
      this.options.onChordResolved(chordEvent);
    }

    return chordEvent;
  };

  ChordedKeyboard.prototype.bindEvents = function () {
    if (typeof window === 'undefined') return;
    var self = this;

    this._onKeyDown = function (e) {
      self.handleKeyDown(e.code);
    };

    this._onKeyUp = function (e) {
      self.handleKeyUp(e.code);
    };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  };

  ChordedKeyboard.prototype.destroy = function () {
    if (this.chordTimer) {
      clearTimeout(this.chordTimer);
      this.chordTimer = null;
    }
    if (typeof window !== 'undefined') {
      if (this._onKeyDown) window.removeEventListener('keydown', this._onKeyDown);
      if (this._onKeyUp) window.removeEventListener('keyup', this._onKeyUp);
    }
  };

  return ChordedKeyboard;
});
