const test = require('node:test');
const assert = require('node:assert/strict');
const ScreenshotCardCompositor = require('../assets/js/screenshot-card-compositor.js');

test('ScreenshotCardCompositor initializes with 1080p target dimensions', () => {
  const compositor = new ScreenshotCardCompositor();
  assert.equal(compositor.cardWidth, 1200);
  assert.equal(compositor.cardHeight, 1600);
});

test('ScreenshotCardCompositor composites snapshot and generates card canvas', () => {
  const compositor = new ScreenshotCardCompositor({
    playerHandle: 'ArcadeMaster',
    gameTitle: 'Cyber Pong',
    score: 99400
  });

  const card = compositor.compositeCard(null);
  assert.ok(card !== null);
  assert.equal(card.width, 1200);
  assert.equal(card.height, 1600);
});
