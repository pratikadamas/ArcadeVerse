const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Amiga Workbench 1.3 CSS and JS files exist with complete token definitions', (t) => {
  const cssPath = path.join(__dirname, '..', 'assets', 'css', 'theme-amiga-wb.css');
  const jsPath = path.join(__dirname, '..', 'assets', 'js', 'theme-amiga-wb.js');

  assert.ok(fs.existsSync(cssPath), 'CSS file should exist');
  assert.ok(fs.existsSync(jsPath), 'JS file should exist');

  const css = fs.readFileSync(cssPath, 'utf8');
  assert.ok(css.includes('--wb-blue'), 'Contains Workbench blue token');
  assert.ok(css.includes('--wb-orange'), 'Contains copper orange token');
  assert.ok(css.includes('.guru-meditation-banner'), 'Contains Guru Meditation banner style');
});

test('AmigaWorkbenchThemeManager registers palette and toggles scanlines', (t) => {
  const { AmigaWorkbenchThemeManager } = require('../assets/js/theme-amiga-wb.js');
  const mgr = new AmigaWorkbenchThemeManager();

  assert.strictEqual(AmigaWorkbenchThemeManager.THEME_ID, 'amiga-workbench-13');
  assert.strictEqual(AmigaWorkbenchThemeManager.PALETTE.workbenchBlue, '#0055aa');
  assert.strictEqual(AmigaWorkbenchThemeManager.PALETTE.copperOrange, '#ff8800');

  assert.strictEqual(mgr.scanlinesEnabled, false);
  mgr.toggleScanlines(true);
  assert.strictEqual(mgr.scanlinesEnabled, true);
  mgr.toggleScanlines(false);
  assert.strictEqual(mgr.scanlinesEnabled, false);
});
