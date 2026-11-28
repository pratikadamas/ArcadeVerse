const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ArcadeVerse = require("../assets/js/arcadeverse-sdk.js");

test("SDK exposes createQuadtree and createSpatialHashGrid APIs", () => {
  assert.strictEqual(typeof ArcadeVerse.createQuadtree, "function", "createQuadtree must be a function");
  assert.strictEqual(typeof ArcadeVerse.createSpatialHashGrid, "function", "createSpatialHashGrid must be a function");
});

test("Loose Quadtree correctly indexes entities and queries AABB with zero false negatives", () => {
  const qt = ArcadeVerse.createQuadtree({ minX: 0, minY: 0, maxX: 1000, maxY: 1000 }, {
    beta: 1.5,
    maxEntitiesPerNode: 4,
    maxDepth: 4
  });

  const e1 = { id: 1, minX: 10, minY: 10, maxX: 30, maxY: 30 };
  const e2 = { id: 2, minX: 50, minY: 50, maxX: 70, maxY: 70 };
  const e3 = { id: 3, minX: 600, minY: 600, maxX: 650, maxY: 650 };
  const e4 = { id: 4, minX: 900, minY: 900, maxX: 950, maxY: 950 };

  qt.insert(e1);
  qt.insert(e2);
  qt.insert(e3);
  qt.insert(e4);

  assert.strictEqual(qt.size(), 4, "Total entity count must equal 4");

  const results = qt.queryAABB(0, 0, 100, 100);
  assert.strictEqual(results.length, 2, "Should find 2 entities in [0, 0, 100, 100]");
  const ids = results.map(e => e.id).sort();
  assert.deepStrictEqual(ids, [1, 2]);

  const farResults = qt.queryAABB(800, 800, 1000, 1000);
  assert.strictEqual(farResults.length, 1);
  assert.strictEqual(farResults[0].id, 4);
});

test("Loose Quadtree expansion factor prevents boundary entities from redundant root promotion", () => {
  const qt = ArcadeVerse.createQuadtree({ minX: 0, minY: 0, maxX: 1000, maxY: 1000 }, {
    beta: 1.5,
    maxEntitiesPerNode: 2,
    maxDepth: 3
  });

  for (let i = 0; i < 5; i++) {
    qt.insert({ id: "nw_" + i, minX: 50 + i * 10, minY: 50 + i * 10, maxX: 60 + i * 10, maxY: 60 + i * 10 });
  }

  const boundaryEntity = { id: "boundary", minX: 490, minY: 200, maxX: 520, maxY: 230 };
  qt.insert(boundaryEntity);

  const queryRes = qt.queryAABB(480, 190, 530, 240);
  assert.ok(queryRes.some(e => e.id === "boundary"), "Boundary entity must be retrievable");
});

test("Quadtree circle query and raycast query accuracy", () => {
  const qt = ArcadeVerse.createQuadtree({ minX: 0, minY: 0, maxX: 500, maxY: 500 });

  const target = { id: "centerTarget", x: 100, y: 100, width: 20, height: 20 };
  const offTarget = { id: "offTarget", x: 300, y: 300, width: 20, height: 20 };

  qt.insert(target);
  qt.insert(offTarget);

  const circleHits = qt.queryCircle(110, 110, 30);
  assert.strictEqual(circleHits.length, 1);
  assert.strictEqual(circleHits[0].id, "centerTarget");

  const rayHits = qt.queryRay(0, 110, 1, 0, 200);
  assert.strictEqual(rayHits.length, 1);
  assert.strictEqual(rayHits[0].id, "centerTarget");
});

