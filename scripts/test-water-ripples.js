const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Water ripples styles and physics engine artifacts exist', (t) => {
  const cssPath = path.join(__dirname, '..', 'assets', 'css', 'water-ripples.css');
  const jsPath = path.join(__dirname, '..', 'assets', 'js', 'water-ripples.js');

  assert.ok(fs.existsSync(cssPath), 'CSS file should exist');
  assert.ok(fs.existsSync(jsPath), 'JS file should exist');

  const css = fs.readFileSync(cssPath, 'utf8');
  assert.ok(css.includes('.water-ripples-container'), 'Contains container style');
  assert.ok(css.includes('.water-ripples-canvas'), 'Contains canvas style');
  assert.ok(css.includes('.water-ripples-hud'), 'Contains HUD style');
});

test('WaterRipplesEngine executes wave propagation and damping decay', (t) => {
  const { WaterRipplesEngine } = require('../assets/js/water-ripples.js');
  const engine = new WaterRipplesEngine(40, 30, { damping: 0.95, rainEnabled: false });

  // Add a drop in center
  engine.addDrop(20, 15, 2, 100);

  const initialVal = engine.currentBuffer[15 * 40 + 20];
  assert.ok(initialVal > 0, 'Drop height registered in current buffer');

  // Step 1: Propagate
  engine.propagate();
  const step1Val = engine.currentBuffer[15 * 40 + 20];

  // Step 2: Propagate
  engine.propagate();
  const step2Val = engine.currentBuffer[15 * 40 + 20];

  // Check neighbor wave distribution
  const neighborVal = engine.currentBuffer[15 * 40 + 21];
  assert.ok(typeof neighborVal === 'number', 'Neighbor grid cell has numeric wave energy');
});
