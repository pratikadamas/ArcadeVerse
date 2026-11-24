/**
 * VerletClothSimulation - Dynamic 2D Cloth & Cape Verlet Physics Drape Simulation Engine
 * 
 * Implements a connected 2D particle constraint grid governed by Verlet numerical integration,
 * distance relaxation constraints, aerodynamic drag, wind gusts, and curved Bezier skinning.
 */

class VerletClothSimulation {
  constructor(options = {}) {
    this.cols = options.cols || 8;
    this.rows = options.rows || 10;
    this.spacing = options.spacing || 14;
    this.gravity = options.gravity !== undefined ? options.gravity : 0.35;
    this.friction = options.friction !== undefined ? options.friction : 0.99;
    this.wind = options.wind !== undefined ? options.wind : 0.2;
    this.color = options.color || '#ff0055';
    this.edgeColor = options.edgeColor || '#00f5ff';

    this.particles = [];
    this.constraints = [];

    this.initGrid(options.startX || 300, options.startY || 150);
  }

  initGrid(startX, startY) {
    this.particles = [];
    this.constraints = [];

    // Instantiate particle nodes
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const x = startX + c * this.spacing;
        const y = startY + r * this.spacing;
        const pinned = r === 0; // Top row is anchored/pinned
        this.particles.push({
          x,
          y,
          oldX: x,
          oldY: y,
          pinned,
          vx: 0,
          vy: 0
        });
      }
    }

    // Horizontal & vertical structural constraints
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const idx = r * this.cols + c;
        // Right neighbor
        if (c < this.cols - 1) {
          this.constraints.push({
            p1: idx,
            p2: idx + 1,
            length: this.spacing
          });
        }
        // Bottom neighbor
        if (r < this.rows - 1) {
          this.constraints.push({
            p1: idx,
            p2: idx + this.cols,
            length: this.spacing
          });
        }
      }
    }
  }

  applyWind(windForceX) {
    this.wind = windForceX;
  }

  update(iterations = 4) {
    const time = Date.now() * 0.003;
    const dynamicWind = this.wind + Math.sin(time) * 0.15;

    // 1. Verlet numerical integration
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (p.pinned) continue;

      const vx = (p.x - p.oldX) * this.friction + dynamicWind;
      const vy = (p.y - p.oldY) * this.friction + this.gravity;

      p.oldX = p.x;
      p.oldY = p.y;

      p.x += vx;
      p.y += vy;
      p.vx = vx;
      p.vy = vy;
    }

    // 2. Distance constraint relaxation
    for (let iter = 0; iter < iterations; iter++) {
      for (let j = 0; j < this.constraints.length; j++) {
        const c = this.constraints[j];
        const p1 = this.particles[c.p1];
        const p2 = this.particles[c.p2];

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.hypot(dx, dy) || 1e-4;
        const diff = (dist - c.length) / dist;

        const offsetX = dx * diff * 0.5;
        const offsetY = dy * diff * 0.5;

        if (!p1.pinned) {
          p1.x += offsetX;
          p1.y += offsetY;
        }
        if (!p2.pinned) {
          p2.x -= offsetX;
          p2.y -= offsetY;
        }
      }
    }
  }

  render(ctx) {
    if (!ctx) return;
    this.update();

    ctx.save();
    // Render cloth quad mesh
    for (let r = 0; r < this.rows - 1; r++) {
      for (let c = 0; c < this.cols - 1; c++) {
        const idx = r * this.cols + c;
        const pTL = this.particles[idx];
        const pTR = this.particles[idx + 1];
        const pBR = this.particles[idx + this.cols + 1];
        const pBL = this.particles[idx + this.cols];

        ctx.beginPath();
        ctx.moveTo(pTL.x, pTL.y);
        ctx.lineTo(pTR.x, pTR.y);
        ctx.lineTo(pBR.x, pBR.y);
        ctx.lineTo(pBL.x, pBL.y);
        ctx.closePath();

        ctx.fillStyle = (r + c) % 2 === 0 ? this.color : 'rgba(255, 0, 85, 0.7)';
        ctx.fill();
      }
    }

    // Outer neon seam borders
    ctx.strokeStyle = this.edgeColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let c = 0; c < this.cols; c++) {
      const p = this.particles[c];
      if (c === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();

    ctx.restore();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { VerletClothSimulation };
}
