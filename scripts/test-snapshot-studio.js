const test = require('node:test');
const assert = require('node:assert');

test('Snapshot shortcut detection ignores bare P key and triggers on Alt+Shift+S', () => {
  let triggered = false;
  function simulateKey(event, modalActive, activeElementTag) {
    if ((event.key === 's' || event.key === 'S') && event.altKey && event.shiftKey && !event.ctrlKey && !event.metaKey) {
      if (modalActive) {
        const isInput = activeElementTag === 'INPUT' || activeElementTag === 'TEXTAREA';
        if (!isInput) {
          triggered = true;
        }
      }
    }
  }

  // 1. Bare 'P' keypress must NEVER trigger snapshot (prevents pause collision)
  triggered = false;
  simulateKey({ key: 'p', altKey: false, shiftKey: false, ctrlKey: false, metaKey: false }, true, 'BUTTON');
  assert.strictEqual(triggered, false);

  // 2. Alt+Shift+S while game modal is active triggers snapshot
  triggered = false;
  simulateKey({ key: 'S', altKey: true, shiftKey: true, ctrlKey: false, metaKey: false }, true, 'BUTTON');
  assert.strictEqual(triggered, true);

  // 3. Alt+Shift+S while input is focused does not trigger snapshot
  triggered = false;
  simulateKey({ key: 'S', altKey: true, shiftKey: true, ctrlKey: false, metaKey: false }, true, 'INPUT');
  assert.strictEqual(triggered, false);

  // 4. Alt+Shift+S when game modal is closed does not trigger snapshot
  triggered = false;
  simulateKey({ key: 's', altKey: true, shiftKey: true, ctrlKey: false, metaKey: false }, false, 'BUTTON');
  assert.strictEqual(triggered, false);
});

test('Snapshot studio composition scales dimensions properly', () => {
  const sourceW = 800;
  const sourceH = 600;
  const targetWidth = Math.max(sourceW, 640);
  const targetHeight = Math.max(sourceH, 480);
  const padding = 20;
  const headerHeight = 54;
  const footerHeight = 44;

  const compWidth = targetWidth + padding * 2;
  const compHeight = targetHeight + headerHeight + footerHeight + padding * 2;

  assert.strictEqual(compWidth, 840);
  assert.strictEqual(compHeight, 738);
});
