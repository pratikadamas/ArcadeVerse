const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Tag cloud styles and script exist and are valid', (t) => {
  const cssPath = path.join(__dirname, '..', 'assets', 'css', 'tag-cloud-drawer.css');
  const jsPath = path.join(__dirname, '..', 'assets', 'js', 'tag-cloud-drawer.js');

  assert.ok(fs.existsSync(cssPath), 'CSS file should exist');
  assert.ok(fs.existsSync(jsPath), 'JS file should exist');

  const css = fs.readFileSync(cssPath, 'utf8');
  assert.ok(css.includes('.tag-cloud-drawer'), 'Contains drawer');
  assert.ok(css.includes('.tier-4'), 'Contains tier 4 sizing');
});

test('TagCloudManager calculates frequencies and tiers properly', (t) => {
  const { TagCloudManager } = require('../assets/js/tag-cloud-drawer.js');
  const mgr = new TagCloudManager();

  const mockGames = [
    { title: 'A', tags: ['retro', 'arcade'] },
    { title: 'B', tags: ['retro', 'action'] },
    { title: 'C', tags: ['retro'] },
    { title: 'D', tags: ['puzzle'] }
  ];

  const freqs = mgr.calculateFrequencies(mockGames);
  assert.strictEqual(freqs.get('retro'), 3);
  assert.strictEqual(freqs.get('arcade'), 1);
  assert.strictEqual(freqs.get('puzzle'), 1);

  assert.strictEqual(mgr.getTier(3, 3), 'tier-4');
  assert.strictEqual(mgr.getTier(1, 3), 'tier-2');
});
