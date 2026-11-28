const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Game Screenshot Module and Styles exist and are valid', (t) => {
  const cssPath = path.join(__dirname, '..', 'assets', 'css', 'game-screenshot.css');
  const jsPath = path.join(__dirname, '..', 'assets', 'js', 'game-screenshot.js');

  assert.ok(fs.existsSync(cssPath), 'CSS file should exist');
  assert.ok(fs.existsSync(jsPath), 'JS file should exist');

  const cssContent = fs.readFileSync(cssPath, 'utf8');
  const jsContent = fs.readFileSync(jsPath, 'utf8');

  assert.ok(cssContent.includes('.screenshot-btn'), 'CSS contains button styles');
  assert.ok(cssContent.includes('.screenshot-flash-overlay'), 'CSS contains flash overlay styles');
  assert.ok(jsContent.includes('GameScreenshotUtility'), 'JS exposes GameScreenshotUtility');
});

test('Format filename utility handles edge cases and timestamp', (t) => {
  const { GameScreenshotUtility } = require('../assets/js/game-screenshot.js');
  const util = new GameScreenshotUtility();

  const fn = util.generateFilename('Space Invaders 3D!');
  assert.ok(fn.startsWith('ArcadeVerse-space-invaders-3d--'), 'Sanitizes special characters');
  assert.ok(fn.endsWith('.png'), 'Appends .png extension');

  const fn2 = util.generateFilename('');
  assert.ok(fn2.startsWith('ArcadeVerse-game-'), 'Defaults empty titles');
});
