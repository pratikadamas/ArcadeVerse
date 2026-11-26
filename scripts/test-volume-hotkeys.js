/**
 * Automated Unit Test Suite for ArcadeVolumeHotkeys
 * Issue #1496 - Master Volume Keyboard Hotkeys HUD Overlay with Instant Visual Feedback
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

function createMockStorage() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => { store.clear(); }
  };
}

global.localStorage = createMockStorage();

const volumeHotkeys = require('../assets/js/volume-hotkeys.js');

test('ArcadeVolumeHotkeys exports required API methods and constants', () => {
  assert.equal(volumeHotkeys.VOLUME_KEY, 'arcadeverse_master_volume');
  assert.equal(volumeHotkeys.STEP_PERCENT, 5);
  assert.equal(volumeHotkeys.HUD_TIMEOUT_MS, 1500);
  assert.equal(typeof volumeHotkeys.setVolumePercent, 'function');
  assert.equal(typeof volumeHotkeys.adjustVolume, 'function');
  assert.equal(typeof volumeHotkeys.toggleMute, 'function');
  assert.equal(typeof volumeHotkeys.handleKeyDown, 'function');
});

test('handleKeyDown adjusts volume by +/-5%, clamps [0, 100], and toggles mute', () => {
  global.localStorage.clear();
  volumeHotkeys.setVolumePercent(50, false);

  // ']' -> +5%
  assert.equal(volumeHotkeys.handleKeyDown({ key: ']', preventDefault: () => {} }), true);
  assert.equal(volumeHotkeys.getState().volumePercent, 55);

  // Ctrl+ArrowUp -> +5%
  assert.equal(volumeHotkeys.handleKeyDown({ key: 'ArrowUp', ctrlKey: true, preventDefault: () => {} }), true);
  assert.equal(volumeHotkeys.getState().volumePercent, 60);

  // '[' -> -5%
  assert.equal(volumeHotkeys.handleKeyDown({ key: '[', preventDefault: () => {} }), true);
  assert.equal(volumeHotkeys.getState().volumePercent, 55);

  // Ctrl+ArrowDown -> -5%
  assert.equal(volumeHotkeys.handleKeyDown({ key: 'ArrowDown', ctrlKey: true, preventDefault: () => {} }), true);
  assert.equal(volumeHotkeys.getState().volumePercent, 50);

  // Boundary clamping
  volumeHotkeys.setVolumePercent(120, false);
  assert.equal(volumeHotkeys.getState().volumePercent, 100);
  volumeHotkeys.setVolumePercent(-15, false);
  assert.equal(volumeHotkeys.getState().volumePercent, 0);

  // 'M' toggles mute
  volumeHotkeys.setVolumePercent(40, false);
  assert.equal(volumeHotkeys.handleKeyDown({ key: 'm', preventDefault: () => {} }), true);
  assert.equal(volumeHotkeys.getState().muted, true);
  assert.equal(volumeHotkeys.handleKeyDown({ key: 'M', preventDefault: () => {} }), true);
  assert.equal(volumeHotkeys.getState().muted, false);

  // Ignores events inside text inputs
  assert.equal(volumeHotkeys.handleKeyDown({ key: 'm', target: { tagName: 'INPUT' } }), false);
  assert.equal(volumeHotkeys.getState().muted, false);

  // Persists volume to localStorage
  assert.equal(global.localStorage.getItem('arcadeverse_master_volume'), '0.4');

  volumeHotkeys.hideHud();
});

test('showHud sets visible state and auto-hides after timeout', async () => {
  volumeHotkeys.showHud(35);
  assert.equal(volumeHotkeys.getState().hudVisible, true);

  await new Promise((resolve) => setTimeout(resolve, 65));
  assert.equal(volumeHotkeys.getState().hudVisible, false);
});

test('Ensures zero Unicode emojis across all volume-hotkeys files', () => {
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/u;

  const filesToCheck = [
    'assets/js/volume-hotkeys.js',
    'assets/css/volume-hotkeys.css',
    'scripts/test-volume-hotkeys.js'
  ];

  for (const relPath of filesToCheck) {
    const fullPath = path.join(__dirname, '..', relPath);
    const content = fs.readFileSync(fullPath, 'utf8');
    assert.equal(emojiRegex.test(content), false, `Found forbidden Unicode emoji in ${relPath}`);
  }
});
