const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Software 3D engine CSS and JS files exist', (t) => {
  const cssPath = path.join(__dirname, '..', 'assets', 'css', 'software-3d-engine.css');
  const jsPath = path.join(__dirname, '..', 'assets', 'js', 'software-3d-engine.js');

  assert.ok(fs.existsSync(cssPath), 'CSS file should exist');
  assert.ok(fs.existsSync(jsPath), 'JS file should exist');

  const css = fs.readFileSync(cssPath, 'utf8');
  assert.ok(css.includes('.software-3d-container'), 'Contains container style');
  assert.ok(css.includes('.software-3d-hud'), 'Contains HUD style');
});

test('Software3DEngine calculates 3D rotation, perspective divide, and normal culling', (t) => {
  const { Software3DEngine } = require('../assets/js/software-3d-engine.js');
  const engine = new Software3DEngine(400, 300, { fov: 200, cameraDist: 4 });

  // Vertex rotation identity check
  const v0 = [1, 2, 3];
  const rotated = engine.rotateVertex(v0, 0, 0, 0);
  assert.strictEqual(rotated[0], 1);
  assert.strictEqual(rotated[1], 2);
  assert.strictEqual(rotated[2], 3);

  // Perspective projection divide check
  const p = engine.project([0, 0, 0]);
  assert.strictEqual(p.x, 200);
  assert.strictEqual(p.y, 150);

  // Normal culling check on XY face oriented forward vs backward
  const fV0 = [-1, -1, 0];
  const fV1 = [1, -1, 0];
  const fV2 = [1, 1, 0];
  const norm = engine.computeNormal(fV0, fV1, fV2);
  assert.ok(norm[2] > 0, 'Normal points along +Z');
});
