const test = require('node:test');
const assert = require('node:assert/strict');
const ParallaxNebula = require('../assets/js/parallax-nebula.js');

function createMockCanvas(width, height) {
  const imageData = {
    data: new Uint8ClampedArray(width * height * 4)
  };
  return {
    width: width || 800,
    height: height || 600,
    clientWidth: width || 800,
    clientHeight: height || 600,
    getContext: () => ({
      fillRect: () => {},
      drawImage: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      arc: () => {},
      fill: () => {},
      save: () => {},
      restore: () => {},
      createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      putImageData: () => {}
    }),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 })
  };
}

test('ParallaxNebula initializes with 3 depth layers and star density', () => {
  const canvas = createMockCanvas(800, 600);
  const nebula = new ParallaxNebula(canvas, { starCount: 150 });

  assert.equal(nebula.stars.length, 150);
  const layers = new Set(nebula.stars.map(s => s.layer));
  assert.ok(layers.has(0), 'Layer 0 should exist');
  assert.ok(layers.has(1), 'Layer 1 should exist');
  assert.ok(layers.has(2), 'Layer 2 should exist');
  nebula.destroy();
});

test('ParallaxNebula calculates procedural noise nebula gas clouds without external assets', () => {
  const canvas = createMockCanvas(320, 240);
  const nebula = new ParallaxNebula(canvas, { nebulaEnabled: true });

  nebula.renderNebulaBuffer(100);
  assert.ok(nebula.nebulaCanvas.width > 0);
  assert.ok(nebula.nebulaCanvas.height > 0);
  nebula.destroy();
});

test('ParallaxNebula respects prefers-reduced-motion freezing drift', () => {
  const canvas = createMockCanvas(400, 300);
  const nebula = new ParallaxNebula(canvas);
  nebula.reducedMotion = true;

  const initialTime = nebula.time;
  nebula.update(50);
  assert.equal(nebula.time, initialTime, 'Time should freeze under reduced motion');
  nebula.destroy();
});
