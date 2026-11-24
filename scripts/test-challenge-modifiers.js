const test = require('node:test');
const assert = require('node:assert');
const { ChallengeModifierEngine } = require('../assets/js/challenge-modifiers.js');

test('ChallengeModifierEngine toggles mutator bitmasks and calculates handicap multiplier', () => {
  const engine = new ChallengeModifierEngine();
  assert.strictEqual(engine.activeMask, 0);

  engine.enableModifier('suddenDeath');
  assert.strictEqual(engine.isModifierActive('suddenDeath'), true);
  assert.strictEqual(engine.isModifierActive('lowGravity'), false);

  engine.toggleModifier('lowGravity');
  assert.strictEqual(engine.isModifierActive('lowGravity'), true);

  const active = engine.getActiveModifiers();
  assert.strictEqual(active.length, 2);
  assert.strictEqual(engine.getMultiplier(), 1.5);
});

test('ChallengeModifierEngine encodes and decodes Base64 challenge URL parameters', () => {
  const engine = new ChallengeModifierEngine();
  engine.enableModifier('suddenDeath');
  engine.enableModifier('turboClock');

  const shareUrl = engine.encodeShareableUrl('cyber-runner');
  assert.ok(shareUrl.includes('challenge='));

  const decodedEngine = new ChallengeModifierEngine();
  const res = decodedEngine.decodeShareableUrl(shareUrl);

  assert.ok(res);
  assert.strictEqual(res.gameId, 'cyber-runner');
  assert.strictEqual(decodedEngine.isModifierActive('suddenDeath'), true);
  assert.strictEqual(decodedEngine.isModifierActive('turboClock'), true);
  assert.strictEqual(decodedEngine.isModifierActive('fogOfWar'), false);
});
