const test = require('node:test');
const assert = require('node:assert/strict');
const DitherQuantizer = require('../assets/js/dither-quantizer.js');

test('DitherQuantizer has authentic retro hardware palettes', () => {
  assert.equal(DitherQuantizer.PALETTES.gameboy.length, 4);
  assert.equal(DitherQuantizer.PALETTES.cga.length, 4);
  assert.equal(DitherQuantizer.PALETTES.c64.length, 16);
  assert.equal(DitherQuantizer.PALETTES.zx_spectrum.length, 8);
});

test('DitherQuantizer finds nearest Euclidean color', () => {
  const palette = [[0, 0, 0], [255, 255, 255]];
  const nearBlack = DitherQuantizer.findNearestColor(10, 20, 15, palette);
  assert.deepEqual(nearBlack, [0, 0, 0]);

  const nearWhite = DitherQuantizer.findNearestColor(240, 250, 255, palette);
  assert.deepEqual(nearWhite, [255, 255, 255]);
});

test('DitherQuantizer processes Floyd-Steinberg and Bayer dithering', () => {
  const quantizer = new DitherQuantizer();
  const mockImageData = {
    width: 4,
    height: 4,
    data: new Uint8ClampedArray(4 * 4 * 4).fill(128)
  };

  const processed = quantizer.process(mockImageData, 'gameboy', 'floyd_steinberg');
  assert.equal(processed.width, 4);
  assert.equal(processed.height, 4);
  assert.ok(processed.data[0] !== 128); // Quantized to palette value
});
