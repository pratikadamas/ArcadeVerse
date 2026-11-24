const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ContributorComparisonManager } = require('../assets/js/contributor-compare.js');

test('ContributorComparisonManager handles 2-contributor selection and renders stats bars', () => {
    const mgr = new ContributorComparisonManager();

    const devA = { username: 'alice', name: 'Alice Dev', points: 1200, games: 4, commits: 15, badges: 3, categories: ['Arcade', 'Retro'] };
    const devB = { username: 'bob', name: 'Bob Codes', points: 850, games: 2, commits: 8, badges: 5, categories: ['Retro', 'Puzzle'] };

    assert.equal(mgr.canCompare(), false);

    mgr.selectContributor(devA);
    assert.equal(mgr.canCompare(), false);

    mgr.selectContributor(devB);
    assert.equal(mgr.canCompare(), true);

    const shared = mgr.calculateSharedCategories(devA, devB);
    assert.deepEqual(shared, ['Retro']);

    const modalHtml = mgr.renderComparisonModal();
    assert.ok(modalHtml.includes('versus-modal-card'), 'Contains versus modal markup');
    assert.ok(modalHtml.includes('Alice Dev') && modalHtml.includes('Bob Codes'), 'Displays both developers');
    assert.ok(modalHtml.includes('Arcade Points') && modalHtml.includes('1200'), 'Renders points stats');
    assert.ok(modalHtml.includes('Retro'), 'Renders shared category badge');
});

test('contributor-compare.css defines side-by-side versus layout and animated stat bars', () => {
    const cssPath = path.resolve(__dirname, '../assets/css/contributor-compare.css');
    assert.ok(fs.existsSync(cssPath), 'contributor-compare.css must exist');

    const css = fs.readFileSync(cssPath, 'utf8');
    assert.match(css, /\.versus-modal-overlay/, 'Styles modal overlay');
    assert.match(css, /\.versus-fighters/, 'Styles fighters row');
    assert.match(css, /\.left-fill/, 'Defines left dev stat bar fill');
    assert.match(css, /\.right-fill/, 'Defines right dev stat bar fill');
});
