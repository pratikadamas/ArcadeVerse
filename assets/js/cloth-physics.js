/**
 * 2D Cloth & Soft-Body Mesh Verlet Integration Physics Engine (#1513)
 * Implements Verlet integration: x_new = 2x - x_old + a * dt^2
 * with distance constraint relaxation loops, tearing thresholds,
 * interactive mouse tools (Drag, Scissor Cutter, Pin/Unpin), and sinusoidal wind forces.
 */

class ClothPhysicsEngine {
    constructor(cols = 20, rows = 14, spacing = 20, options = {}) {
        this.cols = cols;
        this.rows = rows;
        this.spacing = spacing;

        this.gravity = options.gravity || 0.35;
        this.wind = options.wind || 0.1;
        this.friction = options.friction || 0.99;
        this.tearDistance = options.tearDistance || spacing * 2.8;

        this.points = [];
        this.constraints = [];
        this.tool = 'drag'; // 'drag', 'cut', 'pin'

        this.initMesh();
    }

    initMesh() {
        this.points = [];
        this.constraints = [];

        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                const px = 40 + x * this.spacing;
                const py = 30 + y * this.spacing;
                const pinned = (y === 0 && (x % 3 === 0 || x === this.cols - 1));

                this.points.push({
                    x: px,
                    y: py,
                    oldX: px,
                    oldY: py,
                    pinned,
                    id: y * this.cols + x
                });
            }
        }

        // Horizontal and vertical structural distance constraints
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                const idx = y * this.cols + x;
                // Horizontal link
                if (x < this.cols - 1) {
                    this.constraints.push({
                        p1: this.points[idx],
                        p2: this.points[idx + 1],
                        distance: this.spacing
                    });
                }
                // Vertical link
                if (y < this.rows - 1) {
                    this.constraints.push({
                        p1: this.points[idx],
                        p2: this.points[idx + this.cols],
                        distance: this.spacing
                    });
                }
            }
        }
    }

    updatePhysics(step = 1) {
        // Step 1: Verlet Integration
        const timeFactor = Date.now() * 0.002;
        const windForce = Math.sin(timeFactor) * this.wind;

        for (let i = 0; i < this.points.length; i++) {
            const p = this.points[i];
            if (p.pinned) continue;

            const vx = (p.x - p.oldX) * this.friction;
            const vy = (p.y - p.oldY) * this.friction;

            p.oldX = p.x;
            p.oldY = p.y;

            p.x += vx + windForce;
            p.y += vy + this.gravity;
        }

        // Step 2: Constraint Relaxation & Tearing Check
        for (let iter = 0; iter < 3; iter++) {
            for (let i = this.constraints.length - 1; i >= 0; i--) {
                const c = this.constraints[i];
                const dx = c.p2.x - c.p1.x;
                const dy = c.p2.y - c.p1.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                // Tear if stretched beyond threshold
                if (dist > this.tearDistance) {
                    this.constraints.splice(i, 1);
                    continue;
                }

                if (dist === 0) continue;
                const diff = (c.distance - dist) / dist;
                const offsetX = dx * diff * 0.5;
                const offsetY = dy * diff * 0.5;

                if (!c.p1.pinned) {
                    c.p1.x -= offsetX;
                    c.p1.y -= offsetY;
                }
                if (!c.p2.pinned) {
                    c.p2.x += offsetX;
                    c.p2.y += offsetY;
                }
            }
        }
    }

    cutConstraintAt(x, y, radius = 15) {
        let severed = 0;
        for (let i = this.constraints.length - 1; i >= 0; i--) {
            const c = this.constraints[i];
            const midX = (c.p1.x + c.p2.x) * 0.5;
            const midY = (c.p1.y + c.p2.y) * 0.5;
            const dx = midX - x;
            const dy = midY - y;
            if (dx * dx + dy * dy <= radius * radius) {
                this.constraints.splice(i, 1);
                severed++;
            }
        }
        return severed;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ClothPhysicsEngine };
}
