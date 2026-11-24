const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { MotionAccessibilityManager } = require('../assets/js/motion-a11y.js');

test('MotionAccessibilityManager queries media query and suppresses screen shake when active', () => {
    let reducedMatches = true;
    global.window = {
        matchMedia: (q) => ({
            matches: reducedMatches,
            addEventListener: () => {}
        })
    };

    const mgr = new MotionAccessibilityManager();
    mgr.init();

    assert.equal(mgr.prefersReducedMotion(), true, 'Detects prefers-reduced-motion active');

    // Screen shake suppression
    const dummyElement = { style: {} };
    mgr.applyScreenShake(dummyElement, 10);
    assert.equal(dummyElement.style.transform, undefined, 'Bypasses transform when reduced motion is preferred');

    // When reduced motion is disabled
    mgr.isReduced = false;
    mgr.mediaQuery = { matches: false };
    assert.equal(mgr.prefersReducedMotion(), false);

    mgr.applyScreenShake(dummyElement, 10);
    assert.ok(dummyElement.style.transform.includes('translate'), 'Applies shake transform when motion is enabled');
});

test('reduced-motion.css contains global animation suppression and screen-shake overrides', () => {
    const cssPath = path.resolve(__dirname, '../assets/css/reduced-motion.css');
    assert.ok(fs.existsSync(cssPath), 'reduced-motion.css must exist');

    const css = fs.readFileSync(cssPath, 'utf8');
    assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/, 'Contains media query block');
    assert.match(css, /animation-duration:\s*0\.01ms/, 'Collapses animations to imperceptible length');
    assert.match(css, /\.screen-shake/, 'Suppresses screen shake classes');
    assert.match(css, /body\.reduce-motion-active/, 'Provides class-based fallback');
});
