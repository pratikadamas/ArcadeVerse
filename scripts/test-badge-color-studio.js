/**
 * Automated Unit Test Suite for ArcadeBadgeColorStudio
 * Issue #1503 - Customizable Game Category Badge Color Accent Studio in User Settings
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

const badgeStudio = require('../assets/js/badge-color-studio.js');

function createMockRootElement() {
  const props = {};
  return {
    props,
    style: {
      setProperty: (k, v) => { props[k] = v; }
    }
  };
}

test('ArcadeBadgeColorStudio exports required API methods, presets, and categories', () => {
  assert.equal(badgeStudio.STORAGE_KEY, 'arcadeverse_category_colors');
  assert.ok(Array.isArray(badgeStudio.CATEGORIES));
  assert.ok(badgeStudio.PRESETS['classic-neon']);
  assert.ok(badgeStudio.PRESETS['pastel-synth']);
  assert.ok(badgeStudio.PRESETS['high-contrast']);
  assert.ok(badgeStudio.PRESETS['monochrome']);
  assert.equal(typeof badgeStudio.applyColors, 'function');
  assert.equal(typeof badgeStudio.applyPreset, 'function');
  assert.equal(typeof badgeStudio.setCategoryColor, 'function');
  assert.equal(typeof badgeStudio.resetToDefault, 'function');
});

test('applyColors injects --category-* CSS variables onto root element', () => {
  const mockRoot = createMockRootElement();
  const ok = badgeStudio.applyColors(badgeStudio.DEFAULT_COLORS, mockRoot);

  assert.equal(ok, true);
  assert.equal(mockRoot.props['--category-action'], '#f43f5e');
  assert.equal(mockRoot.props['--category-puzzle'], '#a855f7');
  assert.equal(mockRoot.props['--category-arcade'], '#22d3ee');
  assert.equal(mockRoot.props['--category-strategy'], '#f59e0b');
  assert.equal(mockRoot.props['--category-retro'], '#10b981');
});

test('applyPreset updates CSS variables, persists to localStorage, and supports high-contrast', () => {
  global.localStorage.clear();
  const mockRoot = createMockRootElement();

  const ok = badgeStudio.applyPreset('high-contrast', mockRoot);
  assert.equal(ok, true);
  assert.equal(badgeStudio.getActivePreset(), 'high-contrast');
  assert.equal(mockRoot.props['--category-arcade'], '#00f0ff');

  const saved = JSON.parse(global.localStorage.getItem('arcadeverse_category_colors'));
  assert.equal(saved.preset, 'high-contrast');
  assert.equal(saved.colors.arcade, '#00f0ff');
});

test('setCategoryColor and resetToDefault persist and restore defaults cleanly', () => {
  global.localStorage.clear();
  const mockRoot = createMockRootElement();

  assert.equal(badgeStudio.setCategoryColor('action', '#112233', mockRoot), true);
  assert.equal(mockRoot.props['--category-action'], '#112233');
  assert.equal(badgeStudio.getColors().action, '#112233');

  // Invalid hex should be rejected
  assert.equal(badgeStudio.setCategoryColor('action', 'not-a-hex', mockRoot), false);

  badgeStudio.resetToDefault(mockRoot);
  assert.equal(mockRoot.props['--category-action'], badgeStudio.DEFAULT_COLORS.action);
  assert.equal(global.localStorage.getItem('arcadeverse_category_colors'), null);
});

test('Ensures zero Unicode emojis across all badge-color-studio files', () => {
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/u;

  const filesToCheck = [
    'assets/js/badge-color-studio.js',
    'assets/css/badge-color-studio.css',
    'scripts/test-badge-color-studio.js'
  ];

  for (const relPath of filesToCheck) {
    const fullPath = path.join(__dirname, '..', relPath);
    const content = fs.readFileSync(fullPath, 'utf8');
    assert.equal(emojiRegex.test(content), false, `Found forbidden Unicode emoji in ${relPath}`);
  }
});
