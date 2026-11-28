const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Author filter styles and script exist', (t) => {
  const cssPath = path.join(__dirname, '..', 'assets', 'css', 'author-filter.css');
  const jsPath = path.join(__dirname, '..', 'assets', 'js', 'author-filter.js');

  assert.ok(fs.existsSync(cssPath), 'CSS file should exist');
  assert.ok(fs.existsSync(jsPath), 'JS file should exist');

  const css = fs.readFileSync(cssPath, 'utf8');
  assert.ok(css.includes('.author-filter-select'), 'Includes select style');
  assert.ok(css.includes('.author-attribution-badge'), 'Includes attribution badge');
});

test('AuthorFilterManager aggregates creators and filters catalog items', (t) => {
  const { AuthorFilterManager } = require('../assets/js/author-filter.js');
  const mgr = new AuthorFilterManager();

  const mockGames = [
    { title: 'Asteroids', author: 'Alice' },
    { title: 'Lunar', author: 'Alice' },
    { title: 'Pong', author: 'Bob' },
    { title: 'Tetris' } // default ArcadeVerse
  ];

  const authors = mgr.aggregateAuthors(mockGames);
  assert.strictEqual(authors.get('Alice'), 2);
  assert.strictEqual(authors.get('Bob'), 1);
  assert.strictEqual(authors.get('ArcadeVerse'), 1);

  const aliceGames = mgr.filterGamesByAuthor(mockGames, 'Alice');
  assert.strictEqual(aliceGames.length, 2);

  const allGames = mgr.filterGamesByAuthor(mockGames, 'all');
  assert.strictEqual(allGames.length, 4);
});
