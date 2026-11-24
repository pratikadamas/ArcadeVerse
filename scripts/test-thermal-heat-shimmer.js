const test = require('node:test');
const assert = require('node:assert');
const { ThermalHeatShimmerFilter } = require('../assets/js/thermal-heat-shimmer.js');

test('ThermalHeatShimmerFilter calculates sinusoidal scanline displacement', () => {
  const filter = new ThermalHeatShimmerFilter({ intensity: 5.0, frequency: 0.1 });
  const disp1 = filter.calculateDisplacement(10, 1000);
  const disp2 = filter.calculateDisplacement(20, 1000);

  assert.ok(typeof disp1 === 'number');
  assert.ok(Math.abs(disp1) <= 5.0);
  assert.notStrictEqual(disp1, disp2, 'Different y coordinates should produce phase-offset displacements');
});

test('ThermalHeatShimmerFilter manages localized heat emitter zones', () => {
  const filter = new ThermalHeatShimmerFilter();
  const zone = filter.createHeatZone(100, 200, 300, 150, 8.0);

  assert.strictEqual(filter.zones.length, 1);
  assert.strictEqual(zone.x, 100);
  assert.strictEqual(zone.y, 200);
  assert.strictEqual(zone.width, 300);
  assert.strictEqual(zone.height, 150);
  assert.strictEqual(zone.intensity, 8.0);

  filter.clearZones();
  assert.strictEqual(filter.zones.length, 0);
});

test('ThermalHeatShimmerFilter handles multiple concurrent heat emitters', () => {
  const filter = new ThermalHeatShimmerFilter();
  filter.createHeatZone(0, 0, 100, 100, 3.0);
  filter.createHeatZone(200, 200, 150, 150, 6.0);
  assert.strictEqual(filter.zones.length, 2);
});
