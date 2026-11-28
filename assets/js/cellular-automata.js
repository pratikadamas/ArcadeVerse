/**
 * 2D Canvas Cellular Automata Simulation Engine (#1517)
 * Implements high-performance double-buffered Uint8Array grid
 * executing Conway's B3/S23 Life rules, pattern preset loading,
 * interactive pointer cell drawing, and generation tracking.
 */

class CellularAutomataEngine {
    static PRESETS = {
        glider: [
            [0, 1], [1, 2], [2, 0], [2, 1], [2, 2]
        ],
        pulsar: [
            // Period 3 oscillator key coordinates
            [2, 4], [2, 5], [2, 6], [2, 10], [2, 11], [2, 12],
            [4, 2], [5, 2], [6, 2], [4, 7], [5, 7], [6, 7],
            [4, 9], [5, 9], [6, 9], [4, 14], [5, 14], [6, 14]
        ],
        spaceship: [
            [0, 1], [0, 4], [1, 0], [2, 0], [3, 0], [3, 3], [4, 0], [4, 1], [4, 2]
        ]
    };

    constructor(cols = 80, rows = 60, cellSize = 8) {
        this.cols = cols;
        this.rows = rows;
        this.cellSize = cellSize;
        this.size = cols * rows;

        this.gridA = new Uint8Array(this.size);
        this.gridB = new Uint8Array(this.size);
        this.currentGrid = this.gridA;
        this.nextGrid = this.gridB;

        this.generation = 0;
        this.aliveCount = 0;
    }

    setCell(x, y, state = 1) {
        if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) return;
        this.currentGrid[y * this.cols + x] = state ? 1 : 0;
    }

    getCell(x, y) {
        if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) return 0;
        return this.currentGrid[y * this.cols + x];
    }

    clear() {
        this.currentGrid.fill(0);
        this.nextGrid.fill(0);
        this.generation = 0;
        this.aliveCount = 0;
    }

    randomize(density = 0.2) {
        this.clear();
        for (let i = 0; i < this.size; i++) {
            this.currentGrid[i] = Math.random() < density ? 1 : 0;
        }
        this.updateAliveCount();
    }

    loadPreset(name, startX = 20, startY = 20) {
        const pattern = CellularAutomataEngine.PRESETS[name];
        if (!pattern) return false;

        pattern.forEach(([dx, dy]) => {
            this.setCell(startX + dx, startY + dy, 1);
        });
        this.updateAliveCount();
        return true;
    }

    countNeighbors(x, y) {
        let count = 0;
        const c = this.cols;
        const r = this.rows;
        const g = this.currentGrid;

        for (let j = -1; j <= 1; j++) {
            const ny = (y + j + r) % r;
            const rowOffset = ny * c;
            for (let i = -1; i <= 1; i++) {
                if (i === 0 && j === 0) continue;
                const nx = (x + i + c) % c;
                count += g[rowOffset + nx];
            }
        }
        return count;
    }

    step() {
        const c = this.cols;
        const r = this.rows;
        const cur = this.currentGrid;
        const next = this.nextGrid;
        let count = 0;

        for (let y = 0; y < r; y++) {
            const row = y * c;
            for (let x = 0; x < c; x++) {
                const idx = row + x;
                const neighbors = this.countNeighbors(x, y);
                const isAlive = cur[idx] === 1;

                // B3/S23 Life rule
                if (isAlive && (neighbors === 2 || neighbors === 3)) {
                    next[idx] = 1;
                    count++;
                } else if (!isAlive && neighbors === 3) {
                    next[idx] = 1;
                    count++;
                } else {
                    next[idx] = 0;
                }
            }
        }

        // Swap buffers
        this.currentGrid = next;
        this.nextGrid = cur;
        this.generation++;
        this.aliveCount = count;
    }

    updateAliveCount() {
        let count = 0;
        for (let i = 0; i < this.size; i++) {
            if (this.currentGrid[i] === 1) count++;
        }
        this.aliveCount = count;
        return count;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CellularAutomataEngine };
}
