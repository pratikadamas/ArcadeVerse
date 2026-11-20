const { test } = require('node:test');
const assert = require('node:assert/strict');
const spectrum = require('../assets/js/leaderboard-spectrum.js');

test('verifies 16 discrete ISO frequency bands configuration', () => {
  assert.equal(spectrum.BANDS_COUNT, 16);
  assert.equal(spectrum.FREQ_LABELS.length, 16);
  assert.equal(spectrum.FREQ_LABELS[0], '40');
  assert.equal(spectrum.FREQ_LABELS[15], '16K');
});

test('ambient chiptune wave generates smooth bounded amplitudes between 0.1 and 1.0', () => {
  for (let t = 0; t < 10; t += 0.5) {
    const bands = spectrum.computeAmbientBands(t);
    assert.equal(bands.length, 16);
    for (let b = 0; b < 16; b++) {
      assert.ok(bands[b] >= 0.1, `Band ${b} amplitude too low: ${bands[b]}`);
      assert.ok(bands[b] <= 1.0, `Band ${b} amplitude exceeded 1.0: ${bands[b]}`);
    }
  }
});

test('peak meter jumps immediately to spike and holds before gravity decay', () => {
  // Peak jump on spike
  const jump = spectrum.calculatePeakPhysics(0.9, 0.4, 0, 0);
  assert.equal(jump.peak, 0.9);
  assert.equal(jump.speed, 0);
  assert.ok(jump.hold > 0);

  // Peak hold countdown
  const hold = spectrum.calculatePeakPhysics(0.3, 0.9, 0, 5);
  assert.equal(hold.peak, 0.9);
  assert.equal(hold.hold, 4);

  // Peak gravity decay
  const decay = spectrum.calculatePeakPhysics(0.2, 0.9, 0.05, 0);
  assert.ok(decay.peak < 0.9);
  assert.ok(decay.speed > 0.05);
});

test('discrete LED segment color distribution matches Green -> Amber -> Red tiers', () => {
  // Lower segment 2: Green
  const segLow = spectrum.getSegmentColors(2, 18, true);
  assert.equal(segLow.fill, '#10b981');

  // Mid segment 12: Amber
  const segMid = spectrum.getSegmentColors(12, 18, true);
  assert.equal(segMid.fill, '#f59e0b');

  // High segment 16: Red
  const segHigh = spectrum.getSegmentColors(16, 18, true);
  assert.equal(segHigh.fill, '#ef4444');

  // Inactive segment
  const segDim = spectrum.getSegmentColors(5, 18, false);
  assert.ok(segDim.fill.startsWith('rgba('));
});

test('maps raw Web Audio AnalyserNode frequency bins to 16 normalized bands', () => {
  const mockFreqData = new Uint8Array(32);
  mockFreqData[0] = 255;  // 1.0
  mockFreqData[16] = 128; // ~0.5

  const mapped = spectrum.mapFrequencyTo16Bands(mockFreqData, 16);
  assert.equal(mapped.length, 16);
  assert.equal(mapped[0], 1.0);
  assert.ok(Math.abs(mapped[8] - 0.5) < 0.05);
});
