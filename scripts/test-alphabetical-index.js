const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { AlphabeticalIndexController } = require('../assets/js/alphabetical-index.js');

test('AlphabeticalIndexController computes letter grouping and empty states', () => {
    const controller = new AlphabeticalIndexController({ navbarOffset: 80 });

    const games = [
        { title: 'Asteroids Retro' },
        { title: 'Cyber Snake' },
        { title: '2048 Neon' },
        { title: 'Pac-Man' }
    ];

    const map = controller.computeLetterMap(games);

    assert.equal(controller.hasGamesForLetter('A'), true);
    assert.equal(controller.hasGamesForLetter('C'), true);
    assert.equal(controller.hasGamesForLetter('P'), true);
    assert.equal(controller.hasGamesForLetter('#'), true); // '2048 Neon'
    assert.equal(controller.hasGamesForLetter('Z'), false);
});

test('AlphabeticalIndexController calculates target scroll offset with navbar clearance', () => {
    let scrolledTop = null;
    global.window = {
        scrollY: 200,
        pageYOffset: 200,
        scrollTo: (opts) => { scrolledTop = opts.top; }
    };

    const mockCard = {
        getBoundingClientRect: () => ({ top: 400 })
    };

    const controller = new AlphabeticalIndexController({ navbarOffset: 80 });
    controller.findTargetCard = () => mockCard;

    const jumped = controller.jumpToLetter('A');
    assert.equal(jumped, true);
    // targetY = 200 + 400 - 80 = 520
    assert.equal(scrolledTop, 520);
});

test('alphabetical-index.css defines sticky positioning and responsive layout', () => {
    const cssPath = path.resolve(__dirname, '../assets/css/alphabetical-index.css');
    assert.ok(fs.existsSync(cssPath), 'alphabetical-index.css must exist');

    const css = fs.readFileSync(cssPath, 'utf8');
    assert.match(css, /\.alphabetical-index-bar/, 'Styles index container');
    assert.match(css, /\.alpha-jump-btn/, 'Styles jump buttons');
    assert.match(css, /\.alpha-jump-btn\.active/, 'Styles active button state');
    assert.match(css, /@media\s*\(max-width:\s*900px\)/, 'Handles responsive mobile scroller');
});
