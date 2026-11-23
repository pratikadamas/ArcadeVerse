const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { CardClampManager } = require('../assets/js/card-clamp.js');

test('CardClampManager attaches button when content overflows 2 lines and toggles expanded', () => {
    let appendedChild = null;
    let clickListener = null;

    const mockBtn = {
        type: '',
        className: '',
        attributes: {},
        textContent: '',
        setAttribute(k, v) { this.attributes[k] = v; },
        addEventListener(ev, cb) { if (ev === 'click') clickListener = cb; }
    };

    global.document = {
        createElement: (tag) => {
            if (tag === 'button') return mockBtn;
            return {};
        }
    };

    const classSet = new Set();
    const mockContainer = {
        classList: {
            toggle: (c) => {
                if (classSet.has(c)) { classSet.delete(c); return false; }
                else { classSet.add(c); return true; }
            }
        },
        querySelector: (sel) => {
            if (sel === '.card-desc-clamped') {
                return { scrollHeight: 70, clientHeight: 38 }; // Overflowing 2 lines
            }
            if (sel === '.card-read-more-btn') return null;
            return null;
        },
        appendChild: (child) => { appendedChild = child; }
    };

    const manager = new CardClampManager();
    manager.enhance(mockContainer);

    assert.ok(appendedChild, 'Attaches read more button');
    assert.equal(mockBtn.textContent, 'More...');
    assert.equal(mockBtn.attributes['aria-expanded'], 'false');

    // Simulate click
    clickListener({ stopPropagation: () => {} });
    assert.equal(classSet.has('expanded'), true, 'Expands container on click');
    assert.equal(mockBtn.textContent, 'Less');
    assert.equal(mockBtn.attributes['aria-expanded'], 'true');
});

test('card-clamp.css contains line clamp and smooth transition rules', () => {
    const cssPath = path.resolve(__dirname, '../assets/css/card-clamp.css');
    assert.ok(fs.existsSync(cssPath), 'card-clamp.css must exist');

    const css = fs.readFileSync(cssPath, 'utf8');
    assert.match(css, /-webkit-line-clamp:\s*2;/, 'Clamps text to 2 lines');
    assert.match(css, /\.card-desc-container\.expanded/, 'Handles expanded state');
    assert.match(css, /\.card-read-more-btn/, 'Styles read more button');
});
