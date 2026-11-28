const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Network status badge styles and controller exist', (t) => {
  const cssPath = path.join(__dirname, '..', 'assets', 'css', 'network-status-badge.css');
  const jsPath = path.join(__dirname, '..', 'assets', 'js', 'network-status-badge.js');

  assert.ok(fs.existsSync(cssPath), 'CSS file should exist');
  assert.ok(fs.existsSync(jsPath), 'JS file should exist');

  const css = fs.readFileSync(cssPath, 'utf8');
  assert.ok(css.includes('.network-status-badge.online'), 'Contains online state styling');
  assert.ok(css.includes('.network-status-badge.offline'), 'Contains offline state styling');
});

test('NetworkStatusManager correctly tracks online status and relative timestamps', (t) => {
  const { NetworkStatusManager } = require('../assets/js/network-status-badge.js');
  const mgr = new NetworkStatusManager();

  assert.strictEqual(typeof mgr.getStatus().online, 'boolean');
  assert.strictEqual(mgr.formatRelativeTime(Date.now() - 10000), 'just now');
  assert.strictEqual(mgr.formatRelativeTime(Date.now() - 120000), '2m ago');

  mgr.updateState(false);
  assert.strictEqual(mgr.getStatus().online, false);
  assert.strictEqual(mgr.getStatus().label, 'Offline (Cached)');

  mgr.updateState(true);
  assert.strictEqual(mgr.getStatus().online, true);
  assert.strictEqual(mgr.getStatus().label, 'Online');
});
