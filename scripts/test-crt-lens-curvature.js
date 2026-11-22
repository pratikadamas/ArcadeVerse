const test = require('node:test');
const assert = require('node:assert/strict');
const CrtLensCurvature = require('../assets/js/crt-lens-curvature.js');

test('CrtLensCurvature preserves exact center and bulges outward at edges', () => {
  const crt = new CrtLensCurvature({ distortionK: 0.2 });

  // Center (0.5, 0.5) has r = 0, so distortion must leave it at (0.5, 0.5)
  const center = crt.distortCoordinate(0.5, 0.5);
  assert.equal(center.x, 0.5);
  assert.equal(center.y, 0.5);

  // Outer corner (1.0, 1.0) has r^2 = 2.0, so factor = 1.0 + 0.2 * 2 = 1.4
  const corner = crt.distortCoordinate(1.0, 1.0);
  assert.ok(corner.x > 1.0);
  assert.ok(corner.y > 1.0);
});

test('CrtLensCurvature applies CSS 3D fallback styling safely', () => {
  const crt = new CrtLensCurvature();
  const mockEl = { style: {} };
  crt.applyCssBarrelDistortion(mockEl);
  assert.ok(mockEl.style.borderRadius);
  assert.ok(mockEl.style.boxShadow);
});
