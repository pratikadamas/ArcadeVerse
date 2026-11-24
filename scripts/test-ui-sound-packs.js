const test = require('node:test');
const assert = require('node:assert');
const { UISoundPacksEngine } = require('../assets/js/ui-sound-packs.js');

test('UISoundPacksEngine switches presets and handles mute controls', () => {
  const engine = new UISoundPacksEngine(null, { pack: 'arcadeRelay', muted: true });
  assert.strictEqual(engine.currentPack, 'arcadeRelay');
  assert.strictEqual(engine.muted, true);

  engine.setPack('cyberBeep');
  assert.strictEqual(engine.currentPack, 'cyberBeep');

  engine.setPack('bubblePop');
  assert.strictEqual(engine.currentPack, 'bubblePop');

  engine.setMuted(false);
  assert.strictEqual(engine.muted, false);
});

test('UISoundPacksEngine enforces volume bounds', () => {
  const engine = new UISoundPacksEngine();
  engine.setVolume(1.8);
  assert.strictEqual(engine.volume, 1.0);

  engine.setVolume(-0.4);
  assert.strictEqual(engine.volume, 0);
});
