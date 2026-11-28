const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Sega Genesis 16-Bit Theme stylesheet and script exist', (t) => {
  const cssPath = path.join(__dirname, '..', 'assets', 'css', 'theme-genesis-16bit.css');
  const jsPath = path.join(__dirname, '..', 'assets', 'js', 'theme-genesis-16bit.js');

  assert.ok(fs.existsSync(cssPath), 'CSS file should exist');
  assert.ok(fs.existsSync(jsPath), 'JS file should exist');

  const css = fs.readFileSync(cssPath, 'utf8');
  assert.ok(css.includes('--genesis-sonic-blue'), 'Contains Sonic Blue token');
  assert.ok(css.includes('--genesis-gold-ring'), 'Contains Gold Ring token');
  assert.ok(css.includes('.blast-processing-active'), 'Contains blast processing active class');
});

test('Genesis16BitThemeManager registers tokens and toggles blast processing', (t) => {
  const { Genesis16BitThemeManager } = require('../assets/js/theme-genesis-16bit.js');
  const mgr = new Genesis16BitThemeManager();

  assert.strictEqual(Genesis16BitThemeManager.THEME_ID, 'genesis-16bit');
  assert.strictEqual(Genesis16BitThemeManager.COLOR_TOKENS.sonicBlue, '#0038ce');
  assert.strictEqual(Genesis16BitThemeManager.COLOR_TOKENS.goldRing, '#f8b800');

  assert.strictEqual(mgr.blastProcessingEnabled, true);
  mgr.toggleBlastProcessing(false);
  assert.strictEqual(mgr.blastProcessingEnabled, false);
  mgr.toggleBlastProcessing(true);
  assert.strictEqual(mgr.blastProcessingEnabled, true);
});
