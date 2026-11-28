/**
 * 2D Metaball Liquid Blob Fusion Canvas Visualizer (#1512)
 * Evaluates scalar field function: for each pixel, sum(R_i^2 / d_i^2).
 * Applies thresholding, autonomous bouncing physics with gravity rebound,
 * cursor attraction, and smooth gradient color mapping.
 */

class MetaballVisualizer {
    static GRADIENTS = {
        neonLava: {
            inner: [255, 220, 0],
            edge: [255, 0, 85],
            glow: [180, 0, 50]
        },
        cyberAcid: {
            inner: [220, 255, 50],
            edge: [0, 255, 128],
            glow: [0, 150, 80]
        },
        liquidMercury: {
            inner: [240, 250, 255],
            edge: [0, 240, 255],
            glow: [0, 100, 180]
        }
    };

    constructor(width = 160, height = 120, options = {}) {
        this.width = width;
        this.height = height;
        this.threshold = options.threshold || 1.1;
        this.gradientMode = options.gradientMode || 'neonLava';
        this.numBalls = options.numBalls || 10;

        this.balls = [];
        this.initBalls();

        this.imageData = null;
        this.cursor = { x: -1000, y: -1000, active: false };
    }

    initBalls() {
        this.balls = [];
        for (let i = 0; i < this.numBalls; i++) {
            this.balls.push({
                x: 20 + Math.random() * (this.width - 40),
                y: 20 + Math.random() * (this.height - 40),
                vx: (Math.random() - 0.5) * 1.5,
                vy: (Math.random() - 0.5) * 1.5,
                radius: 12 + Math.random() * 8
            });
        }
    }

    updatePhysics() {
        for (let i = 0; i < this.balls.length; i++) {
            const b = this.balls[i];

            // Cursor gravity attraction
            if (this.cursor.active) {
                const dx = this.cursor.x - b.x;
                const dy = this.cursor.y - b.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 5 && dist < 100) {
                    b.vx += (dx / dist) * 0.08;
                    b.vy += (dy / dist) * 0.08;
                }
            }

            b.x += b.vx;
            b.y += b.vy;

            // Boundary collision reflection
            if (b.x < b.radius) {
                b.x = b.radius;
                b.vx *= -1;
            } else if (b.x > this.width - b.radius) {
                b.x = this.width - b.radius;
                b.vx *= -1;
            }

            if (b.y < b.radius) {
                b.y = b.radius;
                b.vy *= -1;
            } else if (b.y > this.height - b.radius) {
                b.y = this.height - b.radius;
                b.vy *= -1;
            }
        }
    }

    calculateScalarField(x, y) {
        let sum = 0;
        for (let i = 0; i < this.balls.length; i++) {
            const b = this.balls[i];
            const dx = x - b.x;
            const dy = y - b.y;
            const distSq = dx * dx + dy * dy;
            if (distSq === 0) return 9999;
            sum += (b.radius * b.radius) / distSq;
        }
        return sum;
    }

    render(ctx) {
        if (!ctx) return;
        if (!this.imageData) {
            this.imageData = ctx.createImageData(this.width, this.height);
        }

        const data = this.imageData.data;
        const grad = MetaballVisualizer.GRADIENTS[this.gradientMode] || MetaballVisualizer.GRADIENTS.neonLava;
        const thresh = this.threshold;

        for (let y = 0; y < this.height; y++) {
            const rowOffset = y * this.width;
            for (let x = 0; x < this.width; x++) {
                const idx = (rowOffset + x) * 4;
                const field = this.calculateScalarField(x, y);

                if (field >= thresh) {
                    const norm = Math.min(1, (field - thresh) / 2.5);
                    data[idx] = Math.round(grad.edge[0] + (grad.inner[0] - grad.edge[0]) * norm);
                    data[idx + 1] = Math.round(grad.edge[1] + (grad.inner[1] - grad.edge[1]) * norm);
                    data[idx + 2] = Math.round(grad.edge[2] + (grad.inner[2] - grad.edge[2]) * norm);
                    data[idx + 3] = 255;
                } else if (field >= thresh * 0.75) {
                    // Outer glow
                    const glowNorm = (field - thresh * 0.75) / (thresh * 0.25);
                    data[idx] = grad.glow[0];
                    data[idx + 1] = grad.glow[1];
                    data[idx + 2] = grad.glow[2];
                    data[idx + 3] = Math.round(glowNorm * 180);
                } else {
                    data[idx + 3] = 0; // Transparent background
                }
            }
        }

        ctx.putImageData(this.imageData, 0, 0);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MetaballVisualizer };
}
