const test = require('node:test');
const assert = require('node:assert/strict');
const ShadowPuppetLighting = require('../assets/js/shadow-puppet-lighting.js');

test('ShadowPuppetLighting manages up to 4 simultaneous lights', () => {
  const lighting = new ShadowPuppetLighting({ maxLights: 4 });
  const l1 = lighting.addLight(100, 100, 200, '#00dfd8');
  const l2 = lighting.addLight(200, 100, 200, '#ff0055');
  const l3 = lighting.addLight(300, 100, 200, '#ffcc00');
  const l4 = lighting.addLight(400, 100, 200, '#00ffcc');
  const l5 = lighting.addLight(500, 100, 200, '#ffffff'); // Evicts oldest

  assert.equal(lighting.lights.length, 4);
  assert.equal(lighting.lights[0].id, l2.id);
});

test('ShadowPuppetLighting computes shadow volume projections', () => {
  const lighting = new ShadowPuppetLighting();
  const light = { x: 50, y: 50 };
  const p1 = { x: 100, y: 50 };
  const p2 = { x: 100, y: 100 };

  let drew = false;
  const mockCtx = {
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    closePath: () => {},
    fill: () => { drew = true; }
  };

  lighting.projectShadowVolume(mockCtx, light, p1, p2);
  assert.equal(drew, true);
});
