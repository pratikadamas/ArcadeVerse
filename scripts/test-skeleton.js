const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { SkeletonLoaderManager } = require('../assets/js/skeleton-loader.js');

test('SkeletonLoaderManager renders placeholder markup with proper aria tags', () => {
    const mockContainer = { innerHTML: '' };
    const loader = new SkeletonLoaderManager(mockContainer);

    const html = loader.renderPlaceholders(4);
    assert.ok(mockContainer.innerHTML.includes('skeleton-card'), 'Renders skeleton cards');
    assert.ok(mockContainer.innerHTML.includes('skeleton-thumbnail'), 'Renders skeleton thumbnail');
    assert.ok(mockContainer.innerHTML.includes('aria-hidden="true"'), 'Hides placeholders from screen readers');

    const cardCount = (mockContainer.innerHTML.match(/skeleton-card/g) || []).length;
    assert.equal(cardCount, 4, 'Renders exactly 4 cards as requested');

    loader.removePlaceholders();
    assert.equal(mockContainer.innerHTML, '', 'Clears placeholders cleanly');
});

test('skeleton.css contains GPU shimmer gradient and prefers-reduced-motion override', () => {
    const cssPath = path.resolve(__dirname, '../assets/css/skeleton.css');
    assert.ok(fs.existsSync(cssPath), 'skeleton.css must exist');

    const css = fs.readFileSync(cssPath, 'utf8');
    assert.match(css, /\.skeleton-shimmer/, 'Defines shimmer class');
    assert.match(css, /@keyframes skeletonShimmerWave/, 'Defines wave animation');
    assert.match(css, /linear-gradient\(\s*90deg,/, 'Uses GPU linear gradient');
    assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/, 'Disables animation under prefers-reduced-motion');
});
