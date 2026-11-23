const test = require('node:test');
const assert = require('node:assert');
const { AudioFlangerComb } = require('../assets/js/audio-flanger-comb.js');

test('AudioFlangerComb initializes DSP parameters and limits bounds', () => {
  const flanger = new AudioFlangerComb(null, { speed: 1.5, feedback: 0.8, delayMs: 4 });
  assert.strictEqual(flanger.speed, 1.5);
  assert.strictEqual(flanger.feedback, 0.8);
  assert.strictEqual(flanger.delayMs, 4);

  // Speed clamping
  flanger.setSpeed(20);
  assert.strictEqual(flanger.speed, 15);

  flanger.setSpeed(0.01);
  assert.strictEqual(flanger.speed, 0.05);

  // Feedback clamping
  flanger.setFeedback(1.5);
  assert.strictEqual(flanger.feedback, 0.95);

  flanger.setFeedback(-0.5);
  assert.strictEqual(flanger.feedback, 0);
});

test('AudioFlangerComb configures multi-stage phaser options', () => {
  const flanger = new AudioFlangerComb(null, { stages: 8 });
  assert.strictEqual(flanger.stages, 8);
});
