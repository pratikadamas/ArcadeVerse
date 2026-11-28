const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { A11yFocusRingManager } = require('../assets/js/a11y-focus-ring.js');

test('A11yFocusRingManager updates settings, persists to localStorage, and updates DOM attributes', () => {
    let mockStorage = {};
    global.localStorage = {
        getItem: (k) => mockStorage[k] || null,
        setItem: (k, v) => { mockStorage[k] = String(v); }
    };

    const attributes = {};
    const classList = new Set();
    global.document = {
        documentElement: {
            setAttribute: (k, v) => { attributes[k] = v; },
            classList: {
                add: (c) => classList.add(c),
                remove: (c) => classList.delete(c),
                contains: (c) => classList.has(c)
            }
        },
        body: {
            classList: {
                add: () => {},
                remove: () => {}
            }
        }
    };

    const mgr = new A11yFocusRingManager();
    mgr.init();

    assert.equal(attributes['data-focus-width'], '3px');
    assert.equal(attributes['data-focus-preset'], 'cyber-cyan');
    assert.equal(classList.has('a11y-focus-pulse-enabled'), true);

    // Modify width
    assert.equal(mgr.setWidth('4px'), true);
    assert.equal(attributes['data-focus-width'], '4px');
    assert.ok(mockStorage['arcadeverse_focus_ring_pref'].includes('4px'));

    // Modify preset
    assert.equal(mgr.setPreset('neon-gold'), true);
    assert.equal(attributes['data-focus-preset'], 'neon-gold');
    assert.ok(mockStorage['arcadeverse_focus_ring_pref'].includes('neon-gold'));

    // Invalid parameters rejected
    assert.equal(mgr.setWidth('10px'), false);
    assert.equal(mgr.setPreset('invalid-color'), false);
});

test('a11y-focus-ring.css defines dual concentric outline and reduced motion rules', () => {
    const cssPath = path.resolve(__dirname, '../assets/css/a11y-focus-ring.css');
    assert.ok(fs.existsSync(cssPath), 'a11y-focus-ring.css must exist');

    const css = fs.readFileSync(cssPath, 'utf8');
    assert.match(css, /--a11y-focus-width/, 'Defines focus width variable');
    assert.match(css, /--a11y-focus-outer-color/, 'Defines outer neon glow variable');
    assert.match(css, /--a11y-focus-inner-color/, 'Defines inner high-contrast variable');
    assert.match(css, /\[data-focus-preset="neon-gold"\]/, 'Defines neon gold preset');
    assert.match(css, /\[data-focus-preset="cyber-cyan"\]/, 'Defines cyber cyan preset');
    assert.match(css, /\[data-focus-preset="high-vis-white"\]/, 'Defines high-vis white preset');
    assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/, 'Disables pulse under reduced motion');
});
