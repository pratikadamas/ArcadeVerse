const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Atari 2600 CSS and JS artifacts exist with complete token definitions', (t) => {
  const cssPath = path.join(__dirname, '..', 'assets', 'css', 'theme-atari-2600.css');
  const jsPath = path.join(__dirname, '..', 'assets', 'js', 'theme-atari-2600.js');

  assert.ok(fs.existsSync(cssPath), 'CSS file should exist');
  assert.ok(fs.existsSync(jsPath), 'JS file should exist');

  const css = fs.readFileSync(cssPath, 'utf8');
  assert.ok(css.includes('--atari-wood-dark'), 'Contains wood dark token');
  assert.ok(css.includes('--tia-rainbow-stripe') || css.includes('.atari-tia-rainbow-stripe'), 'Contains TIA rainbow stripe');
  assert.ok(css.includes('.atari-rocker-switch'), 'Contains rocker switch styling');
});

test('Atari2600ThemeManager registers tokens and toggles RF static noise', (t) => {
  const { Atari2600ThemeManager } = require('../assets/js/theme-atari-2600.js');
  const mgr = new Atari2600ThemeManager();

  assert.strictEqual(Atari2600ThemeManager.THEME_ID, 'atari-2600-woodgrain');
  assert.strictEqual(Atari2600ThemeManager.TOKENS.woodDark, '#2a1810');
  assert.strictEqual(Atari2600ThemeManager.TOKENS.tiaRed, '#e02020');

  assert.strictEqual(mgr.rfStaticEnabled, false);
  mgr.toggleRFStatic(true);
  assert.strictEqual(mgr.rfStaticEnabled, true);
  mgr.toggleRFStatic(false);
  assert.strictEqual(mgr.rfStaticEnabled, false);
});
