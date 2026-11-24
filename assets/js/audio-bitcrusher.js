/**
 * Pure Vanilla Audio Bitcrusher & Sample-Rate Reduction Lo-Fi DSP Node
 * Pure Web Audio API & DSP Audio Processing Node
 * Implements discrete amplitude quantization (reducing 16-bit float to 1-bit through 8-bit resolution),
 * sample-rate reduction (subsampling frequency by sample-and-hold), and vintage hardware presets
 * (NES 2A03 4-bit, Game Boy DMG 8-bit, Arcade Cabinet DAC, Telephone Lo-Fi).
 *
 * @module AudioBitcrusher
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
    root.ArcadeVerse.AudioBitcrusher = factory();
    root.AudioBitcrusher = root.ArcadeVerse.AudioBitcrusher;
  }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var PRESETS = {
    nes: { bitDepth: 4, normFreq: 0.15, name: 'NES 2A03' },
    gameboy: { bitDepth: 8, normFreq: 0.25, name: 'Game Boy DMG' },
    arcade_dac: { bitDepth: 6, normFreq: 0.35, name: 'Arcade Cabinet DAC' },
    telephone: { bitDepth: 6, normFreq: 0.08, name: 'Telephone Lo-Fi' }
  };

  function AudioBitcrusher(audioContext, options) {
    this.ctx = audioContext || null;
    this.options = Object.assign({
      bitDepth: 8, // 1 to 16 bits
      normFreq: 0.25, // 0.01 to 1.0 (sample rate reduction factor)
      wetMix: 0.8,
      dryMix: 0.2
    }, options);

    this.bitDepth = this.options.bitDepth;
    this.normFreq = this.options.normFreq;
    this.processorNode = null;
    this.inputGain = null;
    this.outputGain = null;

    if (this.ctx) {
      this.initNodes();
    }
  }

  AudioBitcrusher.PRESETS = PRESETS;

  AudioBitcrusher.prototype.initNodes = function () {
    if (!this.ctx) return;

    var bufferSize = 4096;
    if (this.ctx.createScriptProcessor) {
      this.processorNode = this.ctx.createScriptProcessor(bufferSize, 1, 1);
    } else if (this.ctx.createJavaScriptNode) {
      this.processorNode = this.ctx.createJavaScriptNode(bufferSize, 1, 1);
    }

    if (this.processorNode) {
      var self = this;
      var lastSample = 0;
      var phaser = 0;

      this.processorNode.onaudioprocess = function (e) {
        var input = e.inputBuffer.getChannelData(0);
        var output = e.outputBuffer.getChannelData(0);
        var step = Math.pow(0.5, self.bitDepth);
        var invNormFreq = 1.0 / self.normFreq;

        for (var i = 0; i < input.length; i++) {
          phaser += 1.0;
          if (phaser >= invNormFreq) {
            phaser -= invNormFreq;
            // Quantize amplitude to discrete bit levels
            lastSample = step * Math.floor(input[i] / step + 0.5);
          }
          output[i] = lastSample;
        }
      };
    }
  };

  AudioBitcrusher.prototype.setBitDepth = function (bits) {
    this.bitDepth = Math.max(1, Math.min(16, bits));
  };

  AudioBitcrusher.prototype.setReduction = function (freq) {
    this.normFreq = Math.max(0.01, Math.min(1.0, freq));
  };

  AudioBitcrusher.prototype.loadPreset = function (presetName) {
    var p = PRESETS[presetName] || PRESETS.nes;
    this.setBitDepth(p.bitDepth);
    this.setReduction(p.normFreq);
    return p;
  };

  /**
   * Pure mathematical sample processor for headless unit test verification
   */
  AudioBitcrusher.prototype.processSample = function (sampleInput) {
    var step = Math.pow(0.5, this.bitDepth);
    return step * Math.floor(sampleInput / step + 0.5);
  };

  AudioBitcrusher.prototype.disconnect = function () {
    if (this.processorNode) {
      try { this.processorNode.disconnect(); } catch (e) {}
      this.processorNode = null;
    }
  };

  return AudioBitcrusher;
});
