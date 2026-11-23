const test = require('node:test');
const assert = require('node:assert');
const { PlasmaLightningDischarger } = require('../assets/js/plasma-lightning.js');

test('PlasmaLightningDischarger generates fractal lightning segments via midpoint displacement', () => {
  const discharger = new PlasmaLightningDischarger({ maxGenerations: 4 });
  const bolt = discharger.zap(100, 100, 500, 500);

  assert.ok(bolt);
  assert.ok(bolt.segments.length >= 16, `Expected at least 16 segments, got ${bolt.segments.length}`);
  assert.strictEqual(bolt.alpha, 1.0);
});

test('PlasmaLightningDischarger decays and disposes old bolts on update', () => {
  const discharger = new PlasmaLightningDischarger();
  discharger.zap(0, 0, 100, 100, { decay: 0.5 });
  assert.strictEqual(discharger.bolts.length, 1);

  discharger.update();
  assert.strictEqual(discharger.bolts[0].alpha, 0.5);

  discharger.update();
  assert.strictEqual(discharger.bolts.length, 0);
});
