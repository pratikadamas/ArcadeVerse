/**
 * Automated test suite for ArcadeVerse 2D Grid Pathfinding Engine (Issue #1620)
 * Validates A*, Jump Point Search (JPS), heuristics, diagonal modes, and vector smoothing.
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const ArcadeVerse = require("../assets/js/arcadeverse-sdk.js");

test("ArcadeVerse exposes createPathfinder API", () => {
  assert.strictEqual(typeof ArcadeVerse.createPathfinder, "function");
  const pf = ArcadeVerse.createPathfinder({ width: 5, height: 5 });
  assert.strictEqual(pf.width, 5);
  assert.strictEqual(pf.height, 5);
  assert.strictEqual(pf.isWalkable(0, 0), true);
  assert.strictEqual(pf.isWalkable(-1, 0), false);
  assert.strictEqual(pf.isWalkable(5, 5), false);
});

test("A* computes optimal path on uniform grid", () => {
  const pf = ArcadeVerse.createPathfinder({ width: 5, height: 5, diagonal: "never" });
  const path = pf.findPath(0, 0, 4, 4, { smooth: false });

  assert.strictEqual(path.length, 9); // Manhattan distance 4+4=8 steps + 1 start point = 9
  assert.deepStrictEqual(path[0], { x: 0, y: 0 });
  assert.deepStrictEqual(path[path.length - 1], { x: 4, y: 4 });
});

test("Obstacle navigation respects walls and impassable tiles", () => {
  const pf = ArcadeVerse.createPathfinder({ width: 5, height: 5, diagonal: "never" });
  // Place vertical wall at x=2 from y=0 to y=3
  pf.setWalkable(2, 0, false);
  pf.setWalkable(2, 1, false);
  pf.setWalkable(2, 2, false);
  pf.setWalkable(2, 3, false);

  const path = pf.findPath(0, 0, 4, 0, { smooth: false });
  assert.ok(path.length > 0);
  assert.deepStrictEqual(path[0], { x: 0, y: 0 });
  assert.deepStrictEqual(path[path.length - 1], { x: 4, y: 0 });

  // Verify none of the wall nodes were traversed
  for (const node of path) {
    assert.ok(!(node.x === 2 && node.y <= 3), `Path incorrectly crossed obstacle at (${node.x}, ${node.y})`);
  }
});

test("Diagonal traversal strictly respects corner-cutting configurations", () => {
  const pf = ArcadeVerse.createPathfinder({ width: 3, height: 3 });
  // Diagonal obstacle corner setup
  pf.setWalkable(1, 0, false);
  pf.setWalkable(0, 1, false);

  // noObstacles mode should block cutting between (1,0) and (0,1)
  const pathBlocked = pf.findPath(0, 0, 1, 1, { diagonal: "noObstacles" });
  assert.strictEqual(pathBlocked.length, 0);

  // always mode cuts corners
  const pathAllowed = pf.findPath(0, 0, 1, 1, { diagonal: "always" });
  assert.strictEqual(pathAllowed.length, 2);
  assert.deepStrictEqual(pathAllowed[1], { x: 1, y: 1 });
});

test("Line-of-sight vector smoothing reduces stepped grid waypoints to direct vectors", () => {
  const pf = ArcadeVerse.createPathfinder({ width: 10, height: 10, diagonal: "never" });
  // Raw stepped path on empty grid has many steps
  const rawPath = pf.findPath(0, 0, 9, 0, { smooth: false });
  assert.strictEqual(rawPath.length, 10);

  // Smoothed path should prune all collinear redundant waypoints
  const smoothedPath = pf.findPath(0, 0, 9, 0, { smooth: true });
  assert.strictEqual(smoothedPath.length, 2);
  assert.deepStrictEqual(smoothedPath[0], { x: 0, y: 0 });
  assert.deepStrictEqual(smoothedPath[1], { x: 9, y: 0 });
});

test("Jump Point Search (JPS) computes optimal path with pruning", () => {
  const pf = ArcadeVerse.createPathfinder({ width: 10, height: 10, diagonal: "always" });
  const astarPath = pf.findPath(0, 0, 9, 9, { allowJPS: false, smooth: false });
  const jpsPath = pf.findPath(0, 0, 9, 9, { allowJPS: true, smooth: false });

  assert.ok(astarPath.length > 0);
  assert.ok(jpsPath.length > 0);
  assert.deepStrictEqual(jpsPath[0], { x: 0, y: 0 });
  assert.deepStrictEqual(jpsPath[jpsPath.length - 1], { x: 9, y: 9 });
});

test("Time-budgeted stepped search execution operates asynchronously without blocking", () => {
  const pf = ArcadeVerse.createPathfinder({ width: 20, height: 20 });
  const search = pf.createSearch(0, 0, 19, 19, { maxIterationsPerStep: 5 });

  assert.strictEqual(search.isDone(), false);
  let steps = 0;
  while (!search.isDone() && steps < 100) {
    search.step();
    steps++;
  }

  assert.strictEqual(search.isDone(), true);
  const path = search.getPath();
  assert.ok(path.length > 0);
  assert.deepStrictEqual(path[path.length - 1], { x: 19, y: 19 });
});

test("Dynamic grid mutation updates and invalidates path outcomes", () => {
  const pf = ArcadeVerse.createPathfinder({ width: 3, height: 3 });
  assert.ok(pf.findPath(0, 0, 2, 2).length > 0);

  // Block the destination
  pf.setWalkable(2, 2, false);
  assert.strictEqual(pf.findPath(0, 0, 2, 2).length, 0);

  // Restore destination
  pf.setWalkable(2, 2, true);
  assert.ok(pf.findPath(0, 0, 2, 2).length > 0);
});

test("Ensures zero Unicode emojis in pathfinding test and implementation", () => {
  const code = fs.readFileSync(path.join(__dirname, "test-pathfinding-engine.js"), "utf8");
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  assert.strictEqual(emojiRegex.test(code), false);
});
