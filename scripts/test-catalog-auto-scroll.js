const test = require('node:test');
const assert = require('node:assert/strict');
const { CatalogAutoScroll } = require('../assets/js/catalog-auto-scroll.js');

test('CatalogAutoScroll evaluates viewport collision and triggers smooth scroll with navbar offset', () => {
    let scrolledParams = null;
    global.window = {
        innerHeight: 800,
        pageYOffset: 400,
        scrollTo(opts) { scrolledParams = opts; },
        matchMedia() { return { matches: false }; }
    };

    // Target grid that is scrolled out of view (e.g. above navbar)
    const outOfViewElement = {
        getBoundingClientRect: () => ({ top: 10, bottom: 500, height: 490 })
    };

    const scroller = new CatalogAutoScroll({ navbarOffset: 80 });

    assert.equal(scroller.shouldScroll(outOfViewElement), true, 'Identifies element above navbar as needing scroll');

    // Target grid already in comfortable view (top: 150px)
    const comfortableElement = {
        getBoundingClientRect: () => ({ top: 150, bottom: 650, height: 500 })
    };
    assert.equal(scroller.shouldScroll(comfortableElement), false, 'Does not scroll when already comfortably visible');

    // Mock document
    global.document = {
        querySelector: () => outOfViewElement
    };

    const didScroll = scroller.scrollToGrid();
    assert.equal(didScroll, true);
    // targetY = 400 + 10 - 80 = 330
    assert.equal(scrolledParams.top, 330);
    assert.equal(scrolledParams.behavior, 'smooth');
});

test('CatalogAutoScroll respects prefers-reduced-motion media query', () => {
    let scrolledParams = null;
    global.window = {
        innerHeight: 800,
        pageYOffset: 200,
        scrollTo(opts) { scrolledParams = opts; },
        matchMedia: (query) => ({ matches: query.includes('prefers-reduced-motion') })
    };

    const outOfViewElement = {
        getBoundingClientRect: () => ({ top: 750, bottom: 1200 })
    };
    global.document = {
        querySelector: () => outOfViewElement
    };

    const scroller = new CatalogAutoScroll({ navbarOffset: 80 });
    scroller.scrollToGrid();
    assert.equal(scrolledParams.behavior, 'auto', 'Uses instant auto scroll when reduced motion is preferred');
});
