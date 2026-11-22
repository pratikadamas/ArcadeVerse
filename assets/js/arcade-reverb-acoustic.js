/**
 * Web Audio ConvolverNode Procedural Impulse Response (IR) Reverb Space Simulator
 * Pure Web Audio API & DSP Procedural Acoustic Space Engine
 * Synthesizes synthetic acoustic Impulse Response (IR) audio buffers programmatically
 * (decay curves, early reflections, Gaussian noise distribution) with authentic
 * retro acoustic presets (Arcade Hall, Dungeon Cavern, Metallic Spaceship, Basement)
 * and seamless dual-gain wet/dry mix modulation.
 *
 * @module ArcadeReverbAcoustic
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
    root.ArcadeVerse.ArcadeReverbAcoustic = factory();
    root.ArcadeVerse.audio = root.ArcadeVerse.audio || {};
    root.ArcadeVerse.audio.setReverbSpace = function (preset, wetLevel) {
      if (root.ArcadeVerse.ArcadeReverbAcoustic.instance) {
        return root.ArcadeVerse.ArcadeReverbAcoustic.instance.setSpace(preset, wetLevel);
      }
    };
    root.ArcadeReverbAcoustic = root.ArcadeVerse.ArcadeReverbAcoustic;
  }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var PRESETS = {
    arcade_hall: {
      name: '1980s Neon Arcade Hall',
      duration: 1.8,
      decay: 2.2,
      reverse: false,
      earlyReflections: [0.03, 0.07, 0.12, 0.18],
      diffusion: 0.85
    },
    dungeon_cavern: {
      name: 'Dungeon Cavern',
      duration: 3.5,
      decay: 3.8,
      reverse: false,
      earlyReflections: [0.05, 0.15, 0.28, 0.45],
      diffusion: 0.6
    },
    metallic_corridor: {
      name: 'Metallic Spaceship Corridor',
      duration: 1.2,
      decay: 4.5,
      reverse: false,
      earlyReflections: [0.015, 0.032, 0.065],
      diffusion: 0.95
    },
    concrete_basement: {
      name: 'Concrete Tournament Basement',
      duration: 2.0,
      decay: 2.9,
      reverse: false,
      earlyReflections: [0.025, 0.08, 0.16],
      diffusion: 0.75
    }
  };

  function ArcadeReverbAcoustic(audioContext, options) {
    this.ctx = audioContext || null;
    this.options = Object.assign({
      preset: 'arcade_hall',
      wetMix: 0.35,
      dryMix: 0.65
    }, options);

    this.inputNode = null;
    this.outputNode = null;
    this.convolver = null;
    this.wetGain = null;
    this.dryGain = null;
    this.currentPreset = this.options.preset;

    if (this.ctx) {
      this.initNodes();
    }
    ArcadeReverbAcoustic.instance = this;
  }

  ArcadeReverbAcoustic.PRESETS = PRESETS;

  ArcadeReverbAcoustic.prototype.initNodes = function () {
    if (!this.ctx || !this.ctx.createConvolver) return;

    this.inputNode = this.ctx.createGain();
    this.outputNode = this.ctx.createGain();
    this.convolver = this.ctx.createConvolver();
    this.wetGain = this.ctx.createGain();
    this.dryGain = this.ctx.createGain();

    // Routing: input -> dryGain -> output
    //          input -> convolver -> wetGain -> output
    this.inputNode.connect(this.dryGain);
    this.dryGain.connect(this.outputNode);

    this.inputNode.connect(this.convolver);
    this.convolver.connect(this.wetGain);
    this.wetGain.connect(this.outputNode);

    this.setMix(this.options.wetMix, this.options.dryMix);
    this.loadPreset(this.options.preset);
  };

  /**
   * Procedural Impulse Response (IR) AudioBuffer Synthesizer
   * Generates mathematical Gaussian noise with exponential decay & discrete early reflection taps
   */
  ArcadeReverbAcoustic.prototype.generateImpulseResponse = function (presetConfig) {
    if (!this.ctx || !this.ctx.createBuffer) return null;

    var sampleRate = this.ctx.sampleRate || 44100;
    var duration = presetConfig.duration || 2.0;
    var decay = presetConfig.decay || 2.0;
    var length = Math.floor(sampleRate * duration);
    var buffer = this.ctx.createBuffer(2, length, sampleRate);

    var leftChannel = buffer.getChannelData(0);
    var rightChannel = buffer.getChannelData(1);

    var reflections = presetConfig.earlyReflections || [];
    var reflectionIndices = reflections.map(function (t) {
      return Math.floor(t * sampleRate);
    });

    for (var i = 0; i < length; i++) {
      var t = i / sampleRate;
      // Exponential energy decay curve
      var envelope = Math.exp(-t * decay);

      // Gaussian-distributed white noise (-1.0 to 1.0)
      var n1 = (Math.random() * 2 - 1);
      var n2 = (Math.random() * 2 - 1);

      // Apply discrete early reflection spikes
      for (var r = 0; r < reflectionIndices.length; r++) {
        var idx = reflectionIndices[r];
        if (Math.abs(i - idx) < 4) {
          envelope += (0.4 / (r + 1));
        }
      }

      leftChannel[i] = n1 * envelope;
      rightChannel[i] = n2 * envelope;
    }

    return buffer;
  };

  ArcadeReverbAcoustic.prototype.loadPreset = function (presetKey) {
    var config = PRESETS[presetKey] || PRESETS.arcade_hall;
    this.currentPreset = presetKey;
    if (this.convolver && this.ctx) {
      var irBuffer = this.generateImpulseResponse(config);
      this.convolver.buffer = irBuffer;
    }
    return config;
  };

  /**
   * Seamless crossfader between wet and dry audio streams
   */
  ArcadeReverbAcoustic.prototype.setMix = function (wet, dry) {
    var targetWet = Math.max(0, Math.min(1, wet));
    var targetDry = (typeof dry === 'number') ? Math.max(0, Math.min(1, dry)) : (1 - targetWet);

    var now = this.ctx ? this.ctx.currentTime : 0;
    if (this.wetGain && this.wetGain.gain) {
      this.wetGain.gain.setValueAtTime(targetWet, now);
    }
    if (this.dryGain && this.dryGain.gain) {
      this.dryGain.gain.setValueAtTime(targetDry, now);
    }
  };

  ArcadeReverbAcoustic.prototype.setSpace = function (presetKey, wetMix) {
    this.loadPreset(presetKey);
    if (typeof wetMix === 'number') {
      this.setMix(wetMix);
    }
  };

  ArcadeReverbAcoustic.prototype.disconnect = function () {
    if (this.inputNode) this.inputNode.disconnect();
    if (this.convolver) this.convolver.disconnect();
    if (this.wetGain) this.wetGain.disconnect();
    if (this.dryGain) this.dryGain.disconnect();
    if (this.outputNode) this.outputNode.disconnect();
  };

  return ArcadeReverbAcoustic;
});
