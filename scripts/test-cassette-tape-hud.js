const test = require('node:test');
const assert = require('node:assert');
const { CassetteTapeHUD } = require('../assets/js/cassette-tape-hud.js');

test('CassetteTapeHUD calculates dynamic magnetic tape radius transfer', () => {
  const hud = new CassetteTapeHUD({ totalTime: 100, currentTime: 0 });

  // At start: left spool full, right spool empty
  const radiiStart = hud.getTapeRadii();
  assert.strictEqual(radiiStart.progress, 0);
  assert.strictEqual(radiiStart.leftRadius, 38);
  assert.strictEqual(radiiStart.rightRadius, 12);

  // At 50%: both spools equal
  hud.currentTime = 50;
  const radiiMid = hud.getTapeRadii();
  assert.strictEqual(radiiMid.progress, 0.5);
  assert.strictEqual(radiiMid.leftRadius, 25);
  assert.strictEqual(radiiMid.rightRadius, 25);

  // At end: left spool empty, right spool full
  hud.currentTime = 100;
  const radiiEnd = hud.getTapeRadii();
  assert.strictEqual(radiiEnd.progress, 1);
  assert.strictEqual(radiiEnd.leftRadius, 12);
  assert.strictEqual(radiiEnd.rightRadius, 38);
});

test('CassetteTapeHUD handles transport playback and fast-forward speed scaling', () => {
  const hud = new CassetteTapeHUD({ totalTime: 100 });
  hud.play();
  assert.strictEqual(hud.isPlaying, true);
  assert.strictEqual(hud.speed, 1.0);

  hud.update(1.0); // 1 second update
  assert.strictEqual(Math.round(hud.currentTime), 1);

  hud.fastForward();
  assert.strictEqual(hud.speed, 4.0);

  hud.update(1.0); // 4 seconds advance
  assert.strictEqual(Math.round(hud.currentTime), 5);
});
