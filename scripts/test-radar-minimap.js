const test = require('node:test');
const assert = require('node:assert/strict');
const RadarMinimap = require('../assets/js/radar-minimap.js');

test('RadarMinimap projects entity coordinates into radar radius', () => {
  const radar = new RadarMinimap({
    radarRadius: 100,
    worldRange: 1000,
    zoom: 1.0
  });
  radar.setPlayerPosition(0, 0);

  // Target at (500, 0) -> halfway to maxRange (1000)
  const proj = radar.projectCoordinate(500, 0);
  assert.equal(proj.isOffscreen, false);
  assert.equal(proj.x, 50);
  assert.equal(proj.y, 0);
});

test('RadarMinimap clamps off-screen target indicators to outer perimeter ring', () => {
  const radar = new RadarMinimap({
    radarRadius: 100,
    worldRange: 1000,
    zoom: 1.0
  });
  radar.setPlayerPosition(0, 0);

  // Target at (2500, 0) -> outside worldRange (1000)
  const proj = radar.projectCoordinate(2500, 0);
  assert.equal(proj.isOffscreen, true);
  assert.equal(proj.x, 100);
  assert.equal(proj.y, 0);
});
