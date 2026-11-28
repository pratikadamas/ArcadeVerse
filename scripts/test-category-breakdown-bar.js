const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Category breakdown bar styles and script exist', (t) => {
  const cssPath = path.join(__dirname, '..', 'assets', 'css', 'category-breakdown-bar.css');
  const jsPath = path.join(__dirname, '..', 'assets', 'js', 'category-breakdown-bar.js');

  assert.ok(fs.existsSync(cssPath), 'CSS file should exist');
  assert.ok(fs.existsSync(jsPath), 'JS file should exist');

  const css = fs.readFileSync(cssPath, 'utf8');
  assert.ok(css.includes('.breakdown-segmented-bar'), 'Contains segmented bar');
  assert.ok(css.includes('.breakdown-legend-item'), 'Contains legend item');
});

test('CategoryBreakdownManager accurately calculates counts and percentages', (t) => {
  const { CategoryBreakdownManager } = require('../assets/js/category-breakdown-bar.js');

  const mockGames = [
    { title: 'G1', category: 'arcade' },
    { title: 'G2', category: 'arcade' },
    { title: 'G3', category: 'action' },
    { title: 'G4', category: 'puzzle' }
  ];

  const breakdown = CategoryBreakdownManager.calculateBreakdown(mockGames);
  assert.strictEqual(breakdown.total, 4);
  assert.strictEqual(breakdown.categories[0].name, 'arcade');
  assert.strictEqual(breakdown.categories[0].count, 2);
  assert.strictEqual(breakdown.categories[0].percentage, 50);
});
