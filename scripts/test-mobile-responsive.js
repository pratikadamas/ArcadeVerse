const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('mobile-responsive.css defines comprehensive mobile/tablet breakpoints and touch target rules', () => {
    const cssPath = path.resolve(__dirname, '../assets/css/mobile-responsive.css');
    assert.ok(fs.existsSync(cssPath), 'mobile-responsive.css must exist');

    const css = fs.readFileSync(cssPath, 'utf8');

    // Horizontal overflow prevention
    assert.match(css, /overflow-x:\s*hidden/, 'Prevents horizontal scrollbars');
    assert.match(css, /-webkit-text-size-adjust:\s*100%/, 'Prevents text inflation on mobile browsers');

    // Mobile Navigation & Search
    assert.match(css, /@media\s*\(max-width:\s*768px\)/, 'Contains 768px mobile breakpoint');
    assert.match(css, /\.navbar/, 'Applies responsive styling to navbar');
    assert.match(css, /flex-wrap:\s*wrap/, 'Wraps navigation items gracefully');

    // Cards & Grid responsiveness
    assert.match(css, /@media\s*\(max-width:\s*640px\)/, 'Contains 640px small mobile breakpoint');
    assert.match(css, /grid-template-columns:\s*1fr/, 'Enforces single column grid on mobile');

    // Touch targets & iOS Zoom prevention
    assert.match(css, /min-height:\s*40px/, 'Enforces minimum accessible touch target sizes');
    assert.match(css, /font-size:\s*16px/, 'Prevents automatic input zoom on mobile WebKit/iOS');

    // Modal sizing
    assert.match(css, /\.game-modal-dialog|\.modal-content/, 'Styles mobile game modal sizing');

    // Tablet breakpoint
    assert.match(css, /@media\s*\(min-width:\s*769px\)\s*and\s*\(max-width:\s*1024px\)/, 'Contains tablet breakpoint');
    assert.match(css, /repeat\(2,\s*1fr\)/, 'Provides 2-column layout for tablets');
});
