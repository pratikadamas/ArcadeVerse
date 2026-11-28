const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Pinned showcase styles and script exist', (t) => {
  const cssPath = path.join(__dirname, '..', 'assets', 'css', 'pinned-showcase.css');
  const jsPath = path.join(__dirname, '..', 'assets', 'js', 'pinned-showcase.js');

  assert.ok(fs.existsSync(cssPath), 'CSS file should exist');
  assert.ok(fs.existsSync(jsPath), 'JS file should exist');

  const css = fs.readFileSync(cssPath, 'utf8');
  assert.ok(css.includes('.pinned-showcase-tray'), 'Contains showcase tray');
  assert.ok(css.includes('.pin-toggle-btn.pinned'), 'Contains pinned button style');
});

test('PinnedShowcaseManager enforces pin toggle and limit constraints', (t) => {
  const { PinnedShowcaseManager } = require('../assets/js/pinned-showcase.js');
  const mgr = new PinnedShowcaseManager();

  mgr.pinnedIds = [];

  assert.strictEqual(mgr.togglePin('game-1'), true);
  assert.strictEqual(mgr.isPinned('game-1'), true);

  assert.strictEqual(mgr.togglePin('game-2'), true);
  assert.strictEqual(mgr.togglePin('game-3'), true);
  assert.strictEqual(mgr.getPinnedIds().length, 3);

  // Exceeds limit of 3
  const overflow = mgr.togglePin('game-4');
  assert.strictEqual(overflow, null);

  // Toggle existing pins off
  assert.strictEqual(mgr.togglePin('game-1'), false);
  assert.strictEqual(mgr.isPinned('game-1'), false);
  assert.strictEqual(mgr.getPinnedIds().length, 2);
});
