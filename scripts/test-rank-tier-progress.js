const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Rank tier progress stylesheets and script exist', (t) => {
  const cssPath = path.join(__dirname, '..', 'assets', 'css', 'rank-tier-progress.css');
  const jsPath = path.join(__dirname, '..', 'assets', 'js', 'rank-tier-progress.js');

  assert.ok(fs.existsSync(cssPath), 'CSS file should exist');
  assert.ok(fs.existsSync(jsPath), 'JS file should exist');

  const css = fs.readFileSync(cssPath, 'utf8');
  assert.ok(css.includes('.tier-diamond'), 'Contains diamond tier style');
  assert.ok(css.includes('.rank-delta-up'), 'Contains positive rank delta style');
});

test('RankTierProgressManager computes tiers and progress percentages accurately', (t) => {
  const { RankTierProgressManager } = require('../assets/js/rank-tier-progress.js');

  const bronze = RankTierProgressManager.getTierForPoints(50);
  assert.strictEqual(bronze.name, 'Bronze');

  const gold = RankTierProgressManager.getTierForPoints(300);
  assert.strictEqual(gold.name, 'Gold');

  const progress = RankTierProgressManager.calculateProgress(150);
  assert.strictEqual(progress.currentTier.name, 'Silver');
  assert.ok(progress.percent >= 0 && progress.percent <= 100);

  const deltaUp = RankTierProgressManager.formatRankDelta(10, 8);
  assert.strictEqual(deltaUp.text, '+2');
  assert.strictEqual(deltaUp.class, 'rank-delta-up');

  const deltaDown = RankTierProgressManager.formatRankDelta(3, 5);
  assert.strictEqual(deltaDown.text, '-2');
  assert.strictEqual(deltaDown.class, 'rank-delta-down');
});
