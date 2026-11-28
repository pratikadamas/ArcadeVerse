const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Modal Quick-Restart files exist and are populated', (t) => {
  const cssPath = path.join(__dirname, '..', 'assets', 'css', 'modal-quick-restart.css');
  const jsPath = path.join(__dirname, '..', 'assets', 'js', 'modal-quick-restart.js');

  assert.ok(fs.existsSync(cssPath), 'CSS file should exist');
  assert.ok(fs.existsSync(jsPath), 'JS file should exist');

  const css = fs.readFileSync(cssPath, 'utf8');
  assert.ok(css.includes('.modal-quick-restart-btn'), 'Contains restart button style');
  assert.ok(css.includes('.restart-toast-notification'), 'Contains toast style');
});

test('ModalQuickRestartManager enforces debouncing protection', (t) => {
  const { ModalQuickRestartManager } = require('../assets/js/modal-quick-restart.js');
  const mgr = new ModalQuickRestartManager({ debounceMs: 200 });

  assert.strictEqual(mgr.canRestart(), true, 'First restart is permitted');
  assert.strictEqual(mgr.canRestart(), false, 'Immediate second restart is debounced');

  const res = mgr.restartActiveGame();
  assert.strictEqual(res, false, 'Debounced restart returns false');
});
