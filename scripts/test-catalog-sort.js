const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Catalog Sort Styles and Module existence', (t) => {
  const cssPath = path.join(__dirname, '..', 'assets', 'css', 'catalog-sort.css');
  const jsPath = path.join(__dirname, '..', 'assets', 'js', 'catalog-sort.js');

  assert.ok(fs.existsSync(cssPath), 'CSS file should exist');
  assert.ok(fs.existsSync(jsPath), 'JS file should exist');

  const cssContent = fs.readFileSync(cssPath, 'utf8');
  assert.ok(cssContent.includes('.catalog-sort-container'), 'Contains container');
  assert.ok(cssContent.includes('.catalog-sort-invert-btn'), 'Contains invert btn');
});

test('CatalogSortManager correctly sorts lists and toggles direction', (t) => {
  const { CatalogSortManager } = require('../assets/js/catalog-sort.js');
  const manager = new CatalogSortManager();

  const mockGames = [
    { title: 'Zelda', plays: 100 },
    { title: 'Asteroids', plays: 500 },
    { title: 'Pac-Man', plays: 250 }
  ];

  manager.setField('title');
  if (manager.getSortConfig().direction !== 'asc') {
    manager.toggleDirection();
  }

  const sortedAlpha = manager.sortGames(mockGames);
  assert.strictEqual(sortedAlpha[0].title, 'Asteroids');
  assert.strictEqual(sortedAlpha[2].title, 'Zelda');

  manager.toggleDirection(); // to desc
  const sortedAlphaDesc = manager.sortGames(mockGames);
  assert.strictEqual(sortedAlphaDesc[0].title, 'Zelda');
  assert.strictEqual(sortedAlphaDesc[2].title, 'Asteroids');

  manager.setField('plays');
  manager.toggleDirection(); // to asc
  const sortedPlays = manager.sortGames(mockGames);
  assert.strictEqual(sortedPlays[0].plays, 100);
  assert.strictEqual(sortedPlays[2].plays, 500);
});
