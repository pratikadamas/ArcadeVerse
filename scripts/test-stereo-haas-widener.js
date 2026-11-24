const test = require('node:test');
const assert = require('node:assert');
const { StereoHaasWidener } = require('../assets/js/stereo-haas-widener.js');

test('StereoHaasWidener initializes default parameters and micro-delay bounds', () => {
  const widener = new StereoHaasWidener(null, { delayTimeMs: 20, width: 1.5 });
  assert.strictEqual(widener.delayTimeMs, 20);
  assert.strictEqual(widener.width, 1.5);
  assert.strictEqual(widener.delayedChannel, 'right');

  // Set delay bounds clamp
  widener.setDelay(80);
  assert.strictEqual(widener.delayTimeMs, 45);

  widener.setDelay(2);
  assert.strictEqual(widener.delayTimeMs, 5);
});

test('StereoHaasWidener computes phase correlation and mono compatibility', () => {
  const widener = new StereoHaasWidener(null, { delayTimeMs: 18 });
  const comp = widener.checkMonoCompatibility();

  assert.ok(typeof comp.correlation === 'number');
  assert.ok(typeof comp.compatible === 'boolean');
});

test('StereoHaasWidener updates width factors between 0.0 and 2.0', () => {
  const widener = new StereoHaasWidener(null);
  widener.updateWidth(0);
  assert.strictEqual(widener.width, 0);

  widener.updateWidth(3.5);
  assert.strictEqual(widener.width, 2.0);
});
