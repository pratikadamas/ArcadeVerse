const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Focus Action Prompt Bar files exist and are valid', (t) => {
  const cssPath = path.join(__dirname, '..', 'assets', 'css', 'focus-action-prompt.css');
  const jsPath = path.join(__dirname, '..', 'assets', 'js', 'focus-action-prompt.js');

  assert.ok(fs.existsSync(cssPath), 'CSS file should exist');
  assert.ok(fs.existsSync(jsPath), 'JS file should exist');

  const css = fs.readFileSync(cssPath, 'utf8');
  assert.ok(css.includes('.focus-action-prompt-bar'), 'Includes container styling');
  assert.ok(css.includes('.prompt-key-badge'), 'Includes keyboard badge styling');
});

test('FocusActionPromptBar instance exposes core methods', (t) => {
  const { FocusActionPromptBar } = require('../assets/js/focus-action-prompt.js');
  const bar = new FocusActionPromptBar();

  assert.ok(typeof bar.show === 'function', 'show method exists');
  assert.ok(typeof bar.hide === 'function', 'hide method exists');
  assert.ok(typeof bar.handleFocusIn === 'function', 'handleFocusIn method exists');
  assert.ok(typeof bar.handleFocusOut === 'function', 'handleFocusOut method exists');
});
