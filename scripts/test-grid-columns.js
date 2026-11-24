const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { GridColumnsManager } = require('../assets/js/grid-columns.js');

test('GridColumnsManager updates column counts, custom properties, and localStorage', () => {
    let mockStore = {};
    global.localStorage = {
        getItem(k) { return mockStore[k] || null; },
        setItem(k, v) { mockStore[k] = String(v); }
    };

    let rootStyle = {};
    let rootAttr = {};
    global.document = {
        documentElement: {
            style: {
                setProperty(k, v) { rootStyle[k] = v; }
            },
            setAttribute(k, v) { rootAttr[k] = v; }
        }
    };

    const mgr = new GridColumnsManager();
    mgr.init();

    assert.equal(mgr.currentColumns, 3);
    assert.equal(rootStyle['--catalog-col-count'], '3');

    // Switch to 4 columns
    mgr.setColumns(4);
    assert.equal(mgr.currentColumns, 4);
    assert.equal(rootStyle['--catalog-col-count'], '4');
    assert.equal(mockStore['av_catalog_columns'], '4');

    // Switch to 2 columns
    mgr.setColumns(2);
    assert.equal(mgr.currentColumns, 2);
    assert.equal(rootStyle['--catalog-col-count'], '2');

    // Invalid column count rejected
    assert.equal(mgr.setColumns(5), false);
    assert.equal(mgr.currentColumns, 2);
});

test('grid-columns.css defines responsive desktop grid variables and switcher buttons', () => {
    const cssPath = path.resolve(__dirname, '../assets/css/grid-columns.css');
    assert.ok(fs.existsSync(cssPath), 'grid-columns.css must exist');

    const css = fs.readFileSync(cssPath, 'utf8');
    assert.match(css, /--catalog-col-count:\s*3;/, 'Sets default 3-column variable');
    assert.match(css, /repeat\(var\(--catalog-col-count,\s*3\),\s*1fr\)/, 'Binds grid template columns to custom property');
    assert.match(css, /\.grid-density-switcher/, 'Styles density switcher container');
    assert.match(css, /@media\s*\(min-width:\s*1024px\)/, 'Applies layout only on desktop viewports');
});
