const test = require('node:test');
const assert = require('node:assert');
const PixelModule = require('../assets/js/pixel-sprite-editor.js');

test('PixelModule exports required classes and palette', () => {
  assert.ok(Array.isArray(PixelModule.PALETTE), 'Should export PALETTE array');
  assert.ok(PixelModule.SpriteBuffer, 'Should export SpriteBuffer class');
  assert.ok(PixelModule.EditorEngine, 'Should export EditorEngine class');
  assert.ok(typeof PixelModule.createStudio === 'function', 'Should export createStudio factory');
});

test('SpriteBuffer sets, gets, and clamps coordinates properly', () => {
  const buf = new PixelModule.SpriteBuffer(16);
  assert.strictEqual(buf.get(5, 5), null);

  buf.set(5, 5, '#ff0000');
  assert.strictEqual(buf.get(5, 5), '#ff0000');

  // Out of bounds get and set should not throw
  buf.set(-1, 20, '#00ff00');
  assert.strictEqual(buf.get(-1, 20), null);
});

test('SpriteBuffer floodFill fills contiguous regions accurately', () => {
  const buf = new PixelModule.SpriteBuffer(8);

  // Paint a 3x3 box in center
  for (let y = 2; y <= 4; y++) {
    for (let x = 2; x <= 4; x++) {
      buf.set(x, y, '#ffffff');
    }
  }

  // Flood fill the box with blue
  buf.floodFill(3, 3, '#ffffff', '#0000ff');

  assert.strictEqual(buf.get(3, 3), '#0000ff');
  assert.strictEqual(buf.get(2, 2), '#0000ff');
  assert.strictEqual(buf.get(4, 4), '#0000ff');
  assert.strictEqual(buf.get(0, 0), null); // Unfilled region remains untouched
});

test('EditorEngine executes mirror drawing symmetry', () => {
  const engine = new PixelModule.EditorEngine(16);
  engine.mirrorX = true;
  engine.currentColor = '#ffff00';

  engine.applyTool(2, 5);

  assert.strictEqual(engine.buffer.get(2, 5), '#ffff00');
  assert.strictEqual(engine.buffer.get(13, 5), '#ffff00'); // 16 - 1 - 2 = 13
});

test('EditorEngine maintains undo/redo history stack integrity', () => {
  const engine = new PixelModule.EditorEngine(16);
  engine.currentColor = '#ff004d';

  engine.applyTool(0, 0);
  engine.pushHistory();

  engine.applyTool(1, 1);
  engine.pushHistory();

  assert.strictEqual(engine.buffer.get(0, 0), '#ff004d');
  assert.strictEqual(engine.buffer.get(1, 1), '#ff004d');

  engine.undo();
  assert.strictEqual(engine.buffer.get(0, 0), '#ff004d');
  assert.strictEqual(engine.buffer.get(1, 1), null);

  engine.redo();
  assert.strictEqual(engine.buffer.get(1, 1), '#ff004d');
});

test('SpriteBuffer generates valid CSS box-shadow code omitting transparent cells', () => {
  const buf = new PixelModule.SpriteBuffer(4);
  buf.set(0, 0, '#000000');
  buf.set(3, 3, '#ffffff');

  const css = buf.toBoxShadowString(10);
  assert.ok(css.includes('box-shadow:'), 'Should produce box-shadow property');
  assert.ok(css.includes('10px 10px #000000'), 'Should contain pixel (0,0) offset');
  assert.ok(css.includes('40px 40px #ffffff'), 'Should contain pixel (3,3) offset');
  assert.ok(!css.includes('20px 20px'), 'Should omit unpainted cells');
});
