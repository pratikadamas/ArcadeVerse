const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ModalBreadcrumbManager } = require('../assets/js/modal-breadcrumb.js');

test('ModalBreadcrumbManager formats breadcrumb HTML and wires navigation events', () => {
    let homeNavigated = false;
    let selectedCat = '';

    const listeners = {};
    const mockContainer = {
        innerHTML: '',
        querySelector: (sel) => {
            if (sel === '.breadcrumb-home') {
                return {
                    addEventListener: (ev, cb) => { listeners['home'] = cb; }
                };
            }
            if (sel === '.breadcrumb-cat') {
                return {
                    getAttribute: () => 'Retro',
                    addEventListener: (ev, cb) => { listeners['cat'] = cb; }
                };
            }
            return null;
        }
    };

    const manager = new ModalBreadcrumbManager({
        onNavigateHome: () => { homeNavigated = true; },
        onNavigateCategory: (cat) => { selectedCat = cat; }
    });

    const html = manager.renderBreadcrumbs(mockContainer, 'Retro', 'Space Invaders 2');
    assert.ok(html.includes('ArcadeVerse'), 'Includes root brand link');
    assert.ok(html.includes('Retro'), 'Includes category node');
    assert.ok(html.includes('Space Invaders 2'), 'Includes game title');
    assert.ok(html.includes('nav class="modal-breadcrumb-nav"'), 'Uses semantic nav element');

    // Trigger click home
    listeners['home']({ preventDefault: () => {} });
    assert.equal(homeNavigated, true, 'Calls home navigation hook');

    // Trigger click category
    listeners['cat']({ preventDefault: () => {} });
    assert.equal(selectedCat, 'Retro', 'Passes category to callback hook');
});

test('breadcrumb.css contains breadcrumb trail rules and mobile truncation', () => {
    const cssPath = path.resolve(__dirname, '../assets/css/breadcrumb.css');
    assert.ok(fs.existsSync(cssPath), 'breadcrumb.css must exist');

    const css = fs.readFileSync(cssPath, 'utf8');
    assert.match(css, /\.modal-breadcrumb-nav/, 'Styles breadcrumb navigation');
    assert.match(css, /\.breadcrumb-title/, 'Handles ellipsis truncation');
    assert.match(css, /@media\s*\(max-width:\s*600px\)/, 'Constrains title length on mobile');
});
