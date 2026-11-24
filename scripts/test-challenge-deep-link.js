const test = require('node:test');
const assert = require('node:assert');
const { ChallengeDeepLinkManager } = require('../assets/js/challenge-deep-link.js');

test('ChallengeDeepLinkManager generates and parses sanitized challenge URLs', () => {
  const manager = new ChallengeDeepLinkManager();
  const url = manager.generateChallengeUrl('cyber-runner', 1250, 'Neo');

  assert.ok(url.includes('game=cyber-runner'));
  assert.ok(url.includes('challenge=1'));
  assert.ok(url.includes('target=1250'));
  assert.ok(url.includes('challenger=Neo'));

  const parsed = manager.parseChallengeParams(url.split('?')[1]);
  assert.ok(parsed);
  assert.strictEqual(parsed.gameId, 'cyber-runner');
  assert.strictEqual(parsed.targetScore, 1250);
  assert.strictEqual(parsed.challenger, 'Neo');
});

test('ChallengeDeepLinkManager tracks target score breakthrough events', () => {
  const manager = new ChallengeDeepLinkManager();
  manager.parseChallengeParams('game=astro-defense&challenge=1&target=500&challenger=Ace');

  const check1 = manager.checkScoreProgress(350);
  assert.strictEqual(check1.surpassed, false);
  assert.strictEqual(check1.difference, 150);

  const check2 = manager.checkScoreProgress(520);
  assert.strictEqual(check2.surpassed, true);
  assert.strictEqual(check2.score, 520);

  // Subsequent check should not re-trigger breakthrough
  const check3 = manager.checkScoreProgress(600);
  assert.strictEqual(check3.surpassed, false);
});
