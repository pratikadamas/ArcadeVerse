const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ScrollProgressTopController } = require('../assets/js/scroll-progress-top.js');

test('ScrollProgressTopController calculates scroll percentage accurately', () => {
    const controller = new ScrollProgressTopController({ threshold: 300, radius: 21 });

    assert.equal(controller.calculateProgress(0, 2000, 1000), 0);
    assert.equal(controller.calculateProgress(500, 2000, 1000), 50);
    assert.equal(controller.calculateProgress(1000, 2000, 1000), 100);
    assert.equal(controller.calculateProgress(1500, 2000, 1000), 100); // Clamped
});

test('ScrollProgressTopController updates circular dashoffset according to percentage', () => {
    const controller = new ScrollProgressTopController({ radius: 20 });
    const circumference = 2 * Math.PI * 20;

    let updatedOffset = null;
    controller.progressRing = {
        style: {
            set strokeDashoffset(val) { updatedOffset = val; }
        }
    };

    controller.updateRing(0);
    assert.equal(updatedOffset, `${circumference}px`);

    controller.updateRing(50);
    assert.equal(updatedOffset, `${circumference / 2}px`);

    controller.updateRing(100);
    assert.equal(updatedOffset, '0px');
});

test('scroll-progress-top.css contains progress ring styles and visibility transitions', () => {
    const cssPath = path.resolve(__dirname, '../assets/css/scroll-progress-top.css');
    assert.ok(fs.existsSync(cssPath), 'scroll-progress-top.css must exist');

    const css = fs.readFileSync(cssPath, 'utf8');
    assert.match(css, /\.scroll-progress-top-btn/, 'Styles FAB button');
    assert.match(css, /\.progress-ring-fill/, 'Styles progress ring circle');
    assert.match(css, /\.scroll-progress-top-btn\.visible/, 'Defines visible state');
    assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/, 'Honors prefers-reduced-motion');
});
