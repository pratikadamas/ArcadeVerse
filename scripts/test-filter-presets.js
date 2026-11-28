const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Filter presets stylesheet and controller exist', (t) => {
  const cssPath = path.join(__dirname, '..', 'assets', 'css', 'filter-presets.css');
  const jsPath = path.join(__dirname, '..', 'assets', 'js', 'filter-presets.js');

  assert.ok(fs.existsSync(cssPath), 'CSS file should exist');
  assert.ok(fs.existsSync(jsPath), 'JS file should exist');

  const css = fs.readFileSync(cssPath, 'utf8');
  assert.ok(css.includes('.preset-slot-pill'), 'Contains slot pill');
  assert.ok(css.includes('.save-preset-btn'), 'Contains save button');
});

test('FilterPresetManager manages presets lifecycle and limits', (t) => {
  const { FilterPresetManager } = require('../assets/js/filter-presets.js');
  const mgr = new FilterPresetManager();

  // Reset presets for isolated test
  mgr.presets = [];

  const p1 = mgr.addPreset('Retro Action', { category: 'retro', search: 'space' });
  assert.ok(p1);
  assert.strictEqual(mgr.getPresets().length, 1);
  assert.strictEqual(mgr.getPresets()[0].name, 'Retro Action');

  // Fill up to max
  mgr.addPreset('P2', {});
  mgr.addPreset('P3', {});
  mgr.addPreset('P4', {});
  mgr.addPreset('P5', {});
  assert.strictEqual(mgr.getPresets().length, 5);

  // 6th preset should be rejected
  const p6 = mgr.addPreset('Overflow', {});
  assert.strictEqual(p6, false);

  // Remove
  const removed = mgr.removePreset(p1.id);
  assert.strictEqual(removed, true);
  assert.strictEqual(mgr.getPresets().length, 4);
});
