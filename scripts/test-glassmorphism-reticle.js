const test = require('node:test');
const assert = require('node:assert');
const { GlassmorphismReticleStudio } = require('../assets/js/glassmorphism-reticle.js');

test('GlassmorphismReticleStudio manages recoil bloom and spring recovery', () => {
  const studio = new GlassmorphismReticleStudio({ color: '#ff0055', recoilRecovery: 0.2 });
  assert.strictEqual(studio.currentSpread, 0);

  // Recoil impulse
  studio.triggerRecoil(15);
  assert.strictEqual(studio.currentSpread, 15);

  // Spring recovery update
  studio.updateSpread();
  assert.ok(studio.currentSpread < 15, 'Recoil spread should decay towards 0');
});

test('GlassmorphismReticleStudio exports and imports JSON reticle presets', () => {
  const studio = new GlassmorphismReticleStudio();
  const exported = studio.exportPreset();
  assert.ok(typeof exported === 'string');

  const customJson = JSON.stringify({
    color: '#39ff14',
    dotSize: 5,
    crosshairLength: 20,
    ringRadius: 30,
    showRing: false
  });

  const success = studio.importPreset(customJson);
  assert.strictEqual(success, true);
  assert.strictEqual(studio.color, '#39ff14');
  assert.strictEqual(studio.dotSize, 5);
  assert.strictEqual(studio.showRing, false);
});
