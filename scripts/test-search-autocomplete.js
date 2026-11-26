/**
 * Automated Unit Test Suite for ArcadeSearchAutocomplete
 * Issue #1500 - Game Search Autocomplete Suggestion Dropdown with Keyboard Navigation
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ac = require('../assets/js/search-autocomplete.js');

const SAMPLE_REGISTRY = [
  { id: 'cyber-snake_babin', title: 'Cyber Snake', category: 'Arcade', tags: ['retro', 'snake'] },
  { id: 'cyber-chess_babin', title: 'Cyber Chess', category: 'Strategy', tags: ['board'] },
  { id: 'neon-cyber-racer_babin', title: 'Neon Cyber Racer', category: 'Action', tags: ['speed'] },
  { id: 'quantum-2048_babin', title: 'Quantum 2048', category: 'Puzzle', tags: ['math'] },
  { id: 'cyber-pong_babin', title: 'Cyber Pong', category: 'Retro', tags: ['paddle'] },
  { id: 'cyber-tetris_babin', title: 'Cyber Tetris', category: 'Puzzle', tags: ['blocks'] },
  { id: 'cyber-breakout_babin', title: 'Cyber Breakout', category: 'Arcade', tags: ['brick'] }
];

test('ArcadeSearchAutocomplete exports required API methods and constants', () => {
  assert.equal(ac.MIN_QUERY_LENGTH, 2);
  assert.equal(ac.MAX_SUGGESTIONS, 5);
  assert.equal(typeof ac.buildIndex, 'function');
  assert.equal(typeof ac.querySuggestions, 'function');
  assert.equal(typeof ac.highlightMatchHtml, 'function');
  assert.equal(typeof ac.cycleIndex, 'function');
  assert.equal(typeof ac.closeDropdown, 'function');
});

test('querySuggestions enforces minimum 2 characters, prefix ranking, and top-5 cap', () => {
  const index = ac.buildIndex(SAMPLE_REGISTRY);

  // < 2 characters -> empty suggestions
  assert.deepEqual(ac.querySuggestions('c', index), []);
  assert.deepEqual(ac.querySuggestions(' ', index), []);

  // Prefix matches ('Cyber ...') rank ahead of substring ('Neon Cyber Racer') and cap at 5
  const results = ac.querySuggestions('cyb', index, 5);
  assert.equal(results.length, 5);
  assert.ok(results[0].title.startsWith('Cyber'));

  // Tag match ('math' -> Quantum 2048)
  const tagResults = ac.querySuggestions('math', index, 5);
  assert.equal(tagResults.length, 1);
  assert.equal(tagResults[0].id, 'quantum-2048_babin');
});

test('highlightMatchHtml wraps matched substring and escapes HTML safely', () => {
  const highlighted = ac.highlightMatchHtml('Cyber Snake', 'snak');
  assert.equal(highlighted, 'Cyber <strong class="search-ac-match">Snak</strong>e');

  const xssSafe = ac.highlightMatchHtml('<script>alert(1)</script>', 'script');
  assert.ok(!xssSafe.includes('<script>'));
  assert.ok(xssSafe.includes('&lt;'));
});

test('cycleIndex cycles ArrowDown and ArrowUp indices cleanly', () => {
  assert.equal(ac.cycleIndex(-1, 1, 5), 0);
  assert.equal(ac.cycleIndex(0, 1, 5), 1);
  assert.equal(ac.cycleIndex(4, 1, 5), 0); // Wrap around

  assert.equal(ac.cycleIndex(-1, -1, 5), 4);
  assert.equal(ac.cycleIndex(0, -1, 5), 4); // Wrap backward
  assert.equal(ac.cycleIndex(2, -1, 5), 1);
});

test('closeDropdown resets open state and selectedIndex', () => {
  ac.closeDropdown();
  const state = ac.getState();
  assert.equal(state.isOpen, false);
  assert.equal(state.selectedIndex, -1);
});

test('Ensures zero Unicode emojis across all search-autocomplete files', () => {
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/u;

  const filesToCheck = [
    'assets/js/search-autocomplete.js',
    'assets/css/search-autocomplete.css',
    'scripts/test-search-autocomplete.js'
  ];

  for (const relPath of filesToCheck) {
    const fullPath = path.join(__dirname, '..', relPath);
    const content = fs.readFileSync(fullPath, 'utf8');
    assert.equal(emojiRegex.test(content), false, `Found forbidden Unicode emoji in ${relPath}`);
  }
});
