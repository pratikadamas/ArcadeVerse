const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('PS1 Classic Grey CSS and JS files exist with complete token definitions', (t) => {
  const cssPath = path.join(__dirname, '..', 'assets', 'css', 'theme-ps1-classic.css');
  const jsPath = path.join(__dirname, '..', 'assets', 'js', 'theme-ps1-classic.js');

  assert.ok(fs.existsSync(cssPath), 'CSS file should exist');
  assert.ok(fs.existsSync(jsPath), 'JS file should exist');

  const css = fs.readFileSync(cssPath, 'utf8');
  assert.ok(css.includes('--ps1-surface-grey'), 'Contains surface grey token');
  assert.ok(css.includes('--ps-green-triangle'), 'Contains green triangle token');
  assert.ok(css.includes('.ps-memory-card-badge'), 'Contains memory card badge style');
});

test('PS1ClassicThemeManager registers tokens and safely checks audio chime', (t) => {
  const { PS1ClassicThemeManager } = require('../assets/js/theme-ps1-classic.js');
  const mgr = new PS1ClassicThemeManager();

  assert.strictEqual(PS1ClassicThemeManager.THEME_ID, 'ps1-classic-grey');
  assert.strictEqual(PS1ClassicThemeManager.TOKENS.surfaceGrey, '#a8abb0');
  assert.strictEqual(PS1ClassicThemeManager.TOKENS.blueCross, '#3d8bff');

  // Headless safe audio check
  const chimeRes = mgr.playStartupPadChime();
  assert.strictEqual(typeof chimeRes, 'boolean');
});
