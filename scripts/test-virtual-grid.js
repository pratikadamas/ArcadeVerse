/**
 * Automated Unit & Performance Test Suite for ArcadeVirtualGrid
 * Issue #1366: Virtualized Game Card Grid Scroller for Instant Mobile & Low-End DOM Performance
 *
 * Usage:
 *   node --test scripts/test-virtual-grid.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const virtualGridModule = require('../assets/js/virtual-grid.js');
const VirtualGrid = virtualGridModule.VirtualGrid;

test('ArcadeVirtualGrid exports all required factory and constructor methods', () => {
  assert.equal(typeof virtualGridModule.create, 'function');
  assert.equal(typeof virtualGridModule.VirtualGrid, 'function');
  assert.ok(virtualGridModule.DEFAULT_CONFIG);
  assert.equal(typeof virtualGridModule.DEFAULT_CONFIG.bufferRows, 'number');
  assert.equal(typeof virtualGridModule.DEFAULT_CONFIG.maxDomNodes, 'number');
});

test('VirtualGrid initializes correctly with default options and handles empty arrays', () => {
  const grid = new VirtualGrid();
  assert.equal(grid.cols, 1);
  assert.equal(grid.totalRows, 0);
  assert.equal(grid.totalHeight, 0);
  assert.equal(grid.items.length, 0);
  assert.equal(grid.getActiveNodeCount(), 0);

  const range = grid.getVisibleRange();
  assert.deepEqual(range, { startRow: 0, endRow: 0, startIndex: 0, endIndex: 0 });
});

test('VirtualGrid layout metrics calculation with 125+ mock games', () => {
  const mockGames = Array.from({ length: 128 }, (_, i) => ({
    id: `game-${i}`,
    title: `Game Title ${i}`,
    category: i % 2 === 0 ? 'Arcade' : 'Action'
  }));

  // Create a mock DOM container
  const mockContainer = {
    clientWidth: 1200,
    classList: {
      add: () => {},
      remove: () => {},
      contains: () => false
    },
    querySelector: () => null,
    appendChild: () => {},
    getBoundingClientRect: () => ({ top: 0, height: 18000, width: 1200 })
  };

  const grid = new VirtualGrid({
    container: mockContainer,
    bufferRows: 1
  });
  grid.items = mockGames;
  grid.measureLayout();

  // With 1200px container and minWidth 300px + gap 32px:
  // Math.floor((1200 + 32) / (300 + 32)) = Math.floor(1232 / 332) = 3 columns
  assert.ok(grid.cols >= 3, `Expected at least 3 columns for 1200px width, got ${grid.cols}`);
  const expectedRows = Math.ceil(128 / grid.cols);
  assert.equal(grid.totalRows, expectedRows);
  assert.equal(grid.totalHeight, expectedRows * grid.rowHeight);
});

test('VirtualGrid visible range window calculation enforces buffer rows and bounds', () => {
  const mockGames = Array.from({ length: 128 }, (_, i) => ({
    id: `game-${i}`,
    title: `Game Title ${i}`
  }));

  // Mock container scrolled down 920px (2 rows) with viewport height 800px
  const mockContainer = {
    clientWidth: 1200,
    getBoundingClientRect: () => ({
      top: -920,
      height: 20000,
      width: 1200
    }),
    classList: { contains: () => false }
  };

  const grid = new VirtualGrid({
    container: mockContainer,
    bufferRows: 1
  });
  grid.items = mockGames;
  grid.measureLayout();

  const range = grid.getVisibleRange();
  // With rowHeight ~460px, scrollTop 920px is row 2
  // viewport 800px covers rows 2, 3, 4
  // buffer 1 row above (row 1) and below (row 5)
  assert.ok(range.startRow <= 1, `startRow should be <= 1 with buffer, got ${range.startRow}`);
  assert.ok(range.endRow >= 4, `endRow should be >= 4 with buffer, got ${range.endRow}`);

  // Calculate total active items in this range
  const activeCount = range.endIndex - range.startIndex + 1;
  assert.ok(activeCount < 30, `DOM nodes count must stay < 30 (got ${activeCount})`);
});

test('VirtualGrid stays strictly bounded (< 30 DOM nodes) for mobile portrait viewport', () => {
  const mockGames = Array.from({ length: 150 }, (_, i) => ({
    id: `game-${i}`,
    title: `Game Title ${i}`
  }));

  // Mobile viewport: width 380px, height 740px
  const mockContainer = {
    clientWidth: 380,
    getBoundingClientRect: () => ({
      top: -1200,
      height: 69000,
      width: 380
    }),
    classList: { contains: () => false }
  };

  const grid = new VirtualGrid({
    container: mockContainer,
    bufferRows: 1
  });
  grid.items = mockGames;
  grid.measureLayout();

  // On 380px mobile screen, cols should be 1
  assert.equal(grid.cols, 1);

  const range = grid.getVisibleRange();
  const activeItemsCount = range.endIndex - range.startIndex + 1;
  // In single-column mobile view, visible rows + buffer will be approx 4-6 cards
  assert.ok(activeItemsCount <= 10, `Active items on mobile must be <= 10, got ${activeItemsCount}`);
  assert.ok(activeItemsCount < 30, 'Active items strictly satisfy criteria (< 30 DOM nodes)');
});

test('VirtualGrid renders and unmounts nodes dynamically during scrolling', () => {
  const mockGames = Array.from({ length: 100 }, (_, i) => ({
    id: `game-${i}`,
    title: `Game Title ${i}`
  }));

  let currentTop = 0;
  const createdElements = [];
  const removedElements = [];

  const mockContainer = {
    clientWidth: 900,
    classList: {
      add: () => {},
      remove: () => {},
      contains: () => false
    },
    querySelector: () => null,
    appendChild: (el) => { createdElements.push(el); },
    getBoundingClientRect: () => ({ top: currentTop, height: 50000, width: 900 })
  };

  const grid = new VirtualGrid({
    container: mockContainer,
    bufferRows: 1,
    renderItem: (item) => {
      const el = {
        style: {},
        classList: { add: () => {} },
        setAttribute: () => {},
        parentNode: {
          removeChild: (target) => { removedElements.push(target); }
        },
        id: item.id
      };
      return el;
    }
  });

  grid.items = mockGames;
  grid.render();

  const initialMounted = grid.getActiveNodeCount();
  assert.ok(initialMounted > 0 && initialMounted < 30, `Initial mounted should be < 30, got ${initialMounted}`);

  // Simulate scrolling down 3000px
  currentTop = -3000;
  grid.render();

  const scrolledMounted = grid.getActiveNodeCount();
  assert.ok(scrolledMounted > 0 && scrolledMounted < 30, `Scrolled mounted should be < 30, got ${scrolledMounted}`);
  // Cards that scrolled out of view should have been removed
  assert.ok(removedElements.length > 0, 'Off-screen cards should have been detached from DOM');
});

test('VirtualGrid updateItems recalculates indices on search/filter without memory leaks', () => {
  const allGames = Array.from({ length: 125 }, (_, i) => ({
    id: `game-${i}`,
    title: `Game ${i}`,
    category: i < 20 ? 'Action' : 'Puzzle'
  }));

  const mockContainer = {
    clientWidth: 1000,
    classList: {
      add: () => {},
      remove: () => {},
      contains: () => false
    },
    querySelector: () => null,
    appendChild: () => {},
    getBoundingClientRect: () => ({ top: 0, height: 10000, width: 1000 })
  };

  const grid = new VirtualGrid({ container: mockContainer });
  grid.init(mockContainer, allGames);

  const initialRows = grid.totalRows;
  assert.ok(initialRows > 0);

  // Filter down to 5 Action games
  const actionGames = allGames.filter(g => g.category === 'Action').slice(0, 5);
  grid.updateItems(actionGames);

  assert.equal(grid.items.length, 5);
  assert.ok(grid.totalRows <= 3);
  assert.equal(grid.spacer.style.height, `${grid.totalRows * grid.rowHeight}px`);
});

test('VirtualGrid destroy cleans up spacer and mounted nodes cleanly', () => {
  let spacerRemoved = false;
  let itemsContainerRemoved = false;

  const mockContainer = {
    clientWidth: 1000,
    classList: {
      add: () => {},
      remove: () => {},
      contains: () => false
    },
    querySelector: () => null,
    appendChild: () => {},
    getBoundingClientRect: () => ({ top: 0, height: 10000, width: 1000 })
  };

  const grid = new VirtualGrid({ container: mockContainer });
  grid.init(mockContainer, [{ id: '1' }, { id: '2' }]);
  grid.spacer.parentNode = { removeChild: () => { spacerRemoved = true; } };
  grid.itemsContainer.parentNode = { removeChild: () => { itemsContainerRemoved = true; } };

  grid.destroy();
  assert.equal(grid.getActiveNodeCount(), 0);
  assert.equal(spacerRemoved, true);
  assert.equal(itemsContainerRemoved, true);
});
