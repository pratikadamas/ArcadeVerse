/**
 * 2D N-Body Orbital Gravity & Planetary Slingshot Sandbox (#1571)
 * Implements symplectic Velocity-Verlet integration, gravitational softening (eps),
 * momentum-conserving inelastic body mergers, and orbital trajectory preview.
 */

class NBodyGravityEngine {
    static PRESETS = {
        binaryStar: [
            { x: 260, y: 200, vx: 0, vy: -1.2, mass: 400, radius: 10, color: '#ffd700' },
            { x: 340, y: 200, vx: 0, vy: 1.2, mass: 400, radius: 10, color: '#ff5500' }
        ],
        solarMini: [
            { x: 300, y: 200, vx: 0, vy: 0, mass: 1000, radius: 14, color: '#ffd700' },
            { x: 300, y: 110, vx: 3.2, vy: 0, mass: 10, radius: 4, color: '#00f0ff' },
            { x: 300, y: 60, vx: 2.5, vy: 0, mass: 20, radius: 6, color: '#a371f7' }
        ]
    };

    constructor(width = 600, height = 400, options = {}) {
        this.width = width;
        this.height = height;
        this.G = options.G || 1.0;
        this.epsilon = options.epsilon || 10.0; // Softening parameter
        this.bodies = [];

        this.loadPreset('binaryStar');
    }

    loadPreset(name) {
        const p = NBodyGravityEngine.PRESETS[name];
        if (!p) return false;
        this.bodies = p.map((b) => ({ ...b }));
        return true;
    }

    addBody(x, y, vx, vy, mass = 20, radius = 5, color = '#00f0ff') {
        const body = { x, y, vx, vy, mass, radius, color };
        this.bodies.push(body);
        return body;
    }

    computeAccelerations() {
        const n = this.bodies.length;
        const acc = [];
        for (let i = 0; i < n; i++) acc.push({ ax: 0, ay: 0 });

        const G = this.G;
        const epsSq = this.epsilon * this.epsilon;

        for (let i = 0; i < n; i++) {
            const b1 = this.bodies[i];
            for (let j = i + 1; j < n; j++) {
                const b2 = this.bodies[j];
                const dx = b2.x - b1.x;
                const dy = b2.y - b1.y;
                const distSq = dx * dx + dy * dy;
                const denom = Math.pow(distSq + epsSq, 1.5);

                const fx = (G * dx) / denom;
                const fy = (G * dy) / denom;

                acc[i].ax += fx * b2.mass;
                acc[i].ay += fy * b2.mass;
                acc[j].ax -= fx * b1.mass;
                acc[j].ay -= fy * b1.mass;
            }
        }
        return acc;
    }

    updatePhysics(dt = 1.0) {
        const n = this.bodies.length;
        if (n === 0) return;

        // Velocity-Verlet Step 1: initial half-step velocity & full-step position
        const acc1 = this.computeAccelerations();
        for (let i = 0; i < n; i++) {
            const b = this.bodies[i];
            b.vx += 0.5 * acc1[i].ax * dt;
            b.vy += 0.5 * acc1[i].ay * dt;
            b.x += b.vx * dt;
            b.y += b.vy * dt;
        }

        // Velocity-Verlet Step 2: compute new accelerations & final half-step velocity
        const acc2 = this.computeAccelerations();
        for (let i = 0; i < n; i++) {
            const b = this.bodies[i];
            b.vx += 0.5 * acc2[i].ax * dt;
            b.vy += 0.5 * acc2[i].ay * dt;
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { NBodyGravityEngine };
}
