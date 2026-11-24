const test = require('node:test');
const assert = require('node:assert');
const { GameComparatorDrawer } = require('../assets/js/game-comparator.js');

test('GameComparatorDrawer adds and limits selected games to max count', () => {
  const drawer = new GameComparatorDrawer({ maxGames: 3 });
  assert.strictEqual(drawer.selectedGames.length, 0);

  drawer.addGame({ id: 'game-1', title: 'Cyber Pong', category: 'Arcade' });
  drawer.addGame({ id: 'game-2', title: 'Neon Runner', category: 'Action' });
  drawer.addGame({ id: 'game-3', title: 'Star Miner', category: 'Space' });
  assert.strictEqual(drawer.selectedGames.length, 3);
  assert.strictEqual(drawer.isOpen, true);

  // Exceeding 3 games shifts the oldest
  drawer.addGame({ id: 'game-4', title: 'Fruit Fury', category: 'Casual' });
  assert.strictEqual(drawer.selectedGames.length, 3);
  assert.strictEqual(drawer.selectedGames[0].id, 'game-2');
  assert.strictEqual(drawer.selectedGames[2].id, 'game-4');
});

test('GameComparatorDrawer generates tabular comparison matrix HTML', () => {
  const drawer = new GameComparatorDrawer();
  drawer.addGame({ id: 'g1', title: 'Game One', category: 'Puzzle', difficulty: 'Hard' });
  drawer.addGame({ id: 'g2', title: 'Game Two', category: 'Retro', difficulty: 'Easy' });

  const html = drawer.generateHtmlMatrix();
  assert.ok(html.includes('Game One'));
  assert.ok(html.includes('Game Two'));
  assert.ok(html.includes('Puzzle'));
  assert.ok(html.includes('Retro'));
});
