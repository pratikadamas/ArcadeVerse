const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const studio = require('../assets/js/arcade-wallpaper-generator.js');
const registry = vm.runInNewContext(fs.readFileSync(require.resolve('../assets/js/games-registry.js'), 'utf8') + '\nGAMES_REGISTRY', { window: {} });
function random(seed) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
test('selects exactly 24 distinct actual catalog games without changing the source', () => {
  const before = JSON.stringify(registry), result = studio.selectGames(registry, random(42));
  assert.equal(result.length, 24); assert.equal(new Set(result.map(g => g.id)).size, 24);
  for (const game of result) assert.equal(registry.some(item => item.id === game.id && item.title === game.title && item.lucideIcon === game.lucideIcon), true);
  assert.equal(JSON.stringify(registry), before); result[0].title = 'separate copy'; assert.equal(JSON.stringify(registry), before);
});
test('seeded mixes reproduce while different seeds change the selection', () => {
  const ids = seed => studio.selectGames(registry, random(seed)).map(g => g.id);
  assert.deepEqual(ids(20), ids(20)); assert.notDeepEqual(ids(20), ids(21)); assert.notDeepEqual(ids(20), registry.slice(0, 24).map(g => g.id));
});
test('duplicates and malformed metadata cannot meet the distinct-card minimum', () => {
  const source = Array.from({ length: 24 }, (_, i) => ({ id: 'id-' + i, title: 'Game ' + i, category: 'Arcade', lucideIcon: 'gamepad-2' }));
  assert.equal(studio.selectGames([...source, source[0], null, {}, { id: 'x', title: '' }], random(1)).length, 24);
  assert.throws(() => studio.selectGames(Array(30).fill(source[0])), /24 distinct/);
  assert.throws(() => studio.selectGames(source.slice(0, 23)), /24 distinct/);
  for (const value of [null, {}, 'catalog']) assert.throws(() => studio.selectGames(value), /catalog/);
});
test('sanitizes icon names and bounds optional category text', () => {
  const source = Array.from({ length: 24 }, (_, i) => ({ id: String(i), title: 'Game', category: '<'.repeat(100), lucideIcon: '<svg onload=alert(1)>' }));
  for (const game of studio.selectGames(source, random(2))) { assert.equal(game.lucideIcon, 'gamepad-2'); assert.equal(game.category.length, 80); }
});
test('invalid random values fail rather than producing missing or duplicated cards', () => {
  for (const value of [NaN, Infinity, -1, 1, '0.5']) assert.throws(() => studio.selectGames(registry, () => value), /random mix/);
});
test('all three native resolutions contain 24 nonoverlapping complete cards', () => {
  const expected = { desktop: [1920, 1080], uhd: [3840, 2160], phone: [1080, 1920] };
  for (const [size, dimensions] of Object.entries(expected)) {
    const shape = studio.layout(size); assert.deepEqual([shape.width, shape.height], dimensions); assert.equal(shape.cells.length, 24);
    for (const cell of shape.cells) { assert.ok(cell.x >= 0 && cell.y >= 0 && cell.w > 0 && cell.h > 0 && cell.x + cell.w <= shape.width && cell.y + cell.h <= shape.height); }
    for (let i = 0; i < 24; i++) for (let j = i + 1; j < 24; j++) {
      const a = shape.cells[i], b = shape.cells[j]; assert.ok(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
    }
  }
});
test('accepts only listed sizes, tints, integer intensity bounds and a boolean logo', () => {
  const good = { size: 'desktop', tint: 'synthwave', scanlines: 35, logo: true };
  for (const scanlines of [0, 100]) assert.deepEqual(studio.settings({ ...good, scanlines }), { ...good, scanlines });
  for (const patch of [{ size: '__proto__' }, { size: 'constructor' }, { size: '8k' }, { tint: '__proto__' }, { tint: 'blue' }, { scanlines: -1 }, { scanlines: 101 }, { scanlines: .1 }, { scanlines: '35' }, { scanlines: NaN }, { logo: 'false' }]) assert.throws(() => studio.settings({ ...good, ...patch }), /supported/);
  assert.throws(() => studio.settings(null)); assert.throws(() => studio.layout('__proto__')); assert.throws(() => studio.layout('unknown'));
});
