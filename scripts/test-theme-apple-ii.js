const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('theme-apple-ii.css contains authentic Apple II color palette and CRT rules', () => {
    const cssPath = path.resolve(__dirname, '../assets/css/theme-apple-ii.css');
    assert.ok(fs.existsSync(cssPath), 'theme-apple-ii.css must exist');

    const cssContent = fs.readFileSync(cssPath, 'utf8');

    // Verify key color palette tokens
    assert.match(cssContent, /--apple-black:\s*#000000;/, 'Defines black base');
    assert.match(cssContent, /--apple-green:\s*#11c638;/, 'Defines authentic NTSC green');
    assert.match(cssContent, /--apple-violet:\s*#8e1ae2;/, 'Defines authentic NTSC violet');
    assert.match(cssContent, /--apple-orange:\s*#d35400;/, 'Defines authentic NTSC orange');
    assert.match(cssContent, /--apple-blue:\s*#2277ee;/, 'Defines authentic NTSC blue');

    // Verify CRT and scanline effects
    assert.match(cssContent, /data-theme="apple-ii"/, 'Contains apple-ii data-theme selector');
    assert.match(cssContent, /repeating-linear-gradient/, 'Contains CRT scanline effect');
    assert.match(cssContent, /apple-scanlines/, 'Contains scanline animation or class');
    assert.match(cssContent, /apple-chroma-bleed/, 'Contains horizontal chroma bleed artifact simulation');
    assert.match(cssContent, /@media\s*\(prefers-reduced-motion:\s*reduce\)/, 'Supports prefers-reduced-motion accessibility');
});
