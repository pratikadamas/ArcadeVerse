const test = require('node:test');
const assert = require('node:assert/strict');
const AudioBitcrusher = require('../assets/js/audio-bitcrusher.js');

test('AudioBitcrusher contains vintage hardware presets', () => {
  assert.ok(AudioBitcrusher.PRESETS.nes);
  assert.ok(AudioBitcrusher.PRESETS.gameboy);
  assert.ok(AudioBitcrusher.PRESETS.arcade_dac);
  assert.ok(AudioBitcrusher.PRESETS.telephone);
});

test('AudioBitcrusher quantizes audio sample amplitudes to bit depth levels', () => {
  const crusher = new AudioBitcrusher(null, { bitDepth: 2 }); // 2-bit quantization
  const originalSample = 0.37;
  const crushed = crusher.processSample(originalSample);

  // 2-bit step is 0.25 (0.5^2); 0.37 quantizes to nearest step 0.25
  assert.equal(crushed, 0.25);
});