test("Quadtree entity update, remove and zero-allocation reusable array", () => {
  const qt = ArcadeVerse.createQuadtree({ minX: 0, minY: 0, maxX: 800, maxY: 600 });
  const movingEntity = { id: "player", x: 50, y: 50, width: 20, height: 20 };

  qt.insert(movingEntity);
  assert.strictEqual(qt.size(), 1);

  movingEntity.x = 400;
  movingEntity.y = 300;
  qt.update(movingEntity);

  const reusableOut = [];
  qt.queryAABB(390, 290, 430, 330, reusableOut);
  assert.strictEqual(reusableOut.length, 1);
  assert.strictEqual(reusableOut[0].id, "player");

  qt.queryAABB(40, 40, 80, 80, reusableOut);
  assert.strictEqual(reusableOut.length, 0);

  qt.remove(movingEntity);
  assert.strictEqual(qt.size(), 0);
  qt.queryAABB(390, 290, 430, 330, reusableOut);
  assert.strictEqual(reusableOut.length, 0);
});

test("Spatial Hash Grid constant-time bucket insertion, retrieval and updates", () => {
  const grid = ArcadeVerse.createSpatialHashGrid(64);

  const bullets = [];
  for (let i = 0; i < 50; i++) {
    const b = { id: "bullet_" + i, x: i * 20, y: i * 20, width: 4, height: 4 };
    bullets.push(b);
    grid.insert(b);
  }

  assert.strictEqual(grid.size(), 50);

  const hits = grid.queryAABB(0, 0, 100, 100);
  assert.ok(hits.length >= 5, "Should find multiple bullets in early cells");

  const b0 = bullets[0];
  b0.x = 5000;
  b0.y = 5000;
  grid.update(b0);

  const newHits = grid.queryAABB(4990, 4990, 5010, 5010);
  assert.strictEqual(newHits.length, 1);
  assert.strictEqual(newHits[0].id, "bullet_0");

  grid.remove(b0);
  assert.strictEqual(grid.size(), 49);
  const afterRemove = grid.queryAABB(4990, 4990, 5010, 5010);
  assert.strictEqual(afterRemove.length, 0);

  grid.clear();
  assert.strictEqual(grid.size(), 0);
});

test("Spatial Hash Grid circle and raycast queries with zero GC allocation array", () => {
  const grid = ArcadeVerse.createSpatialHashGrid(32);
  const ent = { id: "beacon", x: 100, y: 100, width: 10, height: 10 };
  grid.insert(ent);

  const buffer = [];
  grid.queryCircle(105, 105, 15, buffer);
  assert.strictEqual(buffer.length, 1);
  assert.strictEqual(buffer[0].id, "beacon");

  grid.queryRay(50, 105, 1, 0, 100, buffer);
  assert.strictEqual(buffer.length, 1);
  assert.strictEqual(buffer[0].id, "beacon");
});

test("Stress benchmark verifies broadphase performance under 16ms budget", () => {
  const grid = ArcadeVerse.createSpatialHashGrid(64);
  const entities = [];
  const COUNT = 2500;

  for (let i = 0; i < COUNT; i++) {
    const e = {
      id: i,
      x: (i * 17) % 2000,
      y: (i * 29) % 2000,
      width: 10,
      height: 10
    };
    entities.push(e);
    grid.insert(e);
  }

  assert.strictEqual(grid.size(), COUNT);

  const out = [];
  const start = performance.now();
  for (let q = 0; q < 50; q++) {
    const qx = (q * 37) % 1900;
    const qy = (q * 41) % 1900;
    grid.queryAABB(qx, qy, qx + 80, qy + 80, out);
  }
  const elapsed = performance.now() - start;

  assert.ok(elapsed < 100, `50 broadphase spatial queries across 2500 entities took ${elapsed.toFixed(2)}ms, well within budget`);
});

test("Ensures zero Unicode emojis in spatial partitioning test and implementation", () => {
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  const selfContent = fs.readFileSync(__filename, "utf8");
  assert.strictEqual(emojiRegex.test(selfContent), false, "Test file must not contain emojis");

  const sdkPath = path.resolve(__dirname, "../assets/js/arcadeverse-sdk.js");
  const sdkContent = fs.readFileSync(sdkPath, "utf8");
  assert.strictEqual(emojiRegex.test(sdkContent), false, "SDK file must not contain emojis");
});
