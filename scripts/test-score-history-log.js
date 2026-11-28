const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Score history stylesheet and script exist', (t) => {
  const cssPath = path.join(__dirname, '..', 'assets', 'css', 'score-history-log.css');
  const jsPath = path.join(__dirname, '..', 'assets', 'js', 'score-history-log.js');

  assert.ok(fs.existsSync(cssPath), 'CSS file should exist');
  assert.ok(fs.existsSync(jsPath), 'JS file should exist');

  const css = fs.readFileSync(cssPath, 'utf8');
  assert.ok(css.includes('.score-history-val'), 'Includes score val');
  assert.ok(css.includes('.score-history-delta'), 'Includes delta styles');
});

test('ScoreHistoryManager logs record progression and deltas properly', (t) => {
  const { ScoreHistoryManager } = require('../assets/js/score-history-log.js');
  const mgr = new ScoreHistoryManager();

  // Mock localStorage for node test
  const store = {};
  global.localStorage = {
    getItem: (k) => store[k] || null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };

  const res1 = mgr.recordScore('pacman', 1000);
  assert.strictEqual(res1.recorded, true);
  assert.strictEqual(res1.entry.delta, 1000);

  const res2 = mgr.recordScore('pacman', 800); // lower than 1000, not a record
  assert.strictEqual(res2.recorded, false);

  const res3 = mgr.recordScore('pacman', 1500); // higher, delta +500
  assert.strictEqual(res3.recorded, true);
  assert.strictEqual(res3.entry.delta, 500);

  const history = mgr.getHistory('pacman');
  assert.strictEqual(history.length, 2);
  assert.strictEqual(history[0].score, 1500);
});
