/**
 * 2D Gray-Scott Reaction-Diffusion Turing Pattern PDE Engine (#1561)
 * Simulates chemical concentrations A and B over dual Float32Array grids:
 * dA/dt = Da * laplace(A) - A * B^2 + f * (1 - A)
 * dB/dt = Db * laplace(B) + A * B^2 - (k + f) * B
 * with 3x3 weighted Laplacian convolution and color ramp mapping.
 */

class ReactionDiffusionEngine {
    static PRESETS = {
        coral: { f: 0.0545, k: 0.062 },
        mitosis: { f: 0.0367, k: 0.0649 },
        worms: { f: 0.058, k: 0.065 },
        solitons: { f: 0.030, k: 0.062 }
    };

    constructor(width = 120, height = 90, options = {}) {
        this.width = width;
        this.height = height;
        this.size = width * height;

        this.Da = options.Da || 1.0;
        this.Db = options.Db || 0.5;
        this.feed = options.feed || 0.0545;
        this.kill = options.kill || 0.062;

        this.gridA = new Float32Array(this.size);
        this.gridB = new Float32Array(this.size);
        this.nextA = new Float32Array(this.size);
        this.nextB = new Float32Array(this.size);

        this.initGrids();
        this.imageData = null;
    }

    initGrids() {
        this.gridA.fill(1.0);
        this.gridB.fill(0.0);
        this.nextA.fill(1.0);
        this.nextB.fill(0.0);

        // Seed initial spot in center
        this.seedSpot(Math.floor(this.width / 2), Math.floor(this.height / 2), 6);
    }

    setPreset(name) {
        const p = ReactionDiffusionEngine.PRESETS[name];
        if (!p) return false;
        this.feed = p.f;
        this.kill = p.k;
        return true;
    }

    seedSpot(cx, cy, radius = 5) {
        const r2 = radius * radius;
        for (let dy = -radius; dy <= radius; dy++) {
            const py = (cy + dy + this.height) % this.height;
            for (let dx = -radius; dx <= radius; dx++) {
                const px = (cx + dx + this.width) % this.width;
                if (dx * dx + dy * dy <= r2) {
                    const idx = py * this.width + px;
                    this.gridB[idx] = 1.0;
                }
            }
        }
    }

    laplacian(grid, x, y) {
        const w = this.width;
        const h = this.height;

        const left = (x - 1 + w) % w;
        const right = (x + 1) % w;
        const top = (y - 1 + h) % h;
        const bottom = (y + 1) % h;

        const cIdx = y * w + x;

        // 3x3 Convolution Stencil:
        // 0.05  0.2   0.05
        // 0.2  -1.0   0.2
        // 0.05  0.2   0.05
        return (
            grid[top * w + left] * 0.05 +
            grid[top * w + x] * 0.2 +
            grid[top * w + right] * 0.05 +
            grid[y * w + left] * 0.2 +
            grid[cIdx] * -1.0 +
            grid[y * w + right] * 0.2 +
            grid[bottom * w + left] * 0.05 +
            grid[bottom * w + x] * 0.2 +
            grid[bottom * w + right] * 0.05
        );
    }

    step(dt = 1.0) {
        const w = this.width;
        const h = this.height;
        const a = this.gridA;
        const b = this.gridB;
        const nA = this.nextA;
        const nB = this.nextB;

        const f = this.feed;
        const k = this.kill;
        const da = this.Da;
        const db = this.Db;

        for (let y = 0; y < h; y++) {
            const rowOffset = y * w;
            for (let x = 0; x < w; x++) {
                const idx = rowOffset + x;
                const aVal = a[idx];
                const bVal = b[idx];
                const abb = aVal * bVal * bVal;

                const lapA = this.laplacian(a, x, y);
                const lapB = this.laplacian(b, x, y);

                const newA = aVal + (da * lapA - abb + f * (1.0 - aVal)) * dt;
                const newB = bVal + (db * lapB + abb - (k + f) * bVal) * dt;

                // Clamp concentrations [0, 1]
                nA[idx] = Math.max(0, Math.min(1, newA));
                nB[idx] = Math.max(0, Math.min(1, newB));
            }
        }

        // Swap ping-pong arrays
        this.gridA = nA;
        this.gridB = nB;
        this.nextA = a;
        this.nextB = b;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ReactionDiffusionEngine };
}
