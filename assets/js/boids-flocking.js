/**
 * 2D Boids Flocking Simulation with Predator-Prey Dynamics (#1516)
 * Implements Craig Reynolds' classic emergent flocking rules:
 * 1. Separation (avoid local collisions)
 * 2. Alignment (match average velocity vector of flockmates)
 * 3. Cohesion (steer toward local center of mass)
 * Plus predator evasion and cursor attractor swarming.
 */

class BoidsSimulationEngine {
    constructor(width = 600, height = 400, options = {}) {
        this.width = width;
        this.height = height;

        this.boids = [];
        this.numBoids = options.numBoids || 100;
        this.visualRange = options.visualRange || 45;
        this.separationWeight = options.separationWeight || 1.5;
        this.alignmentWeight = options.alignmentWeight || 1.0;
        this.cohesionWeight = options.cohesionWeight || 1.0;
        this.maxSpeed = options.maxSpeed || 3.0;

        this.mode = 'attractor'; // 'attractor' or 'predator'
        this.cursor = { x: -1000, y: -1000, active: false };

        this.initBoids();
    }

    initBoids() {
        this.boids = [];
        for (let i = 0; i < this.numBoids; i++) {
            this.boids.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                vx: (Math.random() - 0.5) * this.maxSpeed,
                vy: (Math.random() - 0.5) * this.maxSpeed
            });
        }
    }

    static distance(b1, b2) {
        const dx = b1.x - b2.x;
        const dy = b1.y - b2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    updatePhysics() {
        const range = this.visualRange;
        const rangeSq = range * range;

        for (let i = 0; i < this.boids.length; i++) {
            const b = this.boids[i];

            let sepX = 0, sepY = 0;
            let alignX = 0, alignY = 0;
            let cohX = 0, cohY = 0;
            let neighbors = 0;

            for (let j = 0; j < this.boids.length; j++) {
                if (i === j) continue;
                const o = this.boids[j];
                const dx = b.x - o.x;
                const dy = b.y - o.y;
                const distSq = dx * dx + dy * dy;

                if (distSq < rangeSq && distSq > 0) {
                    const dist = Math.sqrt(distSq);
                    // Separation (inverse square push)
                    sepX += (dx / dist) / dist;
                    sepY += (dy / dist) / dist;

                    alignX += o.vx;
                    alignY += o.vy;

                    cohX += o.x;
                    cohY += o.y;
                    neighbors++;
                }
            }

            if (neighbors > 0) {
                alignX = (alignX / neighbors) - b.vx;
                alignY = (alignY / neighbors) - b.vy;

                cohX = (cohX / neighbors) - b.x;
                cohY = (cohY / neighbors) - b.y;

                b.vx += sepX * this.separationWeight * 12 + alignX * this.alignmentWeight * 0.05 + cohX * this.cohesionWeight * 0.005;
                b.vy += sepY * this.separationWeight * 12 + alignY * this.alignmentWeight * 0.05 + cohY * this.cohesionWeight * 0.005;
            }

            // Interactive Cursor / Predator Behavior
            if (this.cursor.active) {
                const cdx = this.cursor.x - b.x;
                const cdy = this.cursor.y - b.y;
                const cdist = Math.sqrt(cdx * cdx + cdy * cdy);

                if (cdist > 0 && cdist < 180) {
                    if (this.mode === 'predator') {
                        // Scatter away in panic
                        b.vx -= (cdx / cdist) * 0.8;
                        b.vy -= (cdy / cdist) * 0.8;
                    } else {
                        // Attractor swarm
                        b.vx += (cdx / cdist) * 0.25;
                        b.vy += (cdy / cdist) * 0.25;
                    }
                }
            }

            // Speed limit clamp
            const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
            if (speed > this.maxSpeed) {
                b.vx = (b.vx / speed) * this.maxSpeed;
                b.vy = (b.vy / speed) * this.maxSpeed;
            }

            b.x += b.vx;
            b.y += b.vy;

            // Toroidal boundary wrap
            if (b.x < 0) b.x += this.width;
            if (b.x >= this.width) b.x -= this.width;
            if (b.y < 0) b.y += this.height;
            if (b.y >= this.height) b.y -= this.height;
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BoidsSimulationEngine };
}
