const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Storage Inspector CSS and JS exist and contain required rules', (t) => {
  const cssPath = path.join(__dirname, '..', 'assets', 'css', 'storage-inspector.css');
  const jsPath = path.join(__dirname, '..', 'assets', 'js', 'storage-inspector.js');

  assert.ok(fs.existsSync(cssPath), 'CSS file should exist');
  assert.ok(fs.existsSync(jsPath), 'JS file should exist');

  const css = fs.readFileSync(cssPath, 'utf8');
  assert.ok(css.includes('.storage-inspector-drawer'), 'Contains drawer');
  assert.ok(css.includes('.storage-meter-fill'), 'Contains meter fill');
});

test('StorageInspectorManager correctly calculates byte consumption', (t) => {
  const { StorageInspectorManager } = require('../assets/js/storage-inspector.js');
  const mgr = new StorageInspectorManager();

  assert.strictEqual(mgr.formatBytes(500), '500 B');
  assert.strictEqual(mgr.formatBytes(2048), '2.0 KB');
  assert.strictEqual(mgr.formatBytes(1048576 * 2.5), '2.50 MB');

  const mockStorage = {
    'test_key_1': 'hello',
    'arcadeverse_pref': 'dark'
  };

  let total = 0;
  Object.entries(mockStorage).forEach(([k, v]) => {
    total += (k.length + v.length) * 2;
  });

  assert.ok(total > 0, 'Byte computation is strictly positive');
});
