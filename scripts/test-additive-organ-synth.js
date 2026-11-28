const test = require('node:test');
const assert = require('node:assert');
const OrganModule = require('../assets/js/additive-organ-synth.js');

test('OrganModule exports expected constants, classes, and helpers', () => {
  assert.ok(Array.isArray(OrganModule.DRAWBAR_RATIOS), 'Should export DRAWBAR_RATIOS array');
  assert.strictEqual(OrganModule.DRAWBAR_RATIOS.length, 9, 'Should have 9 drawbar definitions');
  assert.ok(OrganModule.PRESETS, 'Should export PRESETS object');
  assert.ok(typeof OrganModule.computePeriodicWaveTables === 'function', 'Should export computePeriodicWaveTables');
  assert.ok(OrganModule.OrganEngine, 'Should export OrganEngine class');
  assert.ok(typeof OrganModule.createStudio === 'function', 'Should export createStudio factory');
});

test('computePeriodicWaveTables maps drawbar levels to Fourier harmonic coefficients', () => {
  // Test fundamental only (8' drawbar, index 2)
  const drawbars = [0, 0, 8, 0, 0, 0, 0, 0, 0];
  const { real, imag } = OrganModule.computePeriodicWaveTables(drawbars);

  assert.ok(real instanceof Float32Array);
  assert.ok(imag instanceof Float32Array);

  // Fundamental is mapped to harmonic index 2
  assert.strictEqual(imag[2], 1.0, 'Fundamental harmonic should be normalized to 1.0');
  assert.strictEqual(imag[1], 0);
  assert.strictEqual(imag[4], 0);
});

test('computePeriodicWaveTables normalizes multi-harmonic drawbars without clipping', () => {
  const fullDrawbars = [8, 8, 8, 8, 8, 8, 8, 8, 8];
  const { imag } = OrganModule.computePeriodicWaveTables(fullDrawbars);

  let maxVal = 0;
  for (let i = 1; i < imag.length; i++) {
    if (imag[i] > maxVal) maxVal = imag[i];
  }

  assert.ok(maxVal <= 1.0, 'Max Fourier amplitude must be normalized to <= 1.0');
  assert.ok(maxVal > 0, 'Harmonic amplitudes must be non-zero');
});

test('OrganEngine applies presets and updates drawbar state', () => {
  const engine = new OrganModule.OrganEngine();
  assert.deepStrictEqual(engine.drawbars, [8, 8, 8, 0, 0, 0, 0, 0, 0]);

  engine.setPreset('cathedralPipe');
  assert.deepStrictEqual(engine.drawbars, OrganModule.PRESETS.cathedralPipe.drawbars);
  assert.strictEqual(engine.leslieEnabled, OrganModule.PRESETS.cathedralPipe.leslie);

  // Individual drawbar adjustment
  engine.setDrawbar(3, 7);
  assert.strictEqual(engine.drawbars[3], 7);

  // Clamped bounds
  engine.setDrawbar(0, 20);
  assert.strictEqual(engine.drawbars[0], 8);
});

test('OrganEngine manages active note map without throwing', () => {
  const engine = new OrganModule.OrganEngine();
  // Note on / off when audio context is simulated / idle
  engine.noteOn(60, 261.63);
  engine.noteOff(60);
  assert.strictEqual(engine.activeNotes.size, 0);
});
