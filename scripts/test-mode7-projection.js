const test = require('node:test');
const assert = require('node:assert/strict');
const Mode7Module = require('../assets/js/mode7-projection.js');

test('Mode7Renderer calculates scanline perspective and affine mapping', () => {
  const renderer = Mode7Module.createRenderer(null, {
    width: 320,
    height: 240,
    cameraZ: 40,
    fov: 200,
    horizonY: 80,
    cameraX: 100,
    cameraY: 100
  });

  // Points on or above horizon return null
  assert.equal(renderer.calculateScanline(50), null);
  assert.equal(renderer.calculateScanline(80), null);

  // Scanline below horizon calculates finite positive distance and step scales
  const scan = renderer.calculateScanline(120);
  assert.ok(scan !== null);
  assert.ok(scan.distance > 0);
  assert.ok(Number.isFinite(scan.startX));
  assert.ok(Number.isFinite(scan.stepX));
});

test('Mode7Renderer generates procedural texture without external assets', () => {
  const renderer = Mode7Module.createRenderer(null, { textureWidth: 64, textureHeight: 64 });
  const tex = renderer.generateProceduralTexture();

  assert.equal(tex.length, 64 * 64 * 4);
  assert.equal(renderer.textureBuffer.length, 64 * 64 * 4);
});
