const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('focus-ring.css defines WCAG 2.4.7 focus-visible system with soft blur glow and click suppression', () => {
    const cssPath = path.resolve(__dirname, '../assets/css/focus-ring.css');
    assert.ok(fs.existsSync(cssPath), 'focus-ring.css must exist');

    const css = fs.readFileSync(cssPath, 'utf8');

    // Click suppression
    assert.match(css, /:focus:not\(:focus-visible\)/, 'Suppresses outlines on mouse clicks');
    assert.match(css, /outline:\s*none\s*!important/, 'Removes harsh mouse outlines');

    // Focus visible indicator
    assert.match(css, /:focus-visible/, 'Defines global focus-visible rule');
    assert.match(css, /outline:\s*3px solid\s*#00f0ff/, 'Uses 3px neon cyan outline');
    assert.match(css, /outline-offset:\s*3px/, 'Applies 3px outline offset');
    assert.match(css, /box-shadow:\s*0 0 12px/, 'Applies glowing soft-blur box shadow');

    // Card and input focus
    assert.match(css, /\.game-card:focus-visible/, 'Styles game card keyboard focus');
    assert.match(css, /\.search-bar:focus-visible/, 'Styles search bar focus');

    // Dual theme support
    assert.match(css, /\[data-theme="light"\]/, 'Contains light theme high-contrast rules');

    // Reduced motion
    assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/, 'Honors prefers-reduced-motion');
});
