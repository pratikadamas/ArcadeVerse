const test = require('node:test');
const assert = require('node:assert');
const { BinauralBrainwaveSynchronizer } = require('../assets/js/binaural-brainwave.js');

test('BinauralBrainwaveSynchronizer initializes target brainwave and base frequency', () => {
  const sync = new BinauralBrainwaveSynchronizer(null, { baseFrequency: 432, beatFrequency: 10, mode: 'binaural' });
  assert.strictEqual(sync.baseFrequency, 432);
  assert.strictEqual(sync.beatFrequency, 10);
  assert.strictEqual(sync.mode, 'binaural');

  // Change beat to Beta alertness (20Hz)
  sync.setBeatFrequency(20);
  assert.strictEqual(sync.beatFrequency, 20);

  // Clamped bounds
  sync.setBeatFrequency(80);
  assert.strictEqual(sync.beatFrequency, 40);
});

test('BinauralBrainwaveSynchronizer handles volume and mode states', () => {
  const sync = new BinauralBrainwaveSynchronizer(null, { volume: 0.1, mode: 'isochronic' });
  assert.strictEqual(sync.volume, 0.1);
  assert.strictEqual(sync.mode, 'isochronic');

  sync.setVolume(0.8);
  assert.strictEqual(sync.volume, 0.5); // clamped
});
