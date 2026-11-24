const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { TooltipEngine } = require('../assets/js/tooltips.js');

test('TooltipEngine dynamically calculates flip placement near viewport edges', () => {
    const engine = new TooltipEngine();

    // Element positioned at the top of the viewport
    const topElement = {
        attributes: { 'data-tooltip': 'Retro Canvas Badge' },
        getAttribute(attr) { return this.attributes[attr]; },
        setAttribute(attr, val) { this.attributes[attr] = val; },
        hasAttribute(attr) { return attr in this.attributes; },
        getBoundingClientRect() {
            return { top: 20, bottom: 45, left: 200, right: 300, width: 100, height: 25 };
        }
    };

    const placementTop = engine.calculatePlacement(topElement);
    assert.equal(placementTop, 'bottom', 'Flips to bottom when less than 45px from top edge');
    assert.equal(topElement.attributes['data-tooltip-pos'], 'bottom');

    // Element in center of page
    const centerElement = {
        attributes: { 'data-tooltip': 'Action Genre' },
        getAttribute(attr) { return this.attributes[attr]; },
        setAttribute(attr, val) { this.attributes[attr] = val; },
        hasAttribute(attr) { return attr in this.attributes; },
        getBoundingClientRect() {
            return { top: 350, bottom: 375, left: 400, right: 500, width: 100, height: 25 };
        }
    };

    const placementCenter = engine.calculatePlacement(centerElement);
    assert.equal(placementCenter, 'top', 'Remains top when clearance is ample');
});

test('tooltips.css contains spring scale transform and high contrast styling', () => {
    const cssPath = path.resolve(__dirname, '../assets/css/tooltips.css');
    assert.ok(fs.existsSync(cssPath), 'tooltips.css must exist');

    const css = fs.readFileSync(cssPath, 'utf8');
    assert.match(css, /\[data-tooltip\]/, 'Targets data-tooltip attribute');
    assert.match(css, /cubic-bezier/, 'Uses spring micro-animation curve');
    assert.match(css, /\[data-tooltip-pos="bottom"\]/, 'Handles dynamic bottom placement');
    assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/, 'Complies with prefers-reduced-motion');
});
