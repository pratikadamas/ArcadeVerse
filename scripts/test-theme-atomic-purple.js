const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Atomic Purple Theme CSS and JS artifacts exist', (t) => {
  const cssPath = path.join(__dirname, '..', 'assets', 'css', 'theme-atomic-purple.css');
  const jsPath = path.join(__dirname, '..', 'assets', 'js', 'theme-atomic-purple.js');

  assert.ok(fs.existsSync(cssPath), 'CSS file should exist');
  assert.ok(fs.existsSync(jsPath), 'JS file should exist');

  const css = fs.readFileSync(cssPath, 'utf8');
  assert.ok(css.includes('--gbc-lcd-emerald'), 'Includes emerald LCD token');
  assert.ok(css.includes('--gbc-shell-purple'), 'Includes purple shell token');
  assert.ok(css.includes('.internal-glow-active'), 'Includes internal glow LED style');
});

test('AtomicPurpleThemeManager validates tokens and glow toggle', (t) => {
  const { AtomicPurpleThemeManager } = require('../assets/js/theme-atomic-purple.js');
  const mgr = new AtomicPurpleThemeManager();

  assert.strictEqual(AtomicPurpleThemeManager.THEME_ID, 'atomic-purple');
  assert.strictEqual(AtomicPurpleThemeManager.COLOR_TOKENS.lcdEmerald, '#9bbc0f');
  assert.strictEqual(AtomicPurpleThemeManager.COLOR_TOKENS.lcdCharcoal, '#0f380f');

  assert.strictEqual(mgr.internalGlowEnabled, true);
  mgr.toggleInternalGlow(false);
  assert.strictEqual(mgr.internalGlowEnabled, false);
  mgr.toggleInternalGlow(true);
  assert.strictEqual(mgr.internalGlowEnabled, true);
});
