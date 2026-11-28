const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Genre accent stripes stylesheet and script exist', (t) => {
  const cssPath = path.join(__dirname, '..', 'assets', 'css', 'genre-accent-stripes.css');
  const jsPath = path.join(__dirname, '..', 'assets', 'js', 'genre-accent-stripes.js');

  assert.ok(fs.existsSync(cssPath), 'CSS file should exist');
  assert.ok(fs.existsSync(jsPath), 'JS file should exist');

  const css = fs.readFileSync(cssPath, 'utf8');
  assert.ok(css.includes('[data-genre="action"]'), 'Contains action stripe rule');
  assert.ok(css.includes('[data-genre="arcade"]'), 'Contains arcade stripe rule');
});

test('GenreAccentManager accurately normalizes genres and assigns colors', (t) => {
  const { GenreAccentManager } = require('../assets/js/genre-accent-stripes.js');

  assert.strictEqual(GenreAccentManager.normalizeGenre('Classic Arcade'), 'arcade');
  assert.strictEqual(GenreAccentManager.normalizeGenre('Mind Puzzle'), 'puzzle');
  assert.strictEqual(GenreAccentManager.normalizeGenre('Fast Racing Game'), 'racing');
  assert.strictEqual(GenreAccentManager.normalizeGenre('Unknown Category'), 'other');

  const color = GenreAccentManager.getAccentColor('arcade');
  assert.strictEqual(color, '#00f0ff');
});
