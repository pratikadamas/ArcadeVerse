const test = require('node:test');
const assert = require('node:assert/strict');
const IsoHeightmap = require('../assets/js/iso-heightmap.js');

test('IsoHeightmap projects grid coordinates to isometric screen space', () => {
  const iso = new IsoHeightmap({ originX: 200, originY: 100, tileWidth: 32, tileHeight: 16 });
  const p0 = iso.gridToScreen(0, 0, 0);
  assert.equal(p0.x, 200);
  assert.equal(p0.y, 100);

  const p1 = iso.gridToScreen(1, 0, 0);
  assert.equal(p1.x, 216); // 200 + 16
  assert.equal(p1.y, 108); // 100 + 8
});

test('IsoHeightmap performs inverse screen-to-grid affine picking', () => {
  const iso = new IsoHeightmap({ originX: 200, originY: 100, tileWidth: 32, tileHeight: 16 });
  const grid = iso.screenToGrid(200, 100);
  assert.equal(grid.gridX, 0);
  assert.equal(grid.gridY, 0);
});
