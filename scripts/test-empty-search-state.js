const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { EmptySearchManager } = require('../assets/js/empty-search-state.js');

const mockRegistry = [
    { id: 'cyber-snake', title: 'Cyber Snake', genre: 'Retro' },
    { id: 'galaxy-invaders', title: 'Galaxy Invaders', genre: 'Arcade' },
    { id: 'pacman-classic', title: 'Pac-Man Neon', genre: 'Maze' },
    { id: 'space-blast', title: 'Space Blast 2084', genre: 'Shooter' }
];

test('EmptySearchManager calculates Levenshtein distance and suggests closest game', () => {
    const manager = new EmptySearchManager(mockRegistry);

    assert.equal(manager.levenshtein('kitten', 'sitting'), 3);
    assert.equal(manager.levenshtein('Cyber', 'Cyber'), 0);

    // Typo in Cyber Snake
    const suggestion1 = manager.findDidYouMean('Cybr Snak');
    assert.equal(suggestion1, 'Cyber Snake', 'Correctly matches Cyber Snake');

    // Typo in Galaxy Invaders
    const suggestion2 = manager.findDidYouMean('Galaxi');
    assert.equal(suggestion2, 'Galaxy Invaders', 'Correctly matches Galaxy Invaders');

    // Unrelated query
    const suggestion3 = manager.findDidYouMean('zzzzzxyz');
    assert.equal(suggestion3, null, 'No suggestion for distant query');
});

test('EmptySearchManager renders accessible HTML empty state container', () => {
    const manager = new EmptySearchManager(mockRegistry);
    const html = manager.generateEmptyStateHtml('Cybr Snak');

    assert.ok(html.includes('empty-search-container'), 'Contains container class');
    assert.ok(html.includes('Did you mean:'), 'Renders Did-You-Mean suggestion block');
    assert.ok(html.includes('Cyber Snake'), 'Displays suggested game title');
    assert.ok(html.includes('Play Random Game'), 'Contains random game button');
});

test('empty-search-state.css contains retro empty state styles and responsive rules', () => {
    const cssPath = path.resolve(__dirname, '../assets/css/empty-search-state.css');
    assert.ok(fs.existsSync(cssPath), 'empty-search-state.css must exist');

    const css = fs.readFileSync(cssPath, 'utf8');
    assert.match(css, /\.empty-search-container/, 'Styles empty search container');
    assert.match(css, /\.empty-action-random/, 'Styles random game action');
    assert.match(css, /\.suggestion-link/, 'Styles suggestion clickable link');
});
