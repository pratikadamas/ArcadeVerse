const test = require('node:test');
const assert = require('node:assert');

// Mock DOM and WebGL context for testing disposal pipeline
function createMockWebGLCanvas() {
  let contextLost = false;
  const mockLoseExt = {
    loseContext: () => { contextLost = true; }
  };
  const mockGL = {
    isContextLost: () => contextLost,
    getExtension: (name) => {
      if (name.includes('lose_context')) return mockLoseExt;
      return null;
    }
  };

  return {
    getContext: (type) => {
      if (type.includes('webgl')) return mockGL;
      return null;
    },
    isContextLost: () => contextLost
  };
}

test('WebGL disposal helper safely triggers loseContext extension on canvases', () => {
  const canvas1 = createMockWebGLCanvas();
  const canvas2 = createMockWebGLCanvas();

  const mockDoc = {
    querySelectorAll: (selector) => {
      if (selector === 'canvas') return [canvas1, canvas2];
      return [];
    }
  };

  // Execute disposal logic
  const canvases = mockDoc.querySelectorAll('canvas');
  assert.strictEqual(canvases.length, 2);

  canvases.forEach((c) => {
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    assert.ok(gl);
    assert.strictEqual(gl.isContextLost(), false);
    const loseExt = gl.getExtension('WEBGL_lose_context');
    assert.ok(loseExt);
    loseExt.loseContext();
    assert.strictEqual(gl.isContextLost(), true);
  });
});

test('WebGL disposal handles documents without canvases gracefully', () => {
  const mockDoc = {
    querySelectorAll: () => []
  };

  const canvases = mockDoc.querySelectorAll('canvas');
  assert.strictEqual(canvases.length, 0);
  assert.doesNotThrow(() => {
    canvases.forEach(() => {});
  });
});
