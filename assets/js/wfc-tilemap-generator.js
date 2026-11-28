/**
 * Procedural 2D Wave Function Collapse Constraint Tilemap Generator
 * Solves discrete socket constraint propagation across 4 cardinal directions (N, E, S, W)
 * with minimum-entropy heuristic and seeded deterministic PRNG.
 * Pure Vanilla JS, Canvas rendering, zero external dependencies, zero emojis.
 */
(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.WFCTilemapGenerator = factory();
  }
}(typeof self !== 'undefined' ? self : this, function() {
  'use strict';

  // Seeded linear congruential PRNG
  function Mulberry32(seed) {
    let s = seed >>> 0;
    return function() {
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Socket definitions for Circuit Tileset
  // Sockets: 0 = empty space, 1 = wire connector
  const CIRCUIT_TILESET = [
    { id: 0, name: 'Empty', sockets: [0, 0, 0, 0], weight: 3, color: '#090e17' },
    { id: 1, name: 'Cross', sockets: [1, 1, 1, 1], weight: 1, color: '#00f2fe' },
    { id: 2, name: 'Line H', sockets: [0, 1, 0, 1], weight: 2, color: '#38ef7d' },
    { id: 3, name: 'Line V', sockets: [1, 0, 1, 0], weight: 2, color: '#38ef7d' },
    { id: 4, name: 'Corner NE', sockets: [1, 1, 0, 0], weight: 1.5, color: '#ff007f' },
    { id: 5, name: 'Corner SE', sockets: [0, 1, 1, 0], weight: 1.5, color: '#ff007f' },
    { id: 6, name: 'Corner SW', sockets: [0, 0, 1, 1], weight: 1.5, color: '#ff007f' },
    { id: 7, name: 'Corner NW', sockets: [1, 0, 0, 1], weight: 1.5, color: '#ff007f' }
  ];

  // Socket definitions for Island Archipelago Tileset
  // Sockets: 0 = deep water, 1 = coast/sand, 2 = lush grass
  const ISLAND_TILESET = [
    { id: 0, name: 'Deep Water', sockets: [0, 0, 0, 0], weight: 4, color: '#0369a1' },
    { id: 1, name: 'Sand Island', sockets: [1, 1, 1, 1], weight: 2, color: '#f59e0b' },
    { id: 2, name: 'Coast North', sockets: [0, 1, 1, 1], weight: 1.5, color: '#d97706' },
    { id: 3, name: 'Coast South', sockets: [1, 1, 0, 1], weight: 1.5, color: '#d97706' },
    { id: 4, name: 'Coast East', sockets: [1, 0, 1, 1], weight: 1.5, color: '#d97706' },
    { id: 5, name: 'Coast West', sockets: [1, 1, 1, 0], weight: 1.5, color: '#d97706' },
    { id: 6, name: 'Lush Center', sockets: [2, 2, 2, 2], weight: 2, color: '#16a34a' }
  ];

  // Cardinal directions: 0 = North, 1 = East, 2 = South, 3 = West
  const OPPOSITE_DIR = [2, 3, 0, 1];
  const DIR_OFFSET = [
    { dx: 0, dy: -1 }, // N
    { dx: 1, dy: 0 },  // E
    { dx: 0, dy: 1 },  // S
    { dx: -1, dy: 0 }  // W
  ];

  class WFCSolver {
    constructor(gridWidth = 12, gridHeight = 12, tileset = CIRCUIT_TILESET, seed = 12345) {
      this.width = gridWidth;
      this.height = gridHeight;
      this.tileset = tileset;
      this.seed = seed;
      this.prng = Mulberry32(seed);

      this.numTiles = this.tileset.length;
      this.totalCells = this.width * this.height;

      // Matrix of possible tile options per cell: cellIndex -> Set<tileId>
      this.wave = [];
      this.collapsed = new Array(this.totalCells).fill(null);
      this.isComplete = false;
      this.hasContradiction = false;

      this.reset();
    }

    reset() {
      this.prng = Mulberry32(this.seed);
      this.collapsed = new Array(this.totalCells).fill(null);
      this.wave = [];
      for (let i = 0; i < this.totalCells; i++) {
        const fullSet = new Set();
        for (let t = 0; t < this.numTiles; t++) {
          fullSet.add(t);
        }
        this.wave.push(fullSet);
      }
      this.isComplete = false;
      this.hasContradiction = false;
    }

    cellIndex(x, y) {
      return y * this.width + x;
    }

    canConnect(tileAId, tileBId, direction) {
      const tileA = this.tileset[tileAId];
      const tileB = this.tileset[tileBId];
      const oppDir = OPPOSITE_DIR[direction];
      return tileA.sockets[direction] === tileB.sockets[oppDir];
    }

    findLowestEntropyCell() {
      let minEntropy = Infinity;
      let candidates = [];

      for (let i = 0; i < this.totalCells; i++) {
        if (this.collapsed[i] !== null) continue;

        const count = this.wave[i].size;
        if (count === 0) {
          this.hasContradiction = true;
          return -1;
        }

        if (count < minEntropy) {
          minEntropy = count;
          candidates = [i];
        } else if (count === minEntropy) {
          candidates.push(i);
        }
      }

      if (candidates.length === 0) {
        this.isComplete = true;
        return -1;
      }

      // Pick randomly with PRNG tie-breaker
      const pickIdx = Math.floor(this.prng() * candidates.length);
      return candidates[pickIdx];
    }

    collapseCell(cellIdx) {
      const possibleTiles = Array.from(this.wave[cellIdx]);
      if (possibleTiles.length === 0) {
        this.hasContradiction = true;
        return false;
      }

      // Weighted selection based on tile definitions
      let totalWeight = 0;
      possibleTiles.forEach(tId => {
        totalWeight += this.tileset[tId].weight || 1;
      });

      let rand = this.prng() * totalWeight;
      let chosen = possibleTiles[0];
      for (let i = 0; i < possibleTiles.length; i++) {
        const tId = possibleTiles[i];
        rand -= (this.tileset[tId].weight || 1);
        if (rand <= 0) {
          chosen = tId;
          break;
        }
      }

      this.collapsed[cellIdx] = chosen;
      this.wave[cellIdx] = new Set([chosen]);

      // Propagate constraints
      return this.propagate(cellIdx);
    }

    propagate(startCellIdx) {
      const queue = [startCellIdx];

      while (queue.length > 0) {
        const currIdx = queue.shift();
        const cx = currIdx % this.width;
        const cy = Math.floor(currIdx / this.width);
        const currPossible = this.wave[currIdx];

        for (let dir = 0; dir < 4; dir++) {
          const nx = cx + DIR_OFFSET[dir].dx;
          const ny = cy + DIR_OFFSET[dir].dy;

          if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height) continue;

          const neighborIdx = this.cellIndex(nx, ny);
          const neighborPossible = this.wave[neighborIdx];

          // Compute compatible neighbor tile options
          const compatible = new Set();
          currPossible.forEach(currTileId => {
            neighborPossible.forEach(neighTileId => {
              if (this.canConnect(currTileId, neighTileId, dir)) {
                compatible.add(neighTileId);
              }
            });
          });

          // If neighbor options shrunk, update and re-queue
          if (compatible.size < neighborPossible.size) {
            if (compatible.size === 0) {
              this.hasContradiction = true;
              return false;
            }
            this.wave[neighborIdx] = compatible;
            if (!queue.includes(neighborIdx)) {
              queue.push(neighborIdx);
            }
          }
        }
      }

      return true;
    }

    step() {
      if (this.isComplete || this.hasContradiction) return false;

      const nextCell = this.findLowestEntropyCell();
      if (nextCell === -1) return false;

      return this.collapseCell(nextCell);
    }

    solve(maxAttempts = 5) {
      let attempts = 0;
      while (attempts < maxAttempts) {
        this.reset();
        let steps = 0;
        const maxSteps = this.totalCells * 2;

        while (!this.isComplete && !this.hasContradiction && steps < maxSteps) {
          this.step();
          steps++;
        }

        if (this.isComplete && !this.hasContradiction) {
          return true; // Successfully solved
        }

        attempts++;
        this.seed = (this.seed + 1) >>> 0;
      }
      return false;
    }

    render(ctx, width, height) {
      ctx.clearRect(0, 0, width, height);

      const cellW = width / this.width;
      const cellH = height / this.height;

      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          const idx = this.cellIndex(x, y);
          const px = x * cellW;
          const py = y * cellH;

          if (this.collapsed[idx] !== null) {
            const tile = this.tileset[this.collapsed[idx]];
            ctx.fillStyle = tile.color;
            ctx.fillRect(px, py, cellW, cellH);

            // Render circuit wire lines
            if (tile.sockets[0] === 1) { // North
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(px + cellW / 2, py);
              ctx.lineTo(px + cellW / 2, py + cellH / 2);
              ctx.stroke();
            }
            if (tile.sockets[1] === 1) { // East
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(px + cellW / 2, py + cellH / 2);
              ctx.lineTo(px + cellW, py + cellH / 2);
              ctx.stroke();
            }
            if (tile.sockets[2] === 1) { // South
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(px + cellW / 2, py + cellH / 2);
              ctx.lineTo(px + cellW / 2, py + cellH);
              ctx.stroke();
            }
            if (tile.sockets[3] === 1) { // West
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(px, py + cellH / 2);
              ctx.lineTo(px + cellW / 2, py + cellH / 2);
              ctx.stroke();
            }
          } else {
            // Uncollapsed cell: draw entropy count
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(px, py, cellW, cellH);

            ctx.fillStyle = '#64748b';
            ctx.font = `${Math.max(9, Math.floor(cellH * 0.35))}px monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${this.wave[idx].size}`, px + cellW / 2, py + cellH / 2);
          }

          // Grid wire border
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
          ctx.lineWidth = 1;
          ctx.strokeRect(px, py, cellW, cellH);
        }
      }
    }
  }

  function createStudio(container, options = {}) {
    if (!container) return null;

    let width = options.width || 12;
    let height = options.height || 12;
    let tilesetKey = options.tileset || 'circuit';
    let currentTileset = tilesetKey === 'island' ? ISLAND_TILESET : CIRCUIT_TILESET;
    let seed = options.seed || Math.floor(Math.random() * 999999);

    let solver = new WFCSolver(width, height, currentTileset, seed);

    container.innerHTML = `
      <div class="wfc-studio-container">
        <div class="wfc-header">
          <h2 class="wfc-title">Wave Function Collapse Constraint Tilemap</h2>
          <span style="font-size:0.85rem;color:var(--wfc-muted);">Procedural Constraint Propagation</span>
        </div>
        <div class="wfc-workspace">
          <div class="wfc-canvas-panel">
            <div class="wfc-canvas-wrapper">
              <canvas class="wfc-canvas" width="480" height="480"></canvas>
            </div>
          </div>
          <div class="wfc-controls-panel">
            <div class="wfc-control-group">
              <label class="wfc-control-label">Grid Size</label>
              <select class="wfc-select" id="wfc-grid-size">
                <option value="8">8 x 8</option>
                <option value="12" selected>12 x 12</option>
                <option value="16">16 x 16</option>
              </select>
            </div>
            <div class="wfc-control-group">
              <label class="wfc-control-label">Tileset</label>
              <select class="wfc-select" id="wfc-tileset-select">
                <option value="circuit">Circuit Board</option>
                <option value="island">Island Archipelago</option>
              </select>
            </div>
            <div class="wfc-control-group">
              <label class="wfc-control-label">Seed</label>
              <input type="number" class="wfc-input" id="wfc-seed-input" value="${seed}" />
            </div>
            <div class="wfc-stats-card">
              <div class="wfc-stat-row"><span>Status:</span> <strong id="wfc-status">Ready</strong></div>
              <div class="wfc-stat-row"><span>Collapsed:</span> <strong id="wfc-collapsed-count">0 / ${width * height}</strong></div>
            </div>
            <div class="wfc-btn-row">
              <button class="wfc-btn" id="wfc-btn-step">Step</button>
              <button class="wfc-btn" id="wfc-btn-auto">Animate</button>
              <button class="wfc-btn wfc-btn-secondary" id="wfc-btn-reset">Reset</button>
            </div>
          </div>
        </div>
      </div>
    `;

    const canvas = container.querySelector('.wfc-canvas');
    const ctx = canvas.getContext('2d');
    const selectGrid = container.querySelector('#wfc-grid-size');
    const selectTileset = container.querySelector('#wfc-tileset-select');
    const inputSeed = container.querySelector('#wfc-seed-input');
    const statStatus = container.querySelector('#wfc-status');
    const statCount = container.querySelector('#wfc-collapsed-count');
    const btnStep = container.querySelector('#wfc-btn-step');
    const btnAuto = container.querySelector('#wfc-btn-auto');
    const btnReset = container.querySelector('#wfc-btn-reset');

    let animInterval = null;

    function updateUI() {
      const collapsedCount = solver.collapsed.filter(c => c !== null).length;
      statCount.textContent = `${collapsedCount} / ${solver.totalCells}`;

      if (solver.hasContradiction) {
        statStatus.textContent = 'Contradiction (Retrying)';
        statStatus.style.color = '#ff007f';
      } else if (solver.isComplete) {
        statStatus.textContent = 'Solved';
        statStatus.style.color = '#38ef7d';
        stopAuto();
      } else {
        statStatus.textContent = 'Collapsing...';
        statStatus.style.color = '#00f2fe';
      }

      solver.render(ctx, canvas.width, canvas.height);
    }

    function stopAuto() {
      if (animInterval) {
        clearInterval(animInterval);
        animInterval = null;
        btnAuto.textContent = 'Animate';
      }
    }

    btnStep.addEventListener('click', () => {
      stopAuto();
      solver.step();
      updateUI();
    });

    btnAuto.addEventListener('click', () => {
      if (animInterval) {
        stopAuto();
      } else {
        btnAuto.textContent = 'Pause';
        animInterval = setInterval(() => {
          if (!solver.isComplete && !solver.hasContradiction) {
            solver.step();
            updateUI();
          } else {
            stopAuto();
          }
        }, 30);
      }
    });

    btnReset.addEventListener('click', () => {
      stopAuto();
      seed = parseInt(inputSeed.value, 10) || 12345;
      solver = new WFCSolver(width, height, currentTileset, seed);
      updateUI();
    });

    selectGrid.addEventListener('change', (e) => {
      stopAuto();
      const sz = parseInt(e.target.value, 10);
      width = sz;
      height = sz;
      solver = new WFCSolver(width, height, currentTileset, seed);
      updateUI();
    });

    selectTileset.addEventListener('change', (e) => {
      stopAuto();
      currentTileset = e.target.value === 'island' ? ISLAND_TILESET : CIRCUIT_TILESET;
      solver = new WFCSolver(width, height, currentTileset, seed);
      updateUI();
    });

    inputSeed.addEventListener('change', (e) => {
      seed = parseInt(e.target.value, 10) || 12345;
      solver = new WFCSolver(width, height, currentTileset, seed);
      updateUI();
    });

    updateUI();

    return {
      solver,
      updateUI,
      destroy: () => stopAuto()
    };
  }

  return {
    CIRCUIT_TILESET,
    ISLAND_TILESET,
    Mulberry32,
    WFCSolver,
    createStudio
  };
}));
