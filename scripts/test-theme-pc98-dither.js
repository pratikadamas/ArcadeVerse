const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('PC-98 theme CSS and JS files exist with complete token definitions', (t) => {
  const cssPath = path.join(__dirname, '..', 'assets', 'css', 'theme-pc98-dither.css');
  const jsPath = path.join(__dirname, '..', 'assets', 'js', 'theme-pc98-dither.js');

  assert.ok(fs.existsSync(cssPath), 'CSS file should exist');
  assert.ok(fs.existsSync(jsPath), 'JS file should exist');

  const css = fs.readFileSync(cssPath, 'utf8');
  assert.ok(css.includes('--pc98-navy'), 'Contains PC-98 navy token');
  assert.ok(css.includes('--pc98-cyan'), 'Contains PC-98 cyan token');
  assert.ok(css.includes('.pc98-crt-interlace'), 'Contains interlace filter style');
});

test('PC98ThemeManager registers palette and toggles interlace overlay', (t) => {
  const { PC98ThemeManager } = require('../assets/js/theme-pc98-dither.js');
  const mgr = new PC98ThemeManager();

  assert.strictEqual(PC98ThemeManager.THEME_ID, 'pc98-msx2-dither');
  assert.strictEqual(PC98ThemeManager.TOKENS.navy, '#080828');
  assert.strictEqual(PC98ThemeManager.TOKENS.cyan, '#44ffee');

  assert.strictEqual(mgr.interlaceEnabled, true);
  mgr.toggleInterlace(false);
  assert.strictEqual(mgr.interlaceEnabled, false);
  mgr.toggleInterlace(true);
  assert.strictEqual(mgr.interlaceEnabled, true);
});
