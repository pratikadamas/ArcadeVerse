const test = require('node:test');
const assert = require('node:assert/strict');
const RhythmBeatDetector = require('../assets/js/rhythm-beat-detector.js');

test('RhythmBeatDetector calculates spectral flux correctly across sub-bands', () => {
  const detector = new RhythmBeatDetector(null, { fftSize: 64 });
  const prevSpectrum = new Float32Array([0.1, 0.2, 0.1, 0.1]);
  const currSpectrum = new Float32Array([0.5, 0.8, 0.1, 0.0]); // Significant positive rise

  const flux = detector.computeSpectralFlux(currSpectrum, prevSpectrum);
  // (0.5 - 0.1) + (0.8 - 0.2) = 0.4 + 0.6 = 1.0 (drops to 0 are ignored)
  assert.ok(Math.abs(flux - 1.0) < 0.001);
});

test('RhythmBeatDetector adapts median threshold over rolling window', () => {
  const detector = new RhythmBeatDetector(null, { thresholdMultiplier: 1.5 });
  detector.fluxHistory = [0.1, 0.2, 0.3, 0.4, 0.5]; // median is 0.3

  const threshold = detector.calculateAdaptiveThreshold();
  // 0.3 * 1.5 = 0.45
  assert.ok(Math.abs(threshold - 0.45) < 0.001);
});

test('RhythmBeatDetector disconnects cleanly without audio memory leaks', () => {
  let disconnected = false;
  const mockNode = {
    fftSize: 512,
    smoothingTimeConstant: 0.2,
    frequencyBinCount: 256,
    disconnect: () => { disconnected = true; }
  };
  const mockCtx = {
    createAnalyser: () => mockNode
  };

  const detector = new RhythmBeatDetector(mockCtx);
  assert.ok(detector.analyser !== null);
  detector.disconnect();
  assert.equal(disconnected, true);
  assert.equal(detector.analyser, null);
});
