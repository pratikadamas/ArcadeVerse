const test = require('node:test');
const assert = require('node:assert');
const { HolographicDiffractionStudio } = require('../assets/js/holographic-diffraction-studio.js');

test('HolographicDiffractionStudio calculates rainbow spectral wavelengths', () => {
  const studio = new HolographicDiffractionStudio({ intensity: 0.9 });
  const color1 = studio.calculateWavelengthColor(0.25);
  const color2 = studio.calculateWavelengthColor(0.75);

  assert.ok(color1.includes('hsla(90,'));
  assert.ok(color2.includes('hsla(270,'));
  assert.ok(color1.includes('0.9'));
});

test('HolographicDiffractionStudio clamps cursor coordinates within bounds', () => {
  const studio = new HolographicDiffractionStudio({ width: 400, height: 300 });
  studio.setCursor(600, -50);

  assert.strictEqual(studio.cursorX, 400);
  assert.strictEqual(studio.cursorY, 0);

  studio.setCursor(200, 150);
  assert.strictEqual(studio.cursorX, 200);
  assert.strictEqual(studio.cursorY, 150);
});
