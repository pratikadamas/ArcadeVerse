const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { FavoriteAnimationManager } = require('../assets/js/favorite-animation.js');

test('FavoriteAnimationManager handles animation classes and live region announcements', () => {
    const classList = new Set();
    const btn = {
        classList: {
            add: (c) => classList.add(c),
            remove: (c) => classList.delete(c),
            contains: (c) => classList.has(c)
        },
        offsetWidth: 40,
        children: [],
        appendChild(child) { this.children.push(child); }
    };

    const manager = new FavoriteAnimationManager();
    let announcedMessage = '';
    manager.announcerElement = {
        set textContent(val) { announcedMessage = val; }
    };

    // Toggle Favorite ON
    manager.animateFavorite(btn, true, 'Cyber Space');
    assert.equal(classList.has('favorited'), true, 'Adds favorited class');
    assert.equal(classList.has('star-pop-active'), true, 'Triggers pop bounce class');
    assert.equal(announcedMessage, 'Cyber Space added to favorites');

    // Toggle Favorite OFF
    manager.animateFavorite(btn, false, 'Cyber Space');
    assert.equal(classList.has('favorited'), false, 'Removes favorited class');
    assert.equal(announcedMessage, 'Cyber Space removed from favorites');
});

test('favorite-animation.css contains keyframe bounce, sparkle particles, and reduced motion', () => {
    const cssPath = path.resolve(__dirname, '../assets/css/favorite-animation.css');
    assert.ok(fs.existsSync(cssPath), 'favorite-animation.css must exist');

    const css = fs.readFileSync(cssPath, 'utf8');
    assert.match(css, /@keyframes starPopBounce/, 'Defines bounce keyframes');
    assert.match(css, /\.favorite-sparkle-burst/, 'Defines particle burst container');
    assert.match(css, /@keyframes particleFly/, 'Defines radial particle burst flight');
    assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/, 'Disables animations for prefers-reduced-motion');
});
