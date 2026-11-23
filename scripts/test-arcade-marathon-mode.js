/**
 * Automated Unit Tests for Arcade Survival Marathon Mode (#1106)
 * Run via: node --test scripts/test-arcade-marathon-mode.js
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const marathon = require('../assets/js/arcade-marathon-mode.js');

// Mock localStorage for headless Node testing
function createMockStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    }
  };
}

const mockGames = [
  { id: 'cyber-snake', title: 'Cyber Snake', category: 'Arcade', author: 'Babin' },
  { id: 'quantum-slide', title: 'Quantum Slide', category: 'Puzzle', author: 'Babin' },
  { id: 'synth-wave-surfer', title: 'Synth Wave Surfer', category: 'Action', author: 'Babin' },
  { id: 'space-invaders', title: 'Space Invaders', category: 'Shooter', author: 'Babin' }
];

test('MarathonEngine initializes with correct defaults', () => {
  const storage = createMockStorage();
  const engine = new marathon.MarathonEngine(storage, mockGames);

  assert.equal(engine.active, false);
  assert.equal(engine.lives, marathon.INITIAL_LIVES);
  assert.equal(engine.timeRemaining, marathon.DEFAULT_GLOBAL_TIME);
  assert.equal(engine.stageTimeRemaining, marathon.STAGE_DURATION);
  assert.equal(engine.consecutiveCleared, 0);
  assert.equal(engine.cumulativeScore, 0);
  assert.equal(engine.ledger.highStreak, 0);
  assert.equal(engine.ledger.bestScore, 0);
});

test('MarathonEngine.start() launches active run with 60s timer and 3 lives', () => {
  const storage = createMockStorage();
  const engine = new marathon.MarathonEngine(storage, mockGames);

  const res = engine.start();
  assert.equal(res.ok, true);
  assert.equal(engine.active, true);
  assert.equal(engine.lives, 3);
  assert.equal(engine.timeRemaining, 60);
  assert.ok(engine.currentGame);
  assert.ok(mockGames.some(g => g.id === engine.currentGame.id));

  engine.stop();
  assert.equal(engine.active, false);
});

test('tick() decrements global and stage countdown timers', () => {
  const storage = createMockStorage();
  const engine = new marathon.MarathonEngine(storage, mockGames);

  engine.start();
  engine.tick();

  assert.equal(engine.timeRemaining, 59);
  assert.equal(engine.stageTimeRemaining, 29);

  engine.stop();
});

test('Surviving 30 seconds stage awards consecutive clear, points, time bonus, and triggers warp', () => {
  const storage = createMockStorage();
  const engine = new marathon.MarathonEngine(storage, mockGames);

  engine.start();
  engine.stageTimeRemaining = 1;
  engine.timeRemaining = 40;

  // Simulate tick that finishes the stage
  engine.tick();

  assert.equal(engine.consecutiveCleared, 1);
  assert.ok(engine.cumulativeScore > 1000);
  // Time bonus +15 added to remaining time (40 - 1 + 15 = 54)
  assert.equal(engine.timeRemaining, 39 + marathon.TIME_BONUS_ON_CLEAR);
  assert.equal(engine.stageTimeRemaining, marathon.STAGE_DURATION);
  assert.equal(engine.isWarping, true);

  engine.stop();
});

test('Time expiration deducts a life and resets timer if lives remain', () => {
  const storage = createMockStorage();
  const engine = new marathon.MarathonEngine(storage, mockGames);

  engine.start();
  engine.timeRemaining = 1;
  engine.lives = 3;

  engine.tick();

  assert.equal(engine.lives, 2);
  assert.equal(engine.timeRemaining, 45); // Penalty reset timer
  assert.equal(engine.active, true);

  // Expire remaining lives
  engine.timeRemaining = 1;
  engine.tick();
  assert.equal(engine.lives, 1);

  engine.timeRemaining = 1;
  engine.tick();
  assert.equal(engine.lives, 0);
  assert.equal(engine.active, false); // Game Over
});

test('handleInGameDefeat deducts a life and terminates on 0 lives', () => {
  const storage = createMockStorage();
  const engine = new marathon.MarathonEngine(storage, mockGames);

  engine.start();
  assert.equal(engine.lives, 3);

  engine.handleInGameDefeat();
  assert.equal(engine.lives, 2);
  assert.equal(engine.active, true);

  engine.handleInGameDefeat();
  assert.equal(engine.lives, 1);

  engine.handleInGameDefeat();
  assert.equal(engine.lives, 0);
  assert.equal(engine.active, false);
});

test('Awards Marathon Champion badge at 5 and 10 streak milestones and persists ledger', () => {
  const storage = createMockStorage();
  const engine = new marathon.MarathonEngine(storage, mockGames);

  engine.start();

  // Simulate clearing 5 games
  engine.consecutiveCleared = 5;
  engine.checkBadgeMilestones();

  assert.equal(engine.ledger.badges.length, 1);
  assert.equal(engine.ledger.badges[0].id, 'marathon_champion_5');
  assert.equal(engine.ledger.badges[0].name, 'Marathon Champion: Contender');

  // Simulate clearing 10 games
  engine.consecutiveCleared = 10;
  engine.checkBadgeMilestones();

  assert.equal(engine.ledger.badges.length, 2);
  assert.equal(engine.ledger.badges[1].id, 'marathon_champion_10');
  assert.equal(engine.ledger.badges[1].name, 'Marathon Champion: Legend');

  // Verify storage persistence
  const saved = JSON.parse(storage.getItem('av_marathon_ledger'));
  assert.equal(saved.badges.length, 2);

  engine.stop();
});

test('Game selection avoids repeating previous game consecutively', () => {
  const storage = createMockStorage();
  const engine = new marathon.MarathonEngine(storage, mockGames);

  engine.previousGameId = 'cyber-snake';
  for (let i = 0; i < 20; i++) {
    const next = engine.pickNextGame();
    assert.notEqual(next.id, 'cyber-snake');
  }
});

test('Ensures zero Unicode emojis in marathon script and stylesheet', () => {
  const scriptPath = require.resolve('../assets/js/arcade-marathon-mode.js');
  const cssPath = require.resolve('../assets/css/arcade-marathon-mode.css');

  const scriptContent = fs.readFileSync(scriptPath, 'utf8');
  const cssContent = fs.readFileSync(cssPath, 'utf8');

  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

  assert.equal(emojiRegex.test(scriptContent), false, 'Found emoji in arcade-marathon-mode.js');
  assert.equal(emojiRegex.test(cssContent), false, 'Found emoji in arcade-marathon-mode.css');
});
