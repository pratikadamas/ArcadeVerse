/**
 * Web Audio Granular Synthesis Sound Scaper & Ambient Micro-Grain Lab
 * Pure Web Audio API & DSP Granular Cloud Synthesizer
 * Chops procedural audio buffers into micro-grains (10ms - 60ms) and schedules continuous
 * overlapping grain clouds with controls for grain size, density, position jitter,
 * pitch dispersal, stereo pan, automated 32-voice budget cap, and procedural buffer generation.
 *
 * @module GranularSoundLab
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
    root.ArcadeVerse.GranularSoundLab = factory();
    root.GranularSoundLab = root.ArcadeVerse.GranularSoundLab;
  }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var MAX_VOICES = 32;

  function GranularSoundLab(audioContext, options) {
    this.ctx = audioContext || null;
    this.options = Object.assign({
      grainSize: 0.04, // 40ms micro-grains
      density: 24, // grains per second
      spray: 0.15, // buffer position jitter
      pitchSpread: 0.2, // detune randomization
      panSpread: 0.8, // stereo pan randomization
      volume: 0.4
    }, options);

    this.sourceBuffer = null;
    this.activeGrains = [];
    this.isRunning = false;
    this.timerId = null;

    if (this.ctx) {
      this.initMasterBus();
      this.generateProceduralBuffer();
    }
  }

  GranularSoundLab.prototype.initMasterBus = function () {
    if (!this.ctx || !this.ctx.createGain) return;
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.options.volume, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);
  };

  /**
   * Generates procedural cosmic source buffer via FM synthesis and pink noise (zero download assets)
   */
  GranularSoundLab.prototype.generateProceduralBuffer = function (durationSec) {
    if (!this.ctx || !this.ctx.createBuffer) return null;
    durationSec = durationSec || 4.0;
    var sampleRate = this.ctx.sampleRate || 44100;
    var length = Math.floor(sampleRate * durationSec);
    var buffer = this.ctx.createBuffer(2, length, sampleRate);

    var chL = buffer.getChannelData(0);
    var chR = buffer.getChannelData(1);

    var b0 = 0, b1 = 0, b2 = 0; // Pink noise state
    for (var i = 0; i < length; i++) {
      var t = i / sampleRate;

      // FM drone oscillation (Carrier 110Hz + Modulator 55Hz)
      var mod = Math.sin(2 * Math.PI * 55 * t) * 4.0;
      var carrier = Math.sin(2 * Math.PI * (110 + mod) * t) * 0.4;

      // Atmospheric pink noise filter
      var white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      var pink = (b0 + b1 + b2) * 0.1;

      var val = (carrier + pink) * 0.6;
      chL[i] = val;
      chR[i] = val * (0.9 + Math.sin(t * 2) * 0.1);
    }

    this.sourceBuffer = buffer;
    return buffer;
  };

  /**
   * Spawns a single micro-grain scheduled via AudioContext.currentTime
   */
  GranularSoundLab.prototype.spawnGrain = function () {
    if (!this.ctx || !this.sourceBuffer || this.activeGrains.length >= MAX_VOICES) return;

    try {
      var now = this.ctx.currentTime;
      var dur = this.options.grainSize;

      var source = this.ctx.createBufferSource();
      source.buffer = this.sourceBuffer;

      // Playback rate with pitch dispersal
      var pitchVariation = (Math.random() * 2 - 1) * this.options.pitchSpread;
      source.playbackRate.setValueAtTime(1.0 + pitchVariation, now);

      // Hann window envelope to prevent clicks
      var gainNode = this.ctx.createGain();
      gainNode.gain.setValueAtTime(0.0001, now);
      gainNode.gain.linearRampToValueAtTime(this.options.volume, now + dur * 0.5);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + dur);

      // Stereo panning
      var panner = null;
      if (this.ctx.createStereoPanner) {
        panner = this.ctx.createStereoPanner();
        panner.pan.setValueAtTime((Math.random() * 2 - 1) * this.options.panSpread, now);
      }

      // Random grain start offset in buffer with jitter
      var maxOffset = Math.max(0, this.sourceBuffer.duration - dur);
      var offset = (Math.random() * maxOffset) + (Math.random() * 2 - 1) * this.options.spray;
      offset = Math.max(0, Math.min(maxOffset, offset));

      // Connect graph
      source.connect(gainNode);
      if (panner) {
        gainNode.connect(panner);
        panner.connect(this.masterGain || this.ctx.destination);
      } else {
        gainNode.connect(this.masterGain || this.ctx.destination);
      }

      source.start(now, offset, dur);
      source.stop(now + dur + 0.01);

      this.activeGrains.push(source);
      var self = this;
      source.onended = function () {
        var idx = self.activeGrains.indexOf(source);
        if (idx !== -1) self.activeGrains.splice(idx, 1);
        try { source.disconnect(); gainNode.disconnect(); } catch (e) {}
      };
    } catch (err) {}
  };

  GranularSoundLab.prototype.start = function () {
    if (this.isRunning) return;
    this.isRunning = true;
    var self = this;
    var intervalMs = 1000 / (this.options.density || 24);

    this.timerId = setInterval(function () {
      if (!self.isRunning) return;
      self.spawnGrain();
    }, intervalMs);
  };

  GranularSoundLab.prototype.stop = function () {
    this.isRunning = false;
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    for (var i = 0; i < this.activeGrains.length; i++) {
      try { this.activeGrains[i].stop(); } catch (e) {}
    }
    this.activeGrains = [];
  };

  GranularSoundLab.prototype.exportConfig = function () {
    return JSON.stringify(this.options, null, 2);
  };

  return GranularSoundLab;
});
