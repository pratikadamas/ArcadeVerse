/**
 * Automated Unit Test Suite for ArcadeDifficultyFilter
 * Issue #1506 - Game Difficulty Rating Filter with Active Tag Pills and Counts
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const diffFilter = require('../assets/js/difficulty-filter.js');

const SAMPLE_GAMES = [
  { id: 'g1', title: 'Zen Clicker', category: 'Puzzle', difficulty: 'Easy', tags: ['casual'] },
  { id: 'g2', title: 'Cyber Snake', category: 'Arcade', difficulty: 'Medium', tags: ['retro'] },
  { id: 'g3', title: 'Astro Courier', category: 'Arcade', difficulty: 'Intermediate', tags: ['action'] },
  { id: 'g4', title: 'Shadow Gauntlet', category: 'Action', difficulty: 'Hard', tags: ['survival'] },
  { id: 'g5', title: 'Neon Bullet Hell', category: 'Arcade', difficulty: 'Insane', tags: ['roguelike'] },
  { id: 'g6', title: 'Simple Tapper', category: 'Arcade', tags: ['relaxing', 'clicker'] }
];

test('ArcadeDifficultyFilter exports all required API methods', () => {
  assert.ok(Array.isArray(diffFilter.DIFFICULTY_TIERS));
  assert.equal(diffFilter.DIFFICULTY_TIERS.length, 5);
  assert.equal(typeof diffFilter.classifyDifficulty, 'function');
  assert.equal(typeof diffFilter.computeTierCounts, 'function');
  assert.equal(typeof diffFilter.matchesGame, 'function');
  assert.equal(typeof diffFilter.filterGames, 'function');
  assert.equal(typeof diffFilter.setActiveDifficulty, 'function');
  assert.equal(typeof diffFilter.getActiveDifficulty, 'function');
});

test('classifyDifficulty accurately maps explicit difficulty metadata and heuristic fallbacks', () => {
  assert.equal(diffFilter.classifyDifficulty(SAMPLE_GAMES[0]), 'casual');
  assert.equal(diffFilter.classifyDifficulty(SAMPLE_GAMES[1]), 'normal');
  assert.equal(diffFilter.classifyDifficulty(SAMPLE_GAMES[2]), 'normal');
  assert.equal(diffFilter.classifyDifficulty(SAMPLE_GAMES[3]), 'hard');
  assert.equal(diffFilter.classifyDifficulty(SAMPLE_GAMES[4]), 'insane');
  assert.equal(diffFilter.classifyDifficulty(SAMPLE_GAMES[5]), 'casual');
  assert.equal(diffFilter.classifyDifficulty({ id: 'unknown' }), 'normal');
});

test('computeTierCounts calculates exact game counts per difficulty tier', () => {
  const counts = diffFilter.computeTierCounts(SAMPLE_GAMES);
  assert.equal(counts.all, 6);
  assert.equal(counts.casual, 2);
  assert.equal(counts.normal, 2);
  assert.equal(counts.hard, 1);
  assert.equal(counts.insane, 1);
});

test('filterGames combines difficulty with category/search predicates and handles empty results', () => {
  const allArcade = diffFilter.filterGames(SAMPLE_GAMES, 'all', (g) => g.category === 'Arcade');
  assert.equal(allArcade.length, 4);

  const insaneArcade = diffFilter.filterGames(SAMPLE_GAMES, 'insane', (g) => g.category === 'Arcade');
  assert.equal(insaneArcade.length, 1);
  assert.equal(insaneArcade[0].id, 'g5');

  const emptyResult = diffFilter.filterGames(SAMPLE_GAMES, 'insane', (g) => g.category === 'Puzzle');
  assert.deepEqual(emptyResult, []);
});

test('setActiveDifficulty updates active tier state cleanly', () => {
  assert.equal(diffFilter.setActiveDifficulty('hard', true), 'hard');
  assert.equal(diffFilter.getActiveDifficulty(), 'hard');
  assert.equal(diffFilter.matchesGame(SAMPLE_GAMES[3]), true);
  assert.equal(diffFilter.matchesGame(SAMPLE_GAMES[0]), false);

  assert.equal(diffFilter.setActiveDifficulty('unknown-tier', true), 'all');
  assert.equal(diffFilter.getActiveDifficulty(), 'all');
});

test('CSS stylesheet defines distinct color accents for all four difficulty tiers', () => {
  const css = fs.readFileSync(path.join(__dirname, '../assets/css/difficulty-filter.css'), 'utf8');
  assert.ok(css.includes('[data-difficulty="casual"]'));
  assert.ok(css.includes('[data-difficulty="normal"]'));
  assert.ok(css.includes('[data-difficulty="hard"]'));
  assert.ok(css.includes('[data-difficulty="insane"]'));
});

test('Ensures zero Unicode emojis across all difficulty-filter files', () => {
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/u;

  const filesToCheck = [
    'assets/js/difficulty-filter.js',
    'assets/css/difficulty-filter.css',
    'scripts/test-difficulty-filter.js'
  ];

  for (const relPath of filesToCheck) {
    const fullPath = path.join(__dirname, '..', relPath);
    const content = fs.readFileSync(fullPath, 'utf8');
    assert.equal(emojiRegex.test(content), false, `Found forbidden Unicode emoji in ${relPath}`);
  }
});
