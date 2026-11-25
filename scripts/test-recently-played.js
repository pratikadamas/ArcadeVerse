/**
 * Automated Unit Test Suite for ArcadeRecent (Recently Played Quick Bar)
 * Issue #1504 - Recently Played Games Quick Bar in Catalog Header with Clear Option
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

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

const ArcadeRecent = require('../assets/js/recently-played.js');

test('ArcadeRecent exports required API methods and constants', () => {
  assert.equal(ArcadeRecent.STORAGE_KEY, 'arcadeverse_recent_games');
  assert.equal(ArcadeRecent.MAX_HISTORY, 5);
  assert.equal(typeof ArcadeRecent.getRecent, 'function');
  assert.equal(typeof ArcadeRecent.saveRecent, 'function');
  assert.equal(typeof ArcadeRecent.recordPlayed, 'function');
  assert.equal(typeof ArcadeRecent.clear, 'function');
  assert.equal(typeof ArcadeRecent.render, 'function');
});

test('recordPlayed pushes items, deduplicates, and maintains FIFO cap at 5', () => {
  global.localStorage.clear();

  ArcadeRecent.recordPlayed('game-1', 'Game One', 'Arcade');
  ArcadeRecent.recordPlayed('game-2', 'Game Two', 'Puzzle');
  ArcadeRecent.recordPlayed('game-3', 'Game Three', 'Retro');
  ArcadeRecent.recordPlayed('game-4', 'Game Four', 'Action');
  ArcadeRecent.recordPlayed('game-5', 'Game Five', 'Strategy');

  let list = ArcadeRecent.getRecent();
  assert.equal(list.length, 5);
  assert.equal(list[0].id, 'game-5');
  assert.equal(list[4].id, 'game-1');

  // Pushing a 6th unique game evicts the oldest ('game-1')
  ArcadeRecent.recordPlayed('game-6', 'Game Six', 'Rhythm');
  list = ArcadeRecent.getRecent();
  assert.equal(list.length, 5);
  assert.equal(list[0].id, 'game-6');
  assert.equal(list.some((g) => g.id === 'game-1'), false);

  // Re-playing 'game-3' deduplicates and moves it to index 0
  ArcadeRecent.recordPlayed('game-3', 'Game Three', 'Retro');
  list = ArcadeRecent.getRecent();
  assert.equal(list.length, 5);
  assert.equal(list[0].id, 'game-3');
  assert.equal(list.filter((g) => g.id === 'game-3').length, 1);
});

test('clear empties localStorage and recent games list', () => {
  ArcadeRecent.recordPlayed('cyber-snake_babin', 'Cyber Snake', 'Arcade');
  assert.equal(ArcadeRecent.getRecent().length > 0, true);

  ArcadeRecent.clear();
  assert.deepEqual(ArcadeRecent.getRecent(), []);
  assert.equal(global.localStorage.getItem('arcadeverse_recent_games'), null);
});

test('Ensures zero Unicode emojis across all recently-played files', () => {
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/u;

  const filesToCheck = [
    'assets/js/recently-played.js',
    'assets/css/recently-played.css',
    'scripts/test-recently-played.js'
  ];

  for (const relPath of filesToCheck) {
    const fullPath = path.join(__dirname, '..', relPath);
    const content = fs.readFileSync(fullPath, 'utf8');
    assert.equal(emojiRegex.test(content), false, `Found forbidden Unicode emoji in ${relPath}`);
  }
});
