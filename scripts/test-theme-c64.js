const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('C64 Theme CSS and JS artifacts exist and contain valid rules', (t) => {
  const cssPath = path.join(__dirname, '..', 'assets', 'css', 'theme-c64.css');
  const jsPath = path.join(__dirname, '..', 'assets', 'js', 'theme-c64.js');

  assert.ok(fs.existsSync(cssPath), 'CSS file should exist');
  assert.ok(fs.existsSync(jsPath), 'JS file should exist');

  const css = fs.readFileSync(cssPath, 'utf8');
  assert.ok(css.includes('--c64-cyan'), 'Includes cyan palette token');
  assert.ok(css.includes('--c64-light-blue'), 'Includes light-blue palette token');
  assert.ok(css.includes('.c64-crt-scanlines'), 'Includes scanline class');
  assert.ok(css.includes('.c64-ready-prompt'), 'Includes ready prompt class');
});

test('Commodore64ThemeManager palette and toggles behave properly', (t) => {
  const { Commodore64ThemeManager } = require('../assets/js/theme-c64.js');
  const mgr = new Commodore64ThemeManager();

  assert.strictEqual(Commodore64ThemeManager.THEME_ID, 'commodore-64');
  assert.strictEqual(Object.keys(Commodore64ThemeManager.VIC_II_PALETTE).length, 16);
  assert.strictEqual(Commodore64ThemeManager.VIC_II_PALETTE.cyan, '#aabee5');
  assert.strictEqual(Commodore64ThemeManager.VIC_II_PALETTE.blue, '#0000aa');

  // Test scanline toggle
  assert.strictEqual(mgr.scanlinesEnabled, true);
  mgr.toggleScanlines(false);
  assert.strictEqual(mgr.scanlinesEnabled, false);
  mgr.toggleScanlines(true);
  assert.strictEqual(mgr.scanlinesEnabled, true);
});
