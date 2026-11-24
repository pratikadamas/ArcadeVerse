const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { CategoryScrollTrack } = require('../assets/js/category-scroll.js');

test('CategoryScrollTrack controls scroll steppers and centers active pill', () => {
    let scrollArgs = null;
    let scrollToArgs = null;

    const mockContainer = {
        scrollLeft: 100,
        scrollWidth: 800,
        clientWidth: 400,
        scrollBy(opts) { scrollArgs = opts; },
        scrollTo(opts) { scrollToArgs = opts; }
    };

    const leftBtn = { style: {} };
    const rightBtn = { style: {} };

    const track = new CategoryScrollTrack(mockContainer, 150);
    track.init(leftBtn, rightBtn);

    // Test left stepper
    track.scrollLeft();
    assert.equal(scrollArgs.left, -150);
    assert.equal(scrollArgs.behavior, 'smooth');

    // Test right stepper
    track.scrollRight();
    assert.equal(scrollArgs.left, 150);

    // Test centering pill
    const pill = { offsetLeft: 350, clientWidth: 80 };
    track.centerPill(pill);
    // targetScroll = 350 - (400/2) + (80/2) = 350 - 200 + 40 = 190
    assert.equal(scrollToArgs.left, 190);
    assert.equal(scrollToArgs.behavior, 'smooth');

    // Test button visibility
    track.updateStepperVisibility();
    assert.equal(leftBtn.style.display, 'flex');
    assert.equal(rightBtn.style.display, 'flex');
});

test('category-scroll.css contains edge fade masks and hidden scrollbar rules', () => {
    const cssPath = path.resolve(__dirname, '../assets/css/category-scroll.css');
    assert.ok(fs.existsSync(cssPath), 'category-scroll.css must exist');

    const css = fs.readFileSync(cssPath, 'utf8');
    assert.match(css, /\.category-scroll-track/, 'Styles track container');
    assert.match(css, /mask-image:\s*linear-gradient/, 'Applies CSS mask-image fade');
    assert.match(css, /scrollbar-width:\s*none/, 'Hides native Firefox scrollbar');
    assert.match(css, /\.category-stepper-btn/, 'Styles chevron stepper buttons');
});
