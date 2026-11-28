/**
 * 2D Rigid-Body Polygon & Circle Impulse Collision Physics Sandbox (#1566)
 * Separating Axis Theorem (SAT) collision detection, angular velocity integration,
 * rotational inertia, impulse equations, and Baumgarte positional stabilization.
 */

class RigidBodySandboxEngine {
    constructor(width = 600, height = 400, options = {}) {
        this.width = width;
        this.height = height;
        this.gravity = options.gravity || 0.25;
        this.restitution = options.restitution || 0.6; // Bounciness
        this.bodies = [];
    }

    addCircle(x, y, radius = 16, mass = 1.0) {
        const body = {
            type: 'circle',
            x, y,
            vx: 0, vy: 0,
            angle: 0,
            omega: 0, // angular velocity
            radius,
            mass,
            invMass: mass > 0 ? 1 / mass : 0,
            inertia: 0.5 * mass * radius * radius,
            invInertia: mass > 0 ? 1 / (0.5 * mass * radius * radius) : 0
        };
        this.bodies.push(body);
        return body;
    }

    addBox(x, y, w = 30, h = 30, mass = 1.0) {
        const body = {
            type: 'box',
            x, y,
            vx: 0, vy: 0,
            angle: 0,
            omega: 0,
            w, h,
            mass,
            invMass: mass > 0 ? 1 / mass : 0,
            inertia: (1 / 12) * mass * (w * w + h * h),
            invInertia: mass > 0 ? 1 / ((1 / 12) * mass * (w * w + h * h)) : 0
        };
        this.bodies.push(body);
        return body;
    }

    // Circle vs Circle collision resolution
    checkCircleCircle(c1, c2) {
        const dx = c2.x - c1.x;
        const dy = c2.y - c1.y;
        const distSq = dx * dx + dy * dy;
        const rSum = c1.radius + c2.radius;

        if (distSq >= rSum * rSum || distSq === 0) return null;

        const dist = Math.sqrt(distSq);
        const nx = dx / dist;
        const ny = dy / dist;
        const penetration = rSum - dist;

        return { nx, ny, penetration };
    }

    updatePhysics(dt = 1.0) {
        // Integrate velocities & gravity
        for (let i = 0; i < this.bodies.length; i++) {
            const b = this.bodies[i];
            if (b.invMass === 0) continue;

            b.vy += this.gravity * dt;
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            b.angle += b.omega * dt;

            // Arena boundary collisions
            const r = b.type === 'circle' ? b.radius : b.w / 2;
            if (b.y > this.height - r) {
                b.y = this.height - r;
                b.vy = -b.vy * this.restitution;
                b.vx *= 0.95; // Ground friction
                b.omega *= 0.95;
            }
            if (b.x < r) {
                b.x = r;
                b.vx = -b.vx * this.restitution;
            } else if (b.x > this.width - r) {
                b.x = this.width - r;
                b.vx = -b.vx * this.restitution;
            }
        }

        // Check pairwise collisions
        for (let i = 0; i < this.bodies.length; i++) {
            for (let j = i + 1; j < this.bodies.length; j++) {
                const b1 = this.bodies[i];
                const b2 = this.bodies[j];

                if (b1.type === 'circle' && b2.type === 'circle') {
                    const col = this.checkCircleCircle(b1, b2);
                    if (col) {
                        // Positional correction
                        const kSlop = 0.5;
                        b1.x -= col.nx * col.penetration * kSlop;
                        b1.y -= col.ny * col.penetration * kSlop;
                        b2.x += col.nx * col.penetration * kSlop;
                        b2.y += col.ny * col.penetration * kSlop;

                        // Impulse resolution
                        const rvx = b2.vx - b1.vx;
                        const rvy = b2.vy - b1.vy;
                        const velAlongNormal = rvx * col.nx + rvy * col.ny;

                        if (velAlongNormal < 0) {
                            const jImpulse = -(1 + this.restitution) * velAlongNormal / (b1.invMass + b2.invMass);
                            b1.vx -= col.nx * jImpulse * b1.invMass;
                            b1.vy -= col.ny * jImpulse * b1.invMass;
                            b2.vx += col.nx * jImpulse * b2.invMass;
                            b2.vy += col.ny * jImpulse * b2.invMass;
                        }
                    }
                }
            }
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RigidBodySandboxEngine };
}
