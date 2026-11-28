/**
 * Procedural 2D Flow Field Vector Particle Ribbon Visualizer (#1562)
 * Built with a standalone 2D Perlin gradient noise engine, angle vector field mapping,
 * velocity steering, artifact-free boundary wrapping, and semi-transparent ribbon decay.
 */

class FlowFieldVisualizer {
    constructor(width = 600, height = 400, options = {}) {
        this.width = width;
        this.height = height;

        this.particleCount = options.particleCount || 400;
        this.noiseScale = options.noiseScale || 0.005;
        this.speed = options.speed || 2.5;
        this.persistence = options.persistence || 0.96;
        this.palette = options.palette || 'cyberNeon';

        this.particles = [];
        this.initParticles();
    }

    // Standalone deterministic 2D Perlin gradient noise
    static noise2D(x, y) {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        const xf = x - Math.floor(x);
        const yf = y - Math.floor(y);

        // Smooth cubic curve
        const u = xf * xf * (3 - 2 * xf);
        const v = yf * yf * (3 - 2 * yf);

        // Pseudorandom gradient angles
        const hash = (n) => Math.sin(n * 12.9898 + 78.233) * 43758.5453;
        const n00 = Math.sin(hash(X + Y * 57)) * Math.PI * 2;
        const n10 = Math.sin(hash(X + 1 + Y * 57)) * Math.PI * 2;
        const n01 = Math.sin(hash(X + (Y + 1) * 57)) * Math.PI * 2;
        const n11 = Math.sin(hash(X + 1 + (Y + 1) * 57)) * Math.PI * 2;

        const g00 = Math.cos(n00) * xf + Math.sin(n00) * yf;
        const g10 = Math.cos(n10) * (xf - 1) + Math.sin(n10) * yf;
        const g01 = Math.cos(n01) * xf + Math.sin(n01) * (yf - 1);
        const g11 = Math.cos(n11) * (xf - 1) + Math.sin(n11) * (yf - 1);

        const nx0 = g00 * (1 - u) + g10 * u;
        const nx1 = g01 * (1 - u) + g11 * u;
        return nx0 * (1 - v) + nx1 * v;
    }

    initParticles() {
        this.particles = [];
        for (let i = 0; i < this.particleCount; i++) {
            this.particles.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                oldX: 0,
                oldY: 0,
                justWrapped: false
            });
            this.particles[i].oldX = this.particles[i].x;
            this.particles[i].oldY = this.particles[i].y;
        }
    }

    update(timeOffset = 0) {
        const scale = this.noiseScale;
        const spd = this.speed;

        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            p.oldX = p.x;
            p.oldY = p.y;
            p.justWrapped = false;

            const n = FlowFieldVisualizer.noise2D(p.x * scale + timeOffset, p.y * scale + timeOffset);
            const angle = n * Math.PI * 4;

            p.x += Math.cos(angle) * spd;
            p.y += Math.sin(angle) * spd;

            // Boundary wrapping without cross-screen line streaks
            if (p.x < 0) {
                p.x += this.width;
                p.oldX = p.x;
                p.justWrapped = true;
            } else if (p.x >= this.width) {
                p.x -= this.width;
                p.oldX = p.x;
                p.justWrapped = true;
            }

            if (p.y < 0) {
                p.y += this.height;
                p.oldY = p.y;
                p.justWrapped = true;
            } else if (p.y >= this.height) {
                p.y -= this.height;
                p.oldY = p.y;
                p.justWrapped = true;
            }
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FlowFieldVisualizer };
}
