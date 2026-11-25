/**
 * Automated Unit Test Suite for ArcadeModalFullscreen
 * Issue #1505 - Fullscreen Toggle Button with Interactive Animated Expand-Compress Icon
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const modalFs = require('../assets/js/modal-fullscreen.js');

function createMockClassList(initial = []) {
  const set = new Set(initial);
  return {
    add: (c) => set.add(c),
    remove: (c) => set.delete(c),
    contains: (c) => set.has(c),
    toggle: (c, force) => {
      if (force === undefined) {
        if (set.has(c)) { set.delete(c); return false; }
        set.add(c); return true;
      }
      if (force) set.add(c); else set.delete(c);
      return Boolean(force);
    }
  };
}

test('ArcadeModalFullscreen exports all required API methods', () => {
  assert.ok(modalFs.ANIMATED_SVG_HTML.includes('fs-expand-paths'));
  assert.ok(modalFs.ANIMATED_SVG_HTML.includes('fs-compress-paths'));
  assert.equal(typeof modalFs.isNativeSupported, 'function');
  assert.equal(typeof modalFs.isFullscreenActive, 'function');
  assert.equal(typeof modalFs.syncIconState, 'function');
  assert.equal(typeof modalFs.enterFullscreen, 'function');
  assert.equal(typeof modalFs.exitFullscreen, 'function');
  assert.equal(typeof modalFs.toggleFullscreen, 'function');
});

test('enterFullscreen and exitFullscreen invoke native Fullscreen API when supported', async () => {
  let requested = false;
  let exited = false;

  const mockDoc = {
    fullscreenElement: null,
    body: { classList: createMockClassList() },
    getElementById: () => ({ classList: createMockClassList() }),
    exitFullscreen: async () => {
      exited = true;
      mockDoc.fullscreenElement = null;
    }
  };

  const mockModalWindow = {
    classList: createMockClassList(),
    requestFullscreen: async () => {
      requested = true;
      mockDoc.fullscreenElement = mockModalWindow;
    }
  };

  const enterRes = await modalFs.enterFullscreen(mockModalWindow, mockDoc);
  assert.equal(requested, true);
  assert.equal(enterRes.mode, 'native');
  assert.equal(enterRes.active, true);
  assert.equal(modalFs.isFullscreenActive(mockModalWindow, mockDoc), true);

  const exitRes = await modalFs.exitFullscreen(mockModalWindow, mockDoc);
  assert.equal(exited, true);
  assert.equal(exitRes.active, false);
  assert.equal(modalFs.isFullscreenActive(mockModalWindow, mockDoc), false);
});

test('enterFullscreen falls back cleanly to CSS viewport fullscreen when native API is blocked', async () => {
  const mockDoc = {
    fullscreenElement: null,
    body: { classList: createMockClassList() },
    getElementById: () => ({ classList: createMockClassList() })
  };

  const blockedEl = {
    classList: createMockClassList(),
    requestFullscreen: async () => {
      throw new Error('Permissions policy blocked fullscreen');
    }
  };

  const res = await modalFs.enterFullscreen(blockedEl, mockDoc);
  assert.equal(res.mode, 'css');
  assert.equal(res.active, true);
  assert.equal(blockedEl.classList.contains('is-css-fullscreen'), true);
  assert.equal(mockDoc.body.classList.contains('modal-fullscreen-active'), true);
});

test('syncIconState updates aria-pressed, title, and is-fullscreen class', () => {
  const attrs = {};
  const mockBtn = {
    classList: createMockClassList(),
    setAttribute: (k, v) => { attrs[k] = v; }
  };

  modalFs.syncIconState(mockBtn, true);
  assert.equal(mockBtn.classList.contains('is-fullscreen'), true);
  assert.equal(attrs['aria-pressed'], 'true');
  assert.equal(attrs['title'], 'Exit Fullscreen');

  modalFs.syncIconState(mockBtn, false);
  assert.equal(mockBtn.classList.contains('is-fullscreen'), false);
  assert.equal(attrs['aria-pressed'], 'false');
  assert.equal(attrs['title'], 'Toggle Fullscreen');
});

test('Ensures zero Unicode emojis across all modal-fullscreen files', () => {
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/u;

  const filesToCheck = [
    'assets/js/modal-fullscreen.js',
    'assets/css/modal-fullscreen.css',
    'scripts/test-modal-fullscreen.js'
  ];

  for (const relPath of filesToCheck) {
    const fullPath = path.join(__dirname, '..', relPath);
    const content = fs.readFileSync(fullPath, 'utf8');
    assert.equal(emojiRegex.test(content), false, `Found forbidden Unicode emoji in ${relPath}`);
  }
});
