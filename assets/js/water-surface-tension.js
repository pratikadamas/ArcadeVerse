/**
 * WaterSurfacePhysics - 1D Spring-Mass Wave & Surface Tension Engine
 * 
 * Simulates real-time interactive 2D fluid surface waves, droplet impact splashes,
 * surface tension lateral propagation, and buoyant object floating.
 */
class WaterSurfacePhysics {
  constructor(options = {}) {
    this.width = options.width || 800;
    this.height = options.height || 400;
    this.baseHeight = options.baseHeight || 250;
    this.columnsCount = options.columnsCount || 80;
    this.tension = options.tension !== undefined ? options.tension : 0.025;
    this.damping = options.damping !== undefined ? options.damping : 0.025;
    this.spread = options.spread !== undefined ? options.spread : 0.25;

    this.nodes = [];
    const spacing = this.width / (this.columnsCount - 1);
    for (let i = 0; i < this.columnsCount; i++) {
      this.nodes.push({
        x: i * spacing,
        y: this.baseHeight,
        targetY: this.baseHeight,
        velocity: 0,
        acceleration: 0
      });
    }
  }

  splash(x, speed) {
    const spacing = this.width / (this.columnsCount - 1);
    const index = Math.round(Math.max(0, Math.min(this.width, x)) / spacing);
    if (index >= 0 && index < this.nodes.length) {
      this.nodes[index].velocity += speed;
    }
  }

  update(iterations = 8) {
    // 1. Hooke's Law spring oscillation per node
    for (let i = 0; i < this.nodes.length; i++) {
      const node = this.nodes[i];
      const displacement = node.y - node.targetY;
      const loss = -this.damping * node.velocity;
      node.acceleration = -this.tension * displacement + loss;
      node.velocity += node.acceleration;
      node.y += node.velocity;
    }

    // 2. Wave propagation across adjacent surface columns
    const leftDeltas = new Float32Array(this.nodes.length);
    const rightDeltas = new Float32Array(this.nodes.length);

    for (let iter = 0; iter < iterations; iter++) {
      for (let i = 0; i < this.nodes.length; i++) {
        if (i > 0) {
          leftDeltas[i] = this.spread * (this.nodes[i].y - this.nodes[i - 1].y);
          this.nodes[i - 1].velocity += leftDeltas[i];
        }
        if (i < this.nodes.length - 1) {
          rightDeltas[i] = this.spread * (this.nodes[i].y - this.nodes[i + 1].y);
          this.nodes[i + 1].velocity += rightDeltas[i];
        }
      }

      for (let i = 0; i < this.nodes.length; i++) {
        if (i > 0) this.nodes[i - 1].y += leftDeltas[i];
        if (i < this.nodes.length - 1) this.nodes[i + 1].y += rightDeltas[i];
      }
    }
  }

  getSurfaceElevation(x) {
    const spacing = this.width / (this.columnsCount - 1);
    const index = Math.floor(Math.max(0, Math.min(this.width, x)) / spacing);
    if (index < 0) return this.baseHeight;
    if (index >= this.nodes.length - 1) return this.nodes[this.nodes.length - 1].y;

    const t = (x - this.nodes[index].x) / spacing;
    return this.nodes[index].y * (1 - t) + this.nodes[index + 1].y * t;
  }

  render(ctx, color = 'rgba(0, 160, 255, 0.6)') {
    if (!ctx) return;
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, this.height);
    ctx.lineTo(this.nodes[0].x, this.nodes[0].y);

    for (let i = 1; i < this.nodes.length; i++) {
      const prev = this.nodes[i - 1];
      const curr = this.nodes[i];
      const midX = (prev.x + curr.x) / 2;
      const midY = (prev.y + curr.y) / 2;
      ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
    }

    const last = this.nodes[this.nodes.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.lineTo(this.width, this.height);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { WaterSurfacePhysics };
}
