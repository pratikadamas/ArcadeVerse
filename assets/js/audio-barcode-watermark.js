/**
 * Audio-Reactive Spectrum Barcode & Inaudible FSK Watermark Encoder
 * Pure Web Audio API & Cryptographic Checksum Engine
 * Encodes score verification hashes into near-inaudible high-frequency chimes (18kHz - 19.5kHz)
 * using Frequency-Shift Keying (FSK) and embeds visual 2D spectral barcode matrices onto snapshot cards.
 *
 * @module AudioBarcodeWatermark
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
    root.ArcadeVerse.AudioBarcodeWatermark = factory();
    root.AudioBarcodeWatermark = root.ArcadeVerse.AudioBarcodeWatermark;
  }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var FREQ_MARK = 18500; // Bit '1' in Hz
  var FREQ_SPACE = 19200; // Bit '0' in Hz
  var BIT_DURATION = 0.04; // 40ms per bit

  function AudioBarcodeWatermark(audioContext, options) {
    this.ctx = audioContext || null;
    this.options = Object.assign({
      markFreq: FREQ_MARK,
      spaceFreq: FREQ_SPACE,
      bitDuration: BIT_DURATION
    }, options);
  }

  /**
   * Generates deterministic verification checksum hash for a score receipt
   */
  AudioBarcodeWatermark.prototype.generateReceiptHash = function (gameId, score, timestamp) {
    var str = gameId + ':' + score + ':' + timestamp + ':av_nsoc26';
    var hash = 0x811c9dc5; // 32-bit FNV-1a hash
    for (var i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  };

  /**
   * Encodes receipt hash into binary bit sequence
   */
  AudioBarcodeWatermark.prototype.hashToBits = function (hexHash) {
    var bits = [];
    for (var i = 0; i < hexHash.length; i++) {
      var nibble = parseInt(hexHash[i], 16);
      for (var b = 3; b >= 0; b--) {
        bits.push((nibble >> b) & 1);
      }
    }
    return bits;
  };

  /**
   * Plays inaudible FSK watermarking chime via Web Audio
   */
  AudioBarcodeWatermark.prototype.playWatermark = function (hexHash) {
    if (!this.ctx) return false;
    try {
      var bits = this.hashToBits(hexHash);
      var now = this.ctx.currentTime + 0.05;
      var bitDur = this.options.bitDuration;

      var osc = this.ctx.createOscillator();
      var gain = this.ctx.createGain();

      gain.gain.setValueAtTime(0.05, now); // Very low gain for near-inaudibility
      osc.type = 'sine';

      for (var i = 0; i < bits.length; i++) {
        var freq = (bits[i] === 1) ? this.options.markFreq : this.options.spaceFreq;
        osc.frequency.setValueAtTime(freq, now + i * bitDur);
      }

      var totalDuration = bits.length * bitDur;
      gain.gain.setValueAtTime(0.05, now + totalDuration - 0.01);
      gain.gain.linearRampToValueAtTime(0.0001, now + totalDuration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + totalDuration + 0.01);
      return true;
    } catch (e) {}
    return false;
  };

  /**
   * Draws 2D spectral barcode matrix on a 2D canvas context
   */
  AudioBarcodeWatermark.prototype.drawBarcodeMatrix = function (ctx, x, y, hexHash, width, height) {
    if (!ctx) return;
    width = width || 160;
    height = height || 16;
    var bits = this.hashToBits(hexHash);
    var bitW = width / bits.length;

    ctx.save();
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x, y, width, height);

    for (var i = 0; i < bits.length; i++) {
      if (bits[i] === 1) {
        ctx.fillStyle = '#00dfd8';
        ctx.fillRect(x + i * bitW, y, bitW - 0.5, height);
      }
    }
    ctx.restore();
  };

  return AudioBarcodeWatermark;
});
