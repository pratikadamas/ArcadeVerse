/**
 * Automated Unit Test Suite for ArcadeCatalogViewToggle
 * Issue #1501 - Compact Table List View Mode Toggle for High-Density Game Catalog
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

const viewToggle = require('../assets/js/catalog-view-toggle.js');

function createMockClassList() {
  const set = new Set();
  return {
    contains: (c) => set.has(c),
    toggle: (c, force) => {
      if (force) set.add(c);
      else set.delete(c);
      return Boolean(force);
    }
  };
}

test('ArcadeCatalogViewToggle exports all required API methods and constants', () => {
  assert.equal(viewToggle.STORAGE_KEY, 'arcadeverse_catalog_view_mode');
  assert.equal(viewToggle.GRID_CLASS, 'catalog-grid-mode');
  assert.equal(viewToggle.LIST_CLASS, 'catalog-list-mode');
  assert.equal(typeof viewToggle.getViewMode, 'function');
  assert.equal(typeof viewToggle.setViewMode, 'function');
  assert.equal(typeof viewToggle.toggleViewMode, 'function');
  assert.equal(typeof viewToggle.applyViewClasses, 'function');
});

test('setViewMode toggles .catalog-grid-mode vs .catalog-list-mode and persists to localStorage', () => {
  global.localStorage.clear();
  const mockContainer = { classList: createMockClassList() };

  // Switch to list mode
  const mode1 = viewToggle.setViewMode('list', { container: mockContainer, silent: true });
  assert.equal(mode1, 'list');
  assert.equal(viewToggle.getViewMode(), 'list');
  assert.equal(mockContainer.classList.contains('catalog-list-mode'), true);
  assert.equal(mockContainer.classList.contains('catalog-grid-mode'), false);
  assert.equal(global.localStorage.getItem('arcadeverse_catalog_view_mode'), 'list');
  assert.equal(viewToggle.loadViewMode(), 'list');

  // Toggle back to grid mode
  const mode2 = viewToggle.toggleViewMode({ container: mockContainer, silent: true });
  assert.equal(mode2, 'grid');
  assert.equal(mockContainer.classList.contains('catalog-grid-mode'), true);
  assert.equal(mockContainer.classList.contains('catalog-list-mode'), false);
  assert.equal(global.localStorage.getItem('arcadeverse_catalog_view_mode'), 'grid');
});

test('normalizeMode falls back cleanly to grid for invalid values', () => {
  assert.equal(viewToggle.normalizeMode('list'), 'list');
  assert.equal(viewToggle.normalizeMode('grid'), 'grid');
  assert.equal(viewToggle.normalizeMode('invalid'), 'grid');
  assert.equal(viewToggle.normalizeMode(null), 'grid');
});

test('CSS stylesheet defines .catalog-list-mode compact row layout', () => {
  const css = fs.readFileSync(path.join(__dirname, '../assets/css/catalog-view-toggle.css'), 'utf8');
  assert.ok(css.includes('#games-grid.catalog-list-mode'));
  assert.ok(css.includes('grid-template-columns'));
});

test('Ensures zero Unicode emojis across all catalog-view-toggle files', () => {
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/u;

  const filesToCheck = [
    'assets/js/catalog-view-toggle.js',
    'assets/css/catalog-view-toggle.css',
    'scripts/test-catalog-view-toggle.js'
  ];

  for (const relPath of filesToCheck) {
    const fullPath = path.join(__dirname, '..', relPath);
    const content = fs.readFileSync(fullPath, 'utf8');
    assert.equal(emojiRegex.test(content), false, `Found forbidden Unicode emoji in ${relPath}`);
  }
});
