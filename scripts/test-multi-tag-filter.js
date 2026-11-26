/**
 * Automated Unit Test Suite for ArcadeMultiTagFilter
 * Issue #1495 - Multi-Tag Filtering System with AND-OR Logic Toggle
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const mtf = require('../assets/js/multi-tag-filter.js');

const SAMPLE_GAMES = [
  { id: 'g1', title: 'Chess Arena', category: 'Strategy', tags: ['multiplayer', 'puzzle', 'board'] },
  { id: 'g2', title: 'Co-op Shooter', category: 'Action', tags: ['multiplayer', 'arcade'] },
  { id: 'g3', title: 'Solo Wordle', category: 'Puzzle', tags: ['puzzle', 'retro'] },
  { id: 'g4', title: 'Neon Racer', category: 'Arcade', tags: ['speed', 'retro'] }
];

test('ArcadeMultiTagFilter exports required API methods', () => {
  assert.equal(typeof mtf.extractAvailableTags, 'function');
  assert.equal(typeof mtf.matchesGame, 'function');
  assert.equal(typeof mtf.filterGames, 'function');
  assert.equal(typeof mtf.toggleTag, 'function');
  assert.equal(typeof mtf.removeTag, 'function');
  assert.equal(typeof mtf.clearTags, 'function');
  assert.equal(typeof mtf.setLogicMode, 'function');
});

test('filterGames enforces AND (all) vs OR (any) matching rules accurately', () => {
  // Empty selection returns all games
  assert.equal(mtf.filterGames(SAMPLE_GAMES, [], 'all').length, 4);

  // AND mode ('all'): must contain BOTH multiplayer AND puzzle -> only g1
  const andMatches = mtf.filterGames(SAMPLE_GAMES, ['multiplayer', 'puzzle'], 'all');
  assert.equal(andMatches.length, 1);
  assert.equal(andMatches[0].id, 'g1');

  // OR mode ('any'): contains multiplayer OR puzzle -> g1, g2, g3
  const orMatches = mtf.filterGames(SAMPLE_GAMES, ['multiplayer', 'puzzle'], 'any');
  assert.equal(orMatches.length, 3);
  assert.deepEqual(orMatches.map((g) => g.id), ['g1', 'g2', 'g3']);
});

test('toggleTag, removeTag, clearTags, and setLogicMode manage state cleanly', () => {
  mtf.clearTags(true);
  mtf.setLogicMode('all', true);

  mtf.toggleTag('Retro', true);
  mtf.toggleTag('Puzzle', true);
  assert.deepEqual(mtf.getState().selectedTags, ['retro', 'puzzle']);
  assert.equal(mtf.getState().logicMode, 'all');

  // In AND mode, only g3 has both 'retro' and 'puzzle'
  assert.equal(mtf.filterGames(SAMPLE_GAMES).length, 1);

  // Switch to OR mode -> g1, g3, g4 match 'retro' or 'puzzle'
  mtf.setLogicMode('any', true);
  assert.equal(mtf.filterGames(SAMPLE_GAMES).length, 3);

  mtf.removeTag('retro', true);
  assert.deepEqual(mtf.getState().selectedTags, ['puzzle']);

  mtf.clearTags(true);
  assert.deepEqual(mtf.getState().selectedTags, []);
});

test('extractAvailableTags ranks frequent tags cleanly', () => {
  const topTags = mtf.extractAvailableTags(SAMPLE_GAMES, 3);
  assert.equal(topTags.length, 3);
  assert.ok(topTags.includes('multiplayer'));
  assert.ok(topTags.includes('puzzle'));
  assert.ok(topTags.includes('retro'));
});

test('Ensures zero Unicode emojis across all multi-tag-filter files', () => {
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/u;

  const filesToCheck = [
    'assets/js/multi-tag-filter.js',
    'assets/css/multi-tag-filter.css',
    'scripts/test-multi-tag-filter.js'
  ];

  for (const relPath of filesToCheck) {
    const fullPath = path.join(__dirname, '..', relPath);
    const content = fs.readFileSync(fullPath, 'utf8');
    assert.equal(emojiRegex.test(content), false, `Found forbidden Unicode emoji in ${relPath}`);
  }
});
