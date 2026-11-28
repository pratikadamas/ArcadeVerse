const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Theater dimmer styles and controller exist', (t) => {
  const cssPath = path.join(__dirname, '..', 'assets', 'css', 'theater-dimmer.css');
  const jsPath = path.join(__dirname, '..', 'assets', 'js', 'theater-dimmer.js');

  assert.ok(fs.existsSync(cssPath), 'CSS file should exist');
  assert.ok(fs.existsSync(jsPath), 'JS file should exist');

  const css = fs.readFileSync(cssPath, 'utf8');
  assert.ok(css.includes('.theater-dimmer-slider'), 'Includes slider styles');
  assert.ok(css.includes('.theater-dimmer-value'), 'Includes percentage label styles');
});

test('TheaterDimmerManager safely clamps opacity limits', (t) => {
  const { TheaterDimmerManager } = require('../assets/js/theater-dimmer.js');
  const mgr = new TheaterDimmerManager();

  assert.strictEqual(mgr.clampOpacity(0.10), 0.40, 'Clamps lower limit');
  assert.strictEqual(mgr.clampOpacity(1.00), 0.98, 'Clamps upper limit');
  assert.strictEqual(mgr.clampOpacity(0.75), 0.75, 'Accepts valid middle values');

  mgr.setOpacity(0.90);
  assert.strictEqual(mgr.opacity, 0.90);
});
