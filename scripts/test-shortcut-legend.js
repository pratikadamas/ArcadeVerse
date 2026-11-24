const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ShortcutLegendModal } = require('../assets/js/shortcut-legend.js');

test('ShortcutLegendModal registers hotkey categories and manages open/close state', () => {
    const legend = new ShortcutLegendModal();
    assert.ok(legend.categories.length >= 4, 'Has at least 4 categorized shortcut sections');

    const audioCat = legend.categories.find(c => c.name.includes('Audio'));
    assert.ok(audioCat, 'Contains audio controls group');

    assert.equal(legend.isOpen, false);
    legend.open();
    assert.equal(legend.isOpen, true);
    legend.close();
    assert.equal(legend.isOpen, false);
    legend.toggle();
    assert.equal(legend.isOpen, true);
});

test('shortcut-legend.css contains retro beveled keycaps and print media queries', () => {
    const cssPath = path.resolve(__dirname, '../assets/css/shortcut-legend.css');
    assert.ok(fs.existsSync(cssPath), 'shortcut-legend.css must exist');

    const css = fs.readFileSync(cssPath, 'utf8');
    assert.match(css, /\.retro-keycap/, 'Styles 3D retro keycap pills');
    assert.match(css, /box-shadow:\s*0 3px 0/, 'Uses 3D beveled box-shadow');
    assert.match(css, /@media print/, 'Contains printable cheat sheet rules');
    assert.match(css, /\.shortcut-legend-overlay/, 'Defines overlay modal positioning');
});
