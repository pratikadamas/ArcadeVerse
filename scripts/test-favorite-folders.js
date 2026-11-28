const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { FavoriteFoldersManager } = require('../assets/js/favorite-folders.js');

test('FavoriteFoldersManager performs folder CRUD and game tagging', () => {
    let mockStorage = {};
    global.localStorage = {
        getItem: (k) => mockStorage[k] || null,
        setItem: (k, v) => { mockStorage[k] = String(v); }
    };

    const mgr = new FavoriteFoldersManager();

    // Check defaults
    assert.equal(mgr.getFolders().length >= 2, true);

    // Create folder
    const custom = mgr.createFolder('Weekend Co-op');
    assert.ok(custom);
    assert.equal(custom.name, 'Weekend Co-op');

    // Add games
    mgr.addGameToFolder(custom.id, 'cyber-snake');
    mgr.addGameToFolder(custom.id, 'space-invaders');
    const updated = mgr.getFolder(custom.id);
    assert.equal(updated.gameIds.length, 2);
    assert.ok(updated.gameIds.includes('cyber-snake'));

    // Filter games
    const mockGames = [
        { id: 'cyber-snake', title: 'Cyber Snake' },
        { id: 'pong', title: 'Pong' },
        { id: 'space-invaders', title: 'Space Invaders' }
    ];
    const filtered = mgr.filterGames(mockGames, custom.id);
    assert.equal(filtered.length, 2);

    // Remove game
    mgr.removeGameFromFolder(custom.id, 'cyber-snake');
    assert.equal(mgr.getFolder(custom.id).gameIds.length, 1);

    // Rename folder
    mgr.renameFolder(custom.id, 'Retro Gems');
    assert.equal(mgr.getFolder(custom.id).name, 'Retro Gems');

    // Delete folder
    mgr.deleteFolder(custom.id);
    assert.equal(mgr.getFolder(custom.id), null);
});

test('favorite-folders.css defines folder chips and card badge tags', () => {
    const cssPath = path.resolve(__dirname, '../assets/css/favorite-folders.css');
    assert.ok(fs.existsSync(cssPath), 'favorite-folders.css must exist');

    const css = fs.readFileSync(cssPath, 'utf8');
    assert.match(css, /\.favorite-folders-bar/, 'Styles folder bar');
    assert.match(css, /\.folder-chip/, 'Styles folder chips');
    assert.match(css, /\.folder-chip\.active/, 'Styles active folder chip state');
    assert.match(css, /\.card-folder-tag/, 'Styles game card folder badges');
});
