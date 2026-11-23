const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('theme-virtual-boy.css enforces authentic dual-tone red and obsidian palette', () => {
    const cssPath = path.resolve(__dirname, '../assets/css/theme-virtual-boy.css');
    assert.ok(fs.existsSync(cssPath), 'theme-virtual-boy.css must exist');

    const cssContent = fs.readFileSync(cssPath, 'utf8');

    // Verify 4-tier red LED palette variables
    assert.match(cssContent, /--vb-black:\s*#000000;/, 'Defines pure obsidian base');
    assert.match(cssContent, /--vb-dark-red:\s*#550000;/, 'Defines dark red tier');
    assert.match(cssContent, /--vb-medium-red:\s*#aa0000;/, 'Defines medium red tier');
    assert.match(cssContent, /--vb-bright-red:\s*#ff0000;/, 'Defines full crimson LED tier');

    // Verify UI components and selectors
    assert.match(cssContent, /data-theme="virtual-boy"/, 'Supports virtual-boy data-theme selector');
    assert.match(cssContent, /\.game-card/, 'Applies styling to game cards');
    assert.match(cssContent, /\.btn\.btn-primary/, 'Applies monochromatic primary button styling');
    assert.match(cssContent, /@media\s*\(prefers-reduced-motion:\s*reduce\)/, 'Honors prefers-reduced-motion media query');
});
