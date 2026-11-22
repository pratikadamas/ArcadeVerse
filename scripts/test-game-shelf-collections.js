const test = require('node:test');
const assert = require('node:assert/strict');
const GameShelfCollections = require('../assets/js/game-shelf-collections.js');

test('GameShelfCollections creates shelves and manages game membership', () => {
  const manager = new GameShelfCollections();
  const shelf = manager.createShelf('Speedrun Hub', '#ec4899');

  assert.equal(shelf.name, 'Speedrun Hub');
  assert.equal(manager.addGameToShelf(shelf.id, 'cyber-pong_babin'), true);
  assert.equal(manager.addGameToShelf(shelf.id, 'cyber-pong_babin'), false); // Duplicate prevented

  assert.equal(manager.removeGameFromShelf(shelf.id, 'cyber-pong_babin'), true);
});

test('GameShelfCollections exports and imports Base64 shareable URL parameters', () => {
  const manager = new GameShelfCollections();
  const shelf = manager.createShelf('Tournament 2026', '#10b981');
  manager.addGameToShelf(shelf.id, 'game_a');
  manager.addGameToShelf(shelf.id, 'game_b');

  const urlParam = manager.exportShareableURL(shelf.id);
  assert.ok(urlParam.startsWith('?shelf='));

  const b64 = decodeURIComponent(urlParam.replace('?shelf=', ''));
  const imported = manager.importFromShareableString(b64);

  assert.ok(imported !== null);
  assert.equal(imported.name, 'Tournament 2026');
  assert.deepEqual(imported.gameIds, ['game_a', 'game_b']);
});
