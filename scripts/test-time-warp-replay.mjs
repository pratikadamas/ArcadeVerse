import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../games/time-warp_mistu7debnath/game.js', import.meta.url), 'utf8');
// Expose the actual class only in this isolated test context; production has no test hooks.
const context = vm.createContext({ window: { addEventListener() {} }, performance: { now: () => 0 }, Math, requestAnimationFrame() {} });
// Evaluate a copy with the launch callback replaced by a class reference.
vm.runInContext(source.replace("window.addEventListener('DOMContentLoaded', () => {", 'window.GameClass = TimeWarpGame; window.addEventListener(\'DOMContentLoaded\', () => {'), context);
function game() {
  const g = Object.create(context.window.GameClass.prototype);
  const classes = { add() {}, remove() {} };
  Object.assign(g, { state: 'PLAYING', historyTime: 0, chamberElapsed: 0, historyBuffer: [],
    player: { x: 900, y: 500, vx: 0, vy: 0, facing: 1, grounded: true, width: 22, height: 34 },
    ghost: { active: false, frames: [], elapsed: 0, cursor: 0, width: 22, height: 34 },
    sound: { playBlip() {}, playGhostSpawn() {}, playRewindTick() {}, playSwitch() {}, playDoor() {} },
    particles: { emit() {}, clear() {} }, hudGhostStatus: {}, hudGhostPill: { classList: classes },
    input: { keys: { rewind: false }, reset() {} }, rewindEnergy: 6, maxRewindEnergy: 6, rewindsUsedInChamber: 0,
    updateHud() {} });
  return g;
}
function record(g) {
  // A 2-second path with a stationary period over a pressure plate.
  for (let i = 0; i <= 120; i++) {
    g.player.x = i < 30 ? i * 2 : i < 90 ? 60 : 60 + (i - 90) * 2;
    g.player.y = 100; g.recordSnapshot(1 / 60);
  }
  g.triggerGhostAction(); g.player.x = 900; g.player.y = 500;
}
for (const hz of [30, 60, 120, 144, 240]) {
  test(`timestamp interpolation and plate timing at ${hz} Hz`, () => {
    const g = game(); record(g);
    g.levelData = { plates: [{ x: 60, y: 120, w: 20, h: 10, pressed: false, currentOffsetY: 0 }], doors: [] };
    for (let tick = 1; tick <= hz * 2; tick++) {
      g.updateGhost(1 / hz); const elapsed = tick / hz;
      const expected = elapsed < .5 ? elapsed * 120 : elapsed < 1.5 ? 60 : 60 + (elapsed - 1.5) * 120;
      assert.ok(Math.abs(g.ghost.x - expected) < 1e-6, `position at ${elapsed}`);
      g.updatePuzzles(1 / hz);
      if (elapsed > .55 && elapsed < 1.45) assert.equal(g.levelData.plates[0].pressed, true);
    }
    assert.ok(Math.abs(g.ghost.x - 120) < 1e-6); assert.equal(g.ghost.active, true);
    g.updateGhost(1 / hz); assert.equal(g.ghost.active, false);
  });
}
test('irregular elapsed updates interpolate instead of consuming one snapshot per call', () => {
  const g = game(); record(g); for (const dt of [.013, .07, .017, .2, .1]) g.updateGhost(dt);
  assert.ok(Math.abs(g.ghost.x - 48) < 1e-6);
});
test('paused update does not advance playback, and restart clears its timeline', () => {
  const g = game(); record(g); g.updateGhost(.25); g.state = 'PAUSED'; g.update(5);
  assert.equal(g.ghost.elapsed, .25); g.startLevel(0);
  assert.equal(g.ghost.active, false); assert.equal(g.ghost.frames.length, 0); assert.equal(g.ghost.elapsed, 0); assert.equal(g.historyTime, 0);
});
test('rewind restores recording clock and new snapshots stay ordered without wall-time gaps', () => {
  const g = game(); record(g); g.chamberElapsed = 500;
  g.stepRewind(1 / 60); g.recordSnapshot(1 / 60);
  const tail = g.historyBuffer.slice(-2);
  assert.ok(tail[1].timestamp > tail[0].timestamp); assert.ok(tail[1].timestamp - tail[0].timestamp < .04);
  assert.ok(tail[1].timestamp < 3); assert.equal(tail[1].time, 500);
});
test('ghost owns detached snapshots and replacement resets cursor/elapsed', () => {
  const g = game(); record(g); const x = g.ghost.frames[0].x;
  g.historyBuffer[0].x = 999; assert.equal(g.ghost.frames[0].x, x);
  g.updateGhost(.5); g.triggerGhostAction(); assert.equal(g.ghost.elapsed, 0); assert.equal(g.ghost.cursor, 0);
});
test('history and selected replay are bounded by six and five simulation seconds', () => {
  const g = game(); for (let i = 0; i < 900; i++) g.recordSnapshot(1 / 60);
  assert.equal(g.historyBuffer.length, 360); g.triggerGhostAction(); assert.ok(g.ghost.maxDuration <= 5 + 1e-9);
});
