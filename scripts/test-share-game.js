const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { GameShareManager } = require('../assets/js/share-game.js');

test('GameShareManager builds canonical share URL and manages clipboard copy', async () => {
    let copiedText = '';
    const mockClipboard = {
        writeText: async (t) => {
            copiedText = t;
        }
    };

    let toastText = '';
    const mockToast = {
        className: '',
        classList: { add: () => {}, remove: () => {} },
        set textContent(v) { toastText = v; },
        setAttribute: () => {}
    };

    global.document = {
        getElementById: () => mockToast,
        createElement: () => mockToast,
        body: { appendChild: () => {}, removeChild: () => {} }
    };

    const manager = new GameShareManager({
        baseUrl: 'https://arcadeverse.dev/',
        clipboard: mockClipboard
    });

    assert.equal(manager.buildShareUrl('cyber-snake'), 'https://arcadeverse.dev/?game=cyber-snake');

    const result = await manager.copyShareLink('cyber-snake', 'Cyber Snake');
    assert.equal(result.success, true);
    assert.equal(copiedText, 'https://arcadeverse.dev/?game=cyber-snake');
    assert.ok(toastText.includes('Cyber Snake'), 'Displays game title in toast feedback');
});

test('share-game.css contains toast slide-in keyframes and accessibility rules', () => {
    const cssPath = path.resolve(__dirname, '../assets/css/share-game.css');
    assert.ok(fs.existsSync(cssPath), 'share-game.css must exist');

    const css = fs.readFileSync(cssPath, 'utf8');
    assert.match(css, /\.arcade-share-toast/, 'Styles toast container');
    assert.match(css, /\.arcade-share-toast\.visible/, 'Handles visible toast state');
    assert.match(css, /transform:\s*translateX\(-50%\)/, 'Centers toast horizontally');
    assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/, 'Handles reduced motion');
});
