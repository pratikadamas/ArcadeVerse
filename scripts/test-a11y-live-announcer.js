/**
 * Automated Unit Test Suite for ArcadeAnnouncer (Live Region Announcer)
 * Issue #1499 - Screen Reader Live Region Announcer for Dynamic Catalog Filter Counts
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const announcer = require('../assets/js/a11y-live-announcer.js');

function createMockDocument() {
  const attrs = {};
  const createdEl = {
    id: '',
    className: '',
    textContent: '',
    setAttribute: (k, v) => { attrs[k] = String(v); },
    getAttribute: (k) => attrs[k] || null
  };
  let appended = false;

  return {
    createdEl,
    attrs,
    wasAppended: () => appended,
    getElementById: (id) => (appended && createdEl.id === id ? createdEl : null),
    createElement: () => createdEl,
    body: {
      appendChild: (el) => { appended = true; return el; }
    }
  };
}

test('ArcadeAnnouncer exports all required API methods and constants', () => {
  assert.equal(announcer.REGION_ID, 'a11y-live-announcer');
  assert.equal(announcer.DEBOUNCE_MS, 350);
  assert.equal(typeof announcer.ensureLiveRegion, 'function');
  assert.equal(typeof announcer.speak, 'function');
  assert.equal(typeof announcer.formatCatalogMessage, 'function');
  assert.equal(typeof announcer.announceCatalogUpdate, 'function');
});

test('formatCatalogMessage formats query, category, pluralization, and empty results accurately', () => {
  assert.equal(
    announcer.formatCatalogMessage('Retro', 12, { category: 'Action' }),
    "Found 12 games matching 'Retro' in 'Action' category."
  );

  assert.equal(
    announcer.formatCatalogMessage('Snake', 1, { category: 'all' }),
    "Found 1 game matching 'Snake'."
  );

  assert.equal(
    announcer.formatCatalogMessage('XYZ', 0, {}),
    "No games found matching 'XYZ'. Suggestions are available below."
  );

  assert.equal(
    announcer.formatCatalogMessage('', 130, { category: 'all' }),
    'Showing all 130 games in catalog.'
  );
});

test('ensureLiveRegion and speak inject persistent aria-live DOM region and update text', () => {
  const mockDoc = createMockDocument();
  const region = announcer.ensureLiveRegion(mockDoc);

  assert.ok(region);
  assert.equal(mockDoc.wasAppended(), true);
  assert.equal(mockDoc.attrs['aria-live'], 'polite');
  assert.equal(mockDoc.attrs['aria-atomic'], 'true');
  assert.ok(region.className.includes('sr-only'));

  announcer.speak('Filter updated', 'assertive', mockDoc);
  assert.equal(mockDoc.attrs['aria-live'], 'assertive');
  assert.equal(region.textContent, 'Filter updated');
});

test('announceCatalogUpdate debounces rapid calls cleanly', async () => {
  const mockDoc = createMockDocument();
  announcer.ensureLiveRegion(mockDoc);

  announcer.announceCatalogUpdate('cy', 40, {}, { delayMs: 25, doc: mockDoc });
  announcer.announceCatalogUpdate('cyb', 15, {}, { delayMs: 25, doc: mockDoc });
  announcer.announceCatalogUpdate('cyber', 8, {}, { delayMs: 25, doc: mockDoc });

  // Immediately after scheduling, debounce has not fired yet
  assert.equal(mockDoc.createdEl.textContent, '');

  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(mockDoc.createdEl.textContent, "Found 8 games matching 'cyber'.");
});

test('Ensures zero Unicode emojis across all a11y-live-announcer files', () => {
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/u;

  const filesToCheck = [
    'assets/js/a11y-live-announcer.js',
    'assets/css/a11y-live-announcer.css',
    'scripts/test-a11y-live-announcer.js'
  ];

  for (const relPath of filesToCheck) {
    const fullPath = path.join(__dirname, '..', relPath);
    const content = fs.readFileSync(fullPath, 'utf8');
    assert.equal(emojiRegex.test(content), false, `Found forbidden Unicode emoji in ${relPath}`);
  }
});
