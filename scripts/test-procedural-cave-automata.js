const test = require('node:test');
const assert = require('node:assert/strict');
const ProceduralCaveAutomata = require('../assets/js/procedural-cave-automata.js');

test('ProceduralCaveAutomata generates bounded connected cave layout', () => {
  const cave = new ProceduralCaveAutomata({ width: 40, height: 30, simulationSteps: 4 });
  const grid = cave.generate(42);

  assert.equal(grid.length, 40 * 30);

  // Borders must remain solid walls
  for (let x = 0; x < 40; x++) {
    assert.equal(grid[0 * 40 + x], 1);
    assert.equal(grid[29 * 40 + x], 1);
  }

  // Ensure playable open space exists
  let openCount = 0;
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] === 0) openCount++;
  }
  assert.ok(openCount > 200, 'Cave must contain playable carved chambers');
});

test('ProceduralCaveAutomata ensures 100% room connectivity via flood-fill tunneling', () => {
  const cave = new ProceduralCaveAutomata({ width: 30, height: 20 });
  cave.generate(999);

  // Validate single connected component
  const visited = new Uint8Array(30 * 20);
  let openX = -1, openY = -1;

  for (let y = 1; y < 19; y++) {
    for (let x = 1; x < 29; x++) {
      if (cave.grid[y * 30 + x] === 0) {
        openX = x;
        openY = y;
        break;
      }
    }
    if (openX !== -1) break;
  }

  const room = cave.floodFillRoom(openX, openY, visited);
  let totalOpen = 0;
  for (let i = 0; i < cave.grid.length; i++) {
    if (cave.grid[i] === 0) totalOpen++;
  }

  assert.equal(room.length, totalOpen, 'All open tiles must belong to a single connected cave system');
});
