const test = require('node:test');
const assert = require('node:assert/strict');
const SpriteAtlasAnimator = require('../assets/js/sprite-atlas-animator.js');

test('SpriteAtlasAnimator generates uniform grid slices correctly', () => {
  const animator = new SpriteAtlasAnimator({
    frameWidth: 16,
    frameHeight: 16,
    columns: 4,
    rows: 2
  });

  assert.equal(animator.slices.length, 8);
  assert.deepEqual(animator.slices[0], { x: 0, y: 0, width: 16, height: 16 });
  assert.deepEqual(animator.slices[5], { x: 16, y: 16, width: 16, height: 16 });
});

test('SpriteAtlasAnimator transitions multi-track animations with delta time', () => {
  const animator = new SpriteAtlasAnimator({ columns: 4, rows: 2 });
  animator.defineTrack('walk', [0, 1, 2, 3], { fps: 10, loop: true });

  animator.play('walk');
  assert.equal(animator.currentFrameIndex, 0);

  // Advance by 150ms at 10 FPS (1 frame every 100ms)
  animator.update(150);
  assert.equal(animator.currentFrameIndex, 1);

  // Advance by 300ms
  animator.update(300);
  // Total elapsed: 450ms -> frame 4 wrapped -> frame 0
  assert.equal(animator.currentFrameIndex, 0);
});

test('SpriteAtlasAnimator respects non-looping tracks with onComplete callback', () => {
  const animator = new SpriteAtlasAnimator({ columns: 4, rows: 1 });
  let completed = false;
  animator.defineTrack('die', [0, 1], {
    fps: 10,
    loop: false,
    onComplete: () => { completed = true; }
  });

  animator.play('die');
  animator.update(300);

  assert.equal(completed, true);
  assert.equal(animator.currentFrameIndex, 1);
  assert.equal(animator.isPaused, true);
});
