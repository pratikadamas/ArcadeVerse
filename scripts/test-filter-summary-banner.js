const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Filter summary banner styles and logic exist', (t) => {
  const cssPath = path.join(__dirname, '..', 'assets', 'css', 'filter-summary-banner.css');
  const jsPath = path.join(__dirname, '..', 'assets', 'js', 'filter-summary-banner.js');

  assert.ok(fs.existsSync(cssPath), 'CSS file should exist');
  assert.ok(fs.existsSync(jsPath), 'JS file should exist');

  const css = fs.readFileSync(cssPath, 'utf8');
  assert.ok(css.includes('.active-filters-bar'), 'Includes active filters bar');
  assert.ok(css.includes('.empty-results-banner'), 'Includes empty banner');
});

test('FilterSummaryManager tracks and clears active filter states', (t) => {
  const { FilterSummaryManager } = require('../assets/js/filter-summary-banner.js');
  const mgr = new FilterSummaryManager();

  assert.strictEqual(mgr.hasActiveFilters(), false, 'Initially has no active filters');

  mgr.setFilter('category', 'retro');
  assert.strictEqual(mgr.hasActiveFilters(), true);
  assert.strictEqual(mgr.activeFilters.category, 'retro');

  mgr.setFilter('search', 'pac');
  assert.strictEqual(mgr.activeFilters.search, 'pac');

  mgr.removeFilter('category');
  assert.strictEqual(mgr.activeFilters.category, '');
  assert.strictEqual(mgr.hasActiveFilters(), true);

  mgr.clearAll();
  assert.strictEqual(mgr.hasActiveFilters(), false);
});
