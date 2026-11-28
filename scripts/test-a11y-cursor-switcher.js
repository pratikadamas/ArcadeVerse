const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Cursor switcher stylesheet and controller exist', (t) => {
  const cssPath = path.join(__dirname, '..', 'assets', 'css', 'a11y-cursor-switcher.css');
  const jsPath = path.join(__dirname, '..', 'assets', 'js', 'a11y-cursor-switcher.js');

  assert.ok(fs.existsSync(cssPath), 'CSS file should exist');
  assert.ok(fs.existsSync(jsPath), 'JS file should exist');

  const css = fs.readFileSync(cssPath, 'utf8');
  assert.ok(css.includes('body.cursor-large-cyan'), 'Contains large cyan cursor class');
  assert.ok(css.includes('body.cursor-large-amber'), 'Contains large amber cursor class');
});

test('CursorSwitcherManager validates and toggles cursor modes', (t) => {
  const { CursorSwitcherManager } = require('../assets/js/a11y-cursor-switcher.js');
  const mgr = new CursorSwitcherManager();

  assert.strictEqual(mgr.currentMode, 'default');

  assert.strictEqual(mgr.setMode('large-cyan'), true);
  assert.strictEqual(mgr.currentMode, 'large-cyan');

  assert.strictEqual(mgr.setMode('invalid_mode'), false);
  assert.strictEqual(mgr.currentMode, 'large-cyan');

  assert.strictEqual(mgr.setMode('default'), true);
  assert.strictEqual(mgr.currentMode, 'default');
});
