const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { AccessibilitySkipLink } = require('../assets/js/skip-to-content.js');

test('AccessibilitySkipLink creates link element and sets target accessibility attributes', () => {
    // Mock minimal DOM
    const elements = new Map();
    const target = {
        id: 'games-grid',
        attributes: {},
        focused: false,
        hasAttribute(attr) { return attr in this.attributes; },
        setAttribute(attr, val) { this.attributes[attr] = val; },
        focus() { this.focused = true; },
        scrollIntoView() {}
    };
    elements.set('games-grid', target);

    global.document = {
        body: {
            firstChild: null,
            insertBefore(el, ref) {
                elements.set(el.id, el);
                this.firstChild = el;
            }
        },
        getElementById(id) { return elements.get(id) || null; },
        createElement(tag) {
            return {
                tagName: tag,
                attributes: {},
                listeners: {},
                setAttribute(attr, val) { this.attributes[attr] = val; },
                addEventListener(ev, cb) { this.listeners[ev] = cb; }
            };
        }
    };

    const skipMgr = new AccessibilitySkipLink({ targetId: 'games-grid', linkId: 'skip-to-content' });
    const initialized = skipMgr.init();

    assert.equal(initialized, true, 'Skip link initialized');
    assert.ok(elements.has('skip-to-content'), 'Skip link element registered');

    // Simulate skip link activation
    const focused = skipMgr.focusTarget();
    assert.equal(focused, true, 'Focus moved to target');
    assert.equal(target.attributes['tabindex'], '-1', 'Sets tabindex -1 on target if missing');
    assert.equal(target.focused, true, 'Target element received focus');
});

test('skip-to-content.css contains required WCAG focus styles and animation rules', () => {
    const cssPath = path.resolve(__dirname, '../assets/css/skip-to-content.css');
    assert.ok(fs.existsSync(cssPath), 'skip-to-content.css must exist');

    const css = fs.readFileSync(cssPath, 'utf8');
    assert.match(css, /\.arcade-skip-link/, 'Styles skip link class');
    assert.match(css, /transform:\s*translateY\(-160%\)/, 'Hides skip link off-screen by default');
    assert.match(css, /transform:\s*translateY\(0\)/, 'Reveals skip link when focused');
    assert.match(css, /:focus-visible/, 'Defines high-contrast focus visible ring');
    assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/, 'Supports prefers-reduced-motion');
});
