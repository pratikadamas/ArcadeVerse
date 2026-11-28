const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Bondi Blue Aqua Theme CSS and JS files exist with complete token definitions', (t) => {
  const cssPath = path.join(__dirname, '..', 'assets', 'css', 'theme-bondi-aqua.css');
  const jsPath = path.join(__dirname, '..', 'assets', 'js', 'theme-bondi-aqua.js');

  assert.ok(fs.existsSync(cssPath), 'CSS file should exist');
  assert.ok(fs.existsSync(jsPath), 'JS file should exist');

  const css = fs.readFileSync(cssPath, 'utf8');
  assert.ok(css.includes('--bondi-blue'), 'Contains bondi blue token');
  assert.ok(css.includes('.aqua-gel-btn'), 'Contains aqua gel button style');
  assert.ok(css.includes('.gloss-pulse-active'), 'Contains gloss pulse style');
});

test('BondiAquaThemeManager registers tokens and toggles gloss pulse state', (t) => {
  const { BondiAquaThemeManager } = require('../assets/js/theme-bondi-aqua.js');
  const mgr = new BondiAquaThemeManager();

  assert.strictEqual(BondiAquaThemeManager.THEME_ID, 'bondi-blue-aqua');
  assert.strictEqual(BondiAquaThemeManager.TOKENS.bondiBlue, '#0095b6');

  assert.strictEqual(mgr.glossPulseEnabled, true);
  mgr.toggleGlossPulse(false);
  assert.strictEqual(mgr.glossPulseEnabled, false);
  mgr.toggleGlossPulse(true);
  assert.strictEqual(mgr.glossPulseEnabled, true);
});
