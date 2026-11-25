/**
 * Automated Unit Test Suite for ArcadeReducedMotion
 * Issue #1507 - Reduced Motion Mode Overrides for UI Shimmers and Transitions
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

const reducedMotion = require('../assets/js/reduced-motion-toggle.js');

test('ArcadeReducedMotion exports all required API methods and constants', () => {
  assert.equal(reducedMotion.STORAGE_KEY, 'arcadeverse_reduced_motion');
  assert.equal(reducedMotion.BODY_CLASS, 'arcade-reduced-motion');
  assert.equal(typeof reducedMotion.detectSystemPreference, 'function');
  assert.equal(typeof reducedMotion.loadPreference, 'function');
  assert.equal(typeof reducedMotion.applyClass, 'function');
  assert.equal(typeof reducedMotion.setEnabled, 'function');
  assert.equal(typeof reducedMotion.toggle, 'function');
  assert.equal(typeof reducedMotion.isEnabled, 'function');
});

test('detectSystemPreference reads prefers-reduced-motion media query accurately', () => {
  const fakeWinReduce = {
    matchMedia: (q) => ({ matches: q === '(prefers-reduced-motion: reduce)' })
  };
  const fakeWinNormal = {
    matchMedia: () => ({ matches: false })
  };

  assert.equal(reducedMotion.detectSystemPreference(fakeWinReduce), true);
  assert.equal(reducedMotion.detectSystemPreference(fakeWinNormal), false);
});

test('loadPreference respects manual localStorage override over OS preference', () => {
  global.localStorage.clear();

  const fakeWinReduce = { matchMedia: () => ({ matches: true }) };
  // No manual override -> auto-detects OS reduce=true
  assert.equal(reducedMotion.loadPreference(fakeWinReduce), true);

  // Explicit manual override to false -> overrides OS reduce=true
  reducedMotion.setEnabled(false);
  assert.equal(global.localStorage.getItem('arcadeverse_reduced_motion'), 'false');
  assert.equal(reducedMotion.loadPreference(fakeWinReduce), false);

  // Explicit manual override to true -> persists across reload
  reducedMotion.setEnabled(true);
  assert.equal(global.localStorage.getItem('arcadeverse_reduced_motion'), 'true');
  assert.equal(reducedMotion.isEnabled(), true);
});

test('applyClass toggles .arcade-reduced-motion on document.body', () => {
  const bodyClasses = new Set();
  const rootClasses = new Set();
  global.document = {
    body: {
      classList: {
        toggle: (cls, force) => (force ? bodyClasses.add(cls) : bodyClasses.delete(cls))
      }
    },
    documentElement: {
      classList: {
        toggle: (cls, force) => (force ? rootClasses.add(cls) : rootClasses.delete(cls))
      }
    },
    getElementById: () => null
  };

  reducedMotion.setEnabled(true);
  assert.equal(bodyClasses.has('arcade-reduced-motion'), true);
  assert.equal(rootClasses.has('a11y-reduced-motion'), true);

  reducedMotion.toggle();
  assert.equal(reducedMotion.isEnabled(), false);
  assert.equal(bodyClasses.has('arcade-reduced-motion'), false);

  delete global.document;
});

test('CSS stylesheet defines .arcade-reduced-motion overrides for animations and transitions', () => {
  const css = fs.readFileSync(path.join(__dirname, '../assets/css/reduced-motion-toggle.css'), 'utf8');
  assert.ok(css.includes('body.arcade-reduced-motion'));
  assert.ok(css.includes('animation-duration: 0.001ms !important'));
  assert.ok(css.includes('transition-property: opacity'));
});

test('Ensures zero Unicode emojis across all reduced-motion files', () => {
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/u;

  const filesToCheck = [
    'assets/js/reduced-motion-toggle.js',
    'assets/css/reduced-motion-toggle.css',
    'scripts/test-reduced-motion-toggle.js'
  ];

  for (const relPath of filesToCheck) {
    const fullPath = path.join(__dirname, '..', relPath);
    const content = fs.readFileSync(fullPath, 'utf8');
    assert.equal(emojiRegex.test(content), false, `Found forbidden Unicode emoji in ${relPath}`);
  }
});
