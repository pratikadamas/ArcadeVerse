const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Spotlight Ribbon styles and logic files exist', (t) => {
  const cssPath = path.join(__dirname, '..', 'assets', 'css', 'spotlight-ribbon.css');
  const jsPath = path.join(__dirname, '..', 'assets', 'js', 'spotlight-ribbon.js');

  assert.ok(fs.existsSync(cssPath), 'CSS file should exist');
  assert.ok(fs.existsSync(jsPath), 'JS file should exist');

  const css = fs.readFileSync(cssPath, 'utf8');
  assert.ok(css.includes('.game-spotlight-ribbon'), 'Contains ribbon class');
  assert.ok(css.includes('.ribbon-featured'), 'Contains featured ribbon');
  assert.ok(css.includes('.ribbon-new'), 'Contains new ribbon');
});

test('SpotlightRibbonManager correctly categorizes game status', (t) => {
  const { SpotlightRibbonManager } = require('../assets/js/spotlight-ribbon.js');
  const mgr = new SpotlightRibbonManager({ newThresholdDays: 10, hotPlaysThreshold: 200 });

  const featuredGame = { title: 'Galaga', featured: true };
  assert.strictEqual(mgr.determineRibbonType(featuredGame)?.type, 'featured');

  const recentDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const newGame = { title: 'Space Racer', dateAdded: recentDate };
  assert.strictEqual(mgr.determineRibbonType(newGame)?.type, 'new');

  const hotGame = { title: 'Snake', plays: 450 };
  assert.strictEqual(mgr.determineRibbonType(hotGame)?.type, 'hot');

  const regularGame = { title: 'Pong', plays: 10, dateAdded: '2020-01-01' };
  assert.strictEqual(mgr.determineRibbonType(regularGame), null);
});
