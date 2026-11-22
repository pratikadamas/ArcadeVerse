const test = require('node:test');
const assert = require('node:assert/strict');
const AudioBarcodeWatermark = require('../assets/js/audio-barcode-watermark.js');

test('AudioBarcodeWatermark generates deterministic FNV-1a receipt hashes', () => {
  const encoder = new AudioBarcodeWatermark();
  const hash1 = encoder.generateReceiptHash('cyber-pong', 15000, 1700000000);
  const hash2 = encoder.generateReceiptHash('cyber-pong', 15000, 1700000000);
  const hashDiff = encoder.generateReceiptHash('cyber-pong', 15001, 1700000000);

  assert.equal(hash1, hash2);
  assert.notEqual(hash1, hashDiff);
  assert.equal(hash1.length, 8);
});

test('AudioBarcodeWatermark converts hash to 32 binary FSK bits', () => {
  const encoder = new AudioBarcodeWatermark();
  const bits = encoder.hashToBits('0f');
  assert.deepEqual(bits, [0, 0, 0, 0, 1, 1, 1, 1]);
});
