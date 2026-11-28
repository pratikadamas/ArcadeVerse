const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Lissajous oscillograph CSS and JS files exist', (t) => {
  const cssPath = path.join(__dirname, '..', 'assets', 'css', 'lissajous-oscillograph.css');
  const jsPath = path.join(__dirname, '..', 'assets', 'js', 'lissajous-oscillograph.js');

  assert.ok(fs.existsSync(cssPath), 'CSS file should exist');
  assert.ok(fs.existsSync(jsPath), 'JS file should exist');

  const css = fs.readFileSync(cssPath, 'utf8');
  assert.ok(css.includes('.lissajous-container'), 'Contains container style');
  assert.ok(css.includes('.lissajous-hud'), 'Contains HUD style');
});

test('LissajousOscillographEngine computes bounded parametric coordinates', (t) => {
  const { LissajousOscillographEngine } = require('../assets/js/lissajous-oscillograph.js');
  const engine = new LissajousOscillographEngine(400, 300, { freqX: 3, freqY: 4, steps: 100 });

  assert.strictEqual(engine.setRatio('2:3'), true);
  assert.strictEqual(engine.freqX, 2);
  assert.strictEqual(engine.freqY, 3);

  const pts = engine.generatePoints();
  assert.strictEqual(pts.length, 101);

  // All points must reside within canvas bounds
  pts.forEach((p) => {
    assert.ok(p.x >= 0 && p.x <= 400, 'Point X within bounds');
    assert.ok(p.y >= 0 && p.y <= 300, 'Point Y within bounds');
  });
});
