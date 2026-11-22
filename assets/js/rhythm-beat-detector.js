/**
 * Spectral Flux Onset Beat-Detector & Canvas Pulse Synchronizer
 * Pure Web Audio API & DSP Real-Time Beat Detection Engine
 * Calculates real-time spectral flux across sub-bands (kicks, snares, pulses),
 * dynamic adaptive median thresholding over a rolling window, and broadcasts
 * 'arcade-beat' DOM events with peak intensity (0.0 - 1.0) for visual sync.
 *
 * @module RhythmBeatDetector
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
    root.ArcadeVerse.RhythmBeatDetector = factory();
    root.RhythmBeatDetector = root.ArcadeVerse.RhythmBeatDetector;
  }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  function RhythmBeatDetector(audioContext, options) {
    this.ctx = audioContext || null;
    this.options = Object.assign({
      fftSize: 1024,
      subBands: 16,
      historySize: 45, // ~1 second history at 40-50 fps
      thresholdMultiplier: 1.45,
      minBeatIntervalMs: 180, // Cap at max ~330 BPM
      decayRate: 0.95
    }, options);

    this.analyser = null;
    this.frequencyData = null;
    this.previousSpectrum = null;
    this.fluxHistory = [];
    this.lastBeatTime = 0;
    this.currentIntensity = 0.0;
    this.rafId = null;
    this.isRunning = false;

    if (this.ctx) {
      this.initNodes();
    }
  }

  RhythmBeatDetector.prototype.initNodes = function () {
    if (!this.ctx || !this.ctx.createAnalyser) return;
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = this.options.fftSize;
    this.analyser.smoothingTimeConstant = 0.2; // Keep transients sharp
    var bufferLength = this.analyser.frequencyBinCount;
    this.frequencyData = new Float32Array(bufferLength);
    this.previousSpectrum = new Float32Array(bufferLength);
  };

  /**
   * Connects to Web Audio source or master gain node
   */
  RhythmBeatDetector.prototype.connectSource = function (sourceNode) {
    if (!this.analyser && this.ctx) {
      this.initNodes();
    }
    if (sourceNode && sourceNode.connect && this.analyser) {
      sourceNode.connect(this.analyser);
    }
    return this;
  };

  /**
   * Computes spectral flux between current and previous frequency spectrum frames
   * Only positive rate of change in spectral energy indicates musical onsets
   */
  RhythmBeatDetector.prototype.computeSpectralFlux = function (spectrum, prevSpectrum) {
    var flux = 0;
    var len = spectrum.length;
    // Focus analysis primarily on lower/mid frequencies (kicks, basslines, snares: bins 0 to ~len/2)
    var activeBins = Math.floor(len * 0.65);

    for (var i = 0; i < activeBins; i++) {
      var diff = spectrum[i] - prevSpectrum[i];
      if (diff > 0) {
        flux += diff;
      }
    }
    return flux;
  };

  /**
   * Calculates median of rolling flux history for adaptive thresholding
   */
  RhythmBeatDetector.prototype.calculateAdaptiveThreshold = function () {
    if (this.fluxHistory.length === 0) return 0;
    var sorted = this.fluxHistory.slice().sort(function (a, b) { return a - b; });
    var mid = Math.floor(sorted.length / 2);
    var median = (sorted.length % 2 !== 0) ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    return median * this.options.thresholdMultiplier;
  };

  /**
   * Process a single audio frame (DSP execution < 1ms)
   */
  RhythmBeatDetector.prototype.processFrame = function (nowMs) {
    if (!this.analyser || !this.frequencyData) return null;
    var now = nowMs || (typeof performance !== 'undefined' ? performance.now() : Date.now());

    this.analyser.getFloatFrequencyData(this.frequencyData);

    // Convert dBFS (typically -100 to 0) to normalized linear amplitude [0, 1]
    var normalizedSpectrum = new Float32Array(this.frequencyData.length);
    for (var i = 0; i < this.frequencyData.length; i++) {
      var val = (this.frequencyData[i] + 100) / 100;
      normalizedSpectrum[i] = val > 0 ? val : 0;
    }

    var flux = this.computeSpectralFlux(normalizedSpectrum, this.previousSpectrum);
    this.previousSpectrum.set(normalizedSpectrum);

    // Update rolling history buffer
    this.fluxHistory.push(flux);
    if (this.fluxHistory.length > this.options.historySize) {
      this.fluxHistory.shift();
    }

    var threshold = this.calculateAdaptiveThreshold();
    var isBeat = false;
    var intensity = 0;

    // Detect authentic rhythmic transients
    if (flux > threshold && (now - this.lastBeatTime) > this.options.minBeatIntervalMs && flux > 0.05) {
      isBeat = true;
      this.lastBeatTime = now;
      // Map intensity [0.0 - 1.0]
      intensity = Math.min(1.0, Math.max(0.1, (flux - threshold) / (threshold || 1) + 0.3));
      this.currentIntensity = intensity;
      this.dispatchBeatEvent(intensity, flux);
    } else {
      // Natural exponential visual decay
      this.currentIntensity *= this.options.decayRate;
      if (this.currentIntensity < 0.01) this.currentIntensity = 0;
    }

    return {
      isBeat: isBeat,
      flux: flux,
      threshold: threshold,
      intensity: this.currentIntensity
    };
  };

  /**
   * Dispatches 'arcade-beat' CustomEvent to document/window for canvas pulsing
   */
  RhythmBeatDetector.prototype.dispatchBeatEvent = function (intensity, flux) {
    if (typeof window === 'undefined' || typeof CustomEvent !== 'function') return;
    try {
      var event = new CustomEvent('arcade-beat', {
        detail: {
          intensity: intensity,
          flux: flux,
          timestamp: (typeof performance !== 'undefined' ? performance.now() : Date.now())
        },
        bubbles: true
      });
      window.dispatchEvent(event);
    } catch (e) {
      // Event dispatch error
    }
  };

  RhythmBeatDetector.prototype.start = function () {
    if (this.isRunning) return;
    this.isRunning = true;
    var self = this;

    function step() {
      if (!self.isRunning) return;
      self.processFrame();
      self.rafId = requestAnimationFrame(step);
    }
    this.rafId = requestAnimationFrame(step);
  };

  RhythmBeatDetector.prototype.stop = function () {
    this.isRunning = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  };

  RhythmBeatDetector.prototype.disconnect = function () {
    this.stop();
    if (this.analyser && this.analyser.disconnect) {
      try {
        this.analyser.disconnect();
      } catch (e) {}
    }
    this.analyser = null;
    this.frequencyData = null;
    this.previousSpectrum = null;
    this.fluxHistory = [];
  };

  return RhythmBeatDetector;
});
