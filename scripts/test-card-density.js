const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Card Density Styles and Controller exist and are well-formed', (t) => {
  const cssPath = path.join(__dirname, '..', 'assets', 'css', 'card-density.css');
  const jsPath = path.join(__dirname, '..', 'assets', 'js', 'card-density.js');

  assert.ok(fs.existsSync(cssPath), 'CSS file should exist');
  assert.ok(fs.existsSync(jsPath), 'JS file should exist');

  const cssContent = fs.readFileSync(cssPath, 'utf8');
  assert.ok(cssContent.includes('.density-control-bar'), 'Includes toolbar');
  assert.ok(cssContent.includes('.density-cozy'), 'Includes cozy mode');
  assert.ok(cssContent.includes('.density-compact'), 'Includes compact mode');
});

test('CardDensityManager validates modes and updates state', (t) => {
  const { CardDensityManager } = require('../assets/js/card-density.js');
  const mgr = new CardDensityManager();

  assert.strictEqual(mgr.getMode(), 'standard', 'Defaults to standard mode');

  assert.strictEqual(mgr.setMode('compact'), true, 'Allows compact mode');
  assert.strictEqual(mgr.getMode(), 'compact', 'Reflects updated mode');

  assert.strictEqual(mgr.setMode('invalid_mode'), false, 'Rejects invalid mode');
  assert.strictEqual(mgr.getMode(), 'compact', 'Mode remains unchanged on invalid input');

  assert.strictEqual(mgr.setMode('cozy'), true, 'Allows cozy mode');
  assert.strictEqual(mgr.getMode(), 'cozy');
});
