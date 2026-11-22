const test = require('node:test');
const assert = require('node:assert/strict');
const LedMarqueeSignage = require('../assets/js/led-marquee-signage.js');

test('LedMarqueeSignage contains 5x7 ASCII glyphs and colorways', () => {
  assert.ok(LedMarqueeSignage.FONT['A']);
  assert.equal(LedMarqueeSignage.FONT['A'].length, 5);
  assert.ok(LedMarqueeSignage.COLORWAYS.amber);
  assert.ok(LedMarqueeSignage.COLORWAYS.ruby);
  assert.ok(LedMarqueeSignage.COLORWAYS.emerald);
  assert.ok(LedMarqueeSignage.COLORWAYS.cyan);
});

test('LedMarqueeSignage builds text matrix and scrolls diode states', () => {
  const marquee = new LedMarqueeSignage(null, {
    cols: 32,
    rows: 16,
    text: 'HI'
  });

  assert.ok(marquee.fullTextCols.length > 0);
  marquee.update();
  assert.equal(marquee.gridBuffer.length, 16);
  assert.equal(marquee.gridBuffer[0].length, 32);
});
