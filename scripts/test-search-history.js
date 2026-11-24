const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { SearchHistoryManager } = require('../assets/js/search-history.js');

test('SearchHistoryManager saves, deduplicates, caps at 5 items, and clears', () => {
    let mockStore = {};
    global.localStorage = {
        getItem(k) { return mockStore[k] || null; },
        setItem(k, v) { mockStore[k] = String(v); },
        removeItem(k) { delete mockStore[k]; }
    };

    const mgr = new SearchHistoryManager({ storageKey: 'test_searches', maxItems: 5 });

    // Too short - ignored
    assert.equal(mgr.addQuery('ab'), false);
    assert.equal(mgr.getHistory().length, 0);

    // Valid additions
    mgr.addQuery('Cyber');
    mgr.addQuery('Snake');
    mgr.addQuery('Galaga');
    mgr.addQuery('Tetris');
    mgr.addQuery('Pacman');
    mgr.addQuery('Asteroids'); // Should pop Cyber to keep exactly 5

    const history = mgr.getHistory();
    assert.equal(history.length, 5, 'Should hold at most 5 recent queries');
    assert.equal(history[0], 'Asteroids', 'Newest query is first');
    assert.equal(history.includes('Cyber'), false, 'Oldest item was evicted');

    // Deduplication test
    mgr.addQuery('snake'); // case-insensitive deduplication
    assert.equal(mgr.getHistory()[0], 'snake', 'Deduplicated query moves to front');
    assert.equal(mgr.getHistory().filter(x => x.toLowerCase() === 'snake').length, 1);

    // Clear
    mgr.clearHistory();
    assert.equal(mgr.getHistory().length, 0, 'Clear removes all entries');
});

test('search-history.css defines styling for recent chips bar', () => {
    const cssPath = path.resolve(__dirname, '../assets/css/search-history.css');
    assert.ok(fs.existsSync(cssPath), 'search-history.css must exist');

    const css = fs.readFileSync(cssPath, 'utf8');
    assert.match(css, /\.recent-searches-bar/, 'Styles search history row');
    assert.match(css, /\.recent-search-pill/, 'Styles interactive search chip');
    assert.match(css, /\.recent-clear-btn/, 'Styles clear history action');
});
