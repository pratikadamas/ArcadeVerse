const test = require('node:test');
const assert = require('node:assert/strict');
const PlasmaCaustics = require('../assets/js/plasma-caustics.js');

test('PlasmaCaustics initializes wave equation buffers and evaluates plasma', () => {
  const caustics = new PlasmaCaustics(null, { subWidth: 40, subHeight: 30 });
  assert.equal(caustics.waveCurrent.length, 40 * 30);
  assert.equal(caustics.wavePrev.length, 40 * 30);

  const val = caustics.evaluatePlasma(10, 10, 1.0);
  assert.ok(val >= -1.0 && val <= 1.0);
});

test('PlasmaCaustics propagates ripples via discrete wave equation', () => {
  const caustics = new PlasmaCaustics(null, { subWidth: 40, subHeight: 30, damping: 0.95 });
  caustics.dropRipple(0.5, 0.5, 10.0, 2);

  // Center ripple injected
  const centerIdx = 15 * 40 + 20;
  assert.ok(caustics.waveCurrent[centerIdx] > 0);

  caustics.updateWaveSimulation();
  // Wave propagates outward
  assert.ok(caustics.waveCurrent[centerIdx - 1] !== 0 || caustics.waveCurrent[centerIdx + 1] !== 0);
});
