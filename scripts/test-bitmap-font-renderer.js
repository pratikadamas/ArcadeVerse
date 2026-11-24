const test = require('node:test');
const assert = require('node:assert');
const { BitmapFontRenderer } = require('../assets/js/bitmap-font-renderer.js');

test('BitmapFontRenderer measures and renders pixel glyphs', () => {
  const font = new BitmapFontRenderer();
  const metrics = font.measureText('ARCADE', 2, 1);

  assert.strictEqual(metrics.height, 10);
  assert.strictEqual(metrics.width, 6 * 6 + 5 * 2); // 6 chars * 6px + 5 spaces * 2px = 46px

  const pixelsDrawn = [];
  const mockCtx = {
    fillStyle: '',
    fillRect: (x, y, w, h) => pixelsDrawn.push({ x, y, w, h })
  };

  font.drawPixelText(mockCtx, 'HI', 10, 10, { scale: 1, spacing: 1 });
  assert.ok(pixelsDrawn.length > 0);
  assert.strictEqual(pixelsDrawn[0].w, 1);
});

test('BitmapFontRenderer supports drop shadows and fallback glyphs', () => {
  const font = new BitmapFontRenderer();
  const pixelsDrawn = [];
  const mockCtx = {
    fillStyle: '',
    fillRect: (x, y, w, h) => pixelsDrawn.push({ x, y, w, h })
  };

  font.drawPixelText(mockCtx, '!', 0, 0, { scale: 2, shadowColor: '#000000' });
  // Both shadow and foreground pixels are drawn
  assert.ok(pixelsDrawn.length >= 8);
});
