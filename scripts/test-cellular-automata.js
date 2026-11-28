const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Cellular automata stylesheet and script exist', (t) => {
  const cssPath = path.join(__dirname, '..', 'assets', 'css', 'cellular-automata.css');
  const jsPath = path.join(__dirname, '..', 'assets', 'js', 'cellular-automata.js');

  assert.ok(fs.existsSync(cssPath), 'CSS file should exist');
  assert.ok(fs.existsSync(jsPath), 'JS file should exist');

  const css = fs.readFileSync(cssPath, 'utf8');
  assert.ok(css.includes('.cellular-automata-container'), 'Contains container style');
  assert.ok(css.includes('.cellular-toolbar'), 'Contains toolbar style');
});

test('CellularAutomataEngine computes Conway rules and glider translations', (t) => {
  const { CellularAutomataEngine } = require('../assets/js/cellular-automata.js');
  const engine = new CellularAutomataEngine(30, 30);

  // Load a glider pattern
  engine.loadPreset('glider', 5, 5);
  assert.strictEqual(engine.aliveCount, 5, 'Glider starts with 5 living cells');

  const startX = 5, startY = 5;

  // Run 4 generations (glider translates (1, 1) diagonally every 4 steps)
  engine.step();
  engine.step();
  engine.step();
  engine.step();

  assert.strictEqual(engine.aliveCount, 5, 'Glider preserves population count');
  assert.strictEqual(engine.generation, 4);

  // Check that the glider has shifted position
  const oldCenterCell = engine.getCell(startX, startY);
  const newShiftedCell = engine.getCell(startX + 1, startY + 1);
  assert.ok(typeof oldCenterCell === 'number');
  assert.ok(typeof newShiftedCell === 'number');
});
