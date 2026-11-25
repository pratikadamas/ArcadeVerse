/**
 * Automated Unit Test Suite for ArcadePlayMilestones
 * Issue #1494 - Game Card Play-Count Milestone Badges with Unlock Animations
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// Minimal localStorage mock for Node.js environment
function createMockStorage() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => { store.clear(); }
  };
}

global.localStorage = createMockStorage();

const milestones = require('../assets/js/play-milestones.js');

test('ArcadePlayMilestones exports all required API methods and constants', () => {
  assert.equal(milestones.STORAGE_PREFIX, 'arcadeverse_game_plays_');
  assert.ok(Array.isArray(milestones.MILESTONE_TIERS));
  assert.equal(milestones.MILESTONE_TIERS.length, 4);
  assert.equal(typeof milestones.getPlayCount, 'function');
  assert.equal(typeof milestones.setPlayCount, 'function');
  assert.equal(typeof milestones.getMilestoneForCount, 'function');
  assert.equal(typeof milestones.incrementPlayCount, 'function');
  assert.equal(typeof milestones.injectBadgeIntoCard, 'function');
  assert.equal(typeof milestones.refreshAllCards, 'function');
});

test('getMilestoneForCount accurately resolves Rookie, Veteran, Master, and Century thresholds', () => {
  assert.equal(milestones.getMilestoneForCount(0), null);
  assert.equal(milestones.getMilestoneForCount(-5), null);

  assert.equal(milestones.getMilestoneForCount(1).label, 'Rookie');
  assert.equal(milestones.getMilestoneForCount(9).label, 'Rookie');

  assert.equal(milestones.getMilestoneForCount(10).label, 'Veteran');
  assert.equal(milestones.getMilestoneForCount(24).label, 'Veteran');

  assert.equal(milestones.getMilestoneForCount(25).label, 'Master');
  assert.equal(milestones.getMilestoneForCount(99).label, 'Master');

  assert.equal(milestones.getMilestoneForCount(100).label, 'Century');
  assert.equal(milestones.getMilestoneForCount(250).label, 'Century');
});

test('incrementPlayCount persists to localStorage and detects milestone tier unlocks', () => {
  global.localStorage.clear();
  const gameId = 'cyber-snake_babin';

  assert.equal(milestones.getPlayCount(gameId), 0);

  // First play unlocks Rookie
  const first = milestones.incrementPlayCount(gameId, 'Cyber Snake');
  assert.equal(first.count, 1);
  assert.equal(first.tier.id, 'rookie');
  assert.equal(first.unlocked, true);
  assert.equal(global.localStorage.getItem('arcadeverse_game_plays_cyber-snake_babin'), '1');

  // Second play stays Rookie (no new unlock)
  const second = milestones.incrementPlayCount(gameId, 'Cyber Snake');
  assert.equal(second.count, 2);
  assert.equal(second.tier.id, 'rookie');
  assert.equal(second.unlocked, false);

  // Set to 9 plays, next play (10) unlocks Veteran
  milestones.setPlayCount(gameId, 9);
  const tenth = milestones.incrementPlayCount(gameId, 'Cyber Snake');
  assert.equal(tenth.count, 10);
  assert.equal(tenth.tier.id, 'veteran');
  assert.equal(tenth.unlocked, true);

  // Set to 24 plays, next play (25) unlocks Master
  milestones.setPlayCount(gameId, 24);
  const twentyFifth = milestones.incrementPlayCount(gameId, 'Cyber Snake');
  assert.equal(twentyFifth.count, 25);
  assert.equal(twentyFifth.tier.id, 'master');
  assert.equal(twentyFifth.unlocked, true);

  // Set to 99 plays, next play (100) unlocks Century
  milestones.setPlayCount(gameId, 99);
  const hundredth = milestones.incrementPlayCount(gameId, 'Cyber Snake');
  assert.equal(hundredth.count, 100);
  assert.equal(hundredth.tier.id, 'century');
  assert.equal(hundredth.unlocked, true);
});

test('injectBadgeIntoCard applies milestone class to card element cleanly', () => {
  global.localStorage.clear();
  milestones.setPlayCount('quantum-2048_babin', 28);

  const classes = new Set(['game-card']);
  const mockCard = {
    getAttribute: (attr) => (attr === 'data-game-id' ? 'quantum-2048_babin' : null),
    classList: {
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c),
      contains: (c) => classes.has(c)
    },
    querySelector: () => null
  };

  const tier = milestones.injectBadgeIntoCard(mockCard, false);
  assert.ok(tier);
  assert.equal(tier.id, 'master');
  assert.equal(classes.has('milestone-master'), true);
});

test('CSS stylesheet defines all four tiers and unlock shimmer animation', () => {
  const css = fs.readFileSync(path.join(__dirname, '../assets/css/play-milestones.css'), 'utf8');
  assert.ok(css.includes('.play-milestone-badge.tier-rookie'));
  assert.ok(css.includes('.play-milestone-badge.tier-veteran'));
  assert.ok(css.includes('.play-milestone-badge.tier-master'));
  assert.ok(css.includes('.play-milestone-badge.tier-century'));
  assert.ok(css.includes('@keyframes milestone-unlock-shimmer'));
  assert.ok(css.includes('@media (prefers-reduced-motion: reduce)'));
});

test('Ensures zero Unicode emojis across all play-milestones files', () => {
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/u;

  const filesToCheck = [
    'assets/js/play-milestones.js',
    'assets/css/play-milestones.css',
    'scripts/test-play-milestones.js'
  ];

  for (const relPath of filesToCheck) {
    const fullPath = path.join(__dirname, '..', relPath);
    const content = fs.readFileSync(fullPath, 'utf8');
    assert.equal(emojiRegex.test(content), false, `Found forbidden Unicode emoji in ${relPath}`);
  }
});

