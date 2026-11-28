const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Thumbnail loader stylesheet and controller exist', (t) => {
  const cssPath = path.join(__dirname, '..', 'assets', 'css', 'thumbnail-loader.css');
  const jsPath = path.join(__dirname, '..', 'assets', 'js', 'thumbnail-loader.js');

  assert.ok(fs.existsSync(cssPath), 'CSS file should exist');
  assert.ok(fs.existsSync(jsPath), 'JS file should exist');

  const css = fs.readFileSync(cssPath, 'utf8');
  assert.ok(css.includes('.game-thumbnail-skeleton'), 'Includes skeleton styles');
  assert.ok(css.includes('.game-thumbnail-img.loaded'), 'Includes loaded state transition');
});

test('ThumbnailLoaderManager exposes valid fallback data URI and methods', (t) => {
  const { ThumbnailLoaderManager } = require('../assets/js/thumbnail-loader.js');
  const mgr = new ThumbnailLoaderManager();

  assert.ok(ThumbnailLoaderManager.FALLBACK_SVG.startsWith('data:image/svg+xml;'), 'Valid SVG data URL');
  assert.ok(typeof mgr.observeImage === 'function');
  assert.ok(typeof mgr.loadImage === 'function');
  assert.ok(typeof mgr.scanAndObserve === 'function');
});
