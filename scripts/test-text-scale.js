const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { TextScaleManager } = require('../assets/js/text-scale.js');

test('TextScaleManager switches presets, updates root style properties, and persists', () => {
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

    const mgr = new TextScaleManager();
    mgr.init();

    // Default scale
    assert.equal(mgr.currentScale, 'default');
    assert.equal(rootStyle['--base-text-scale'], '1');

    // Large scale
    mgr.setScale('large');
    assert.equal(mgr.currentScale, 'large');
    assert.equal(rootStyle['--base-text-scale'], '1.15');
    assert.equal(mockStore['av_text_scale'], 'large');
    assert.equal(rootAttr['data-text-scale'], 'large');

    // Invalid scale key rejected
    assert.equal(mgr.setScale('gigantic'), false);
    assert.equal(mgr.currentScale, 'large');
});

test('text-scale.css contains typographic calculation rules and segmented button styles', () => {
    const cssPath = path.resolve(__dirname, '../assets/css/text-scale.css');
    assert.ok(fs.existsSync(cssPath), 'text-scale.css must exist');

    const css = fs.readFileSync(cssPath, 'utf8');
    assert.match(css, /--base-text-scale:\s*1;/, 'Declares root scale property');
    assert.match(css, /calc\(.*var\(--base-text-scale/, 'Applies calc multiplication on headings');
    assert.match(css, /\.text-scale-segmented-control/, 'Styles segmented controls');
    assert.match(css, /\.text-scale-btn\.active/, 'Styles active button state');
});
