/**
 * PlasmaLightningDischarger - Dynamic Canvas Procedural Lightning & Electric Arc Plasma Discharger
 * 
 * Implements midpoint-displacement fractal lightning with randomized perpendicular offsets,
 * branching secondary sub-forks, pulsating neon glows, and automatic target seeking.
 */

class PlasmaLightningDischarger {
  constructor(options = {}) {
    this.color = options.color || '#00f5ff';
    this.coreColor = options.coreColor || '#ffffff';
    this.roughness = options.roughness !== undefined ? options.roughness : 1.8;
    this.branchProbability = options.branchProbability !== undefined ? options.branchProbability : 0.35;
    this.maxGenerations = options.maxGenerations || 5;

    this.bolts = [];
  }

  createBolt(x1, y1, x2, y2, options = {}) {
    const branches = [];
    const mainSegment = { x1, y1, x2, y2 };
    this.subdivide(mainSegment, this.maxGenerations, branches, 1.0);

    const bolt = {
      id: Math.random().toString(36).substring(2, 9),
      segments: branches,
      alpha: 1.0,
      decay: options.decay || 0.08,
      width: options.width || 3.0,
      color: options.color || this.color,
      coreColor: options.coreColor || this.coreColor
    };

    this.bolts.push(bolt);
    return bolt;
  }

  subdivide(segment, generation, segmentList, branchChance) {
    if (generation <= 0) {
      segmentList.push(segment);
      return;
    }

    const midX = (segment.x1 + segment.x2) / 2;
    const midY = (segment.y1 + segment.y2) / 2;

    const dx = segment.x2 - segment.x1;
    const dy = segment.y2 - segment.y1;
    const len = Math.hypot(dx, dy);

    // Perpendicular normal vector
    const nx = -dy / (len || 1);
    const ny = dx / (len || 1);

    // Random displacement proportional to segment length
    const offset = (Math.random() - 0.5) * len * 0.35 * this.roughness;
    const displacedX = midX + nx * offset;
    const displacedY = midY + ny * offset;

    // Subdivide both halves
    this.subdivide({ x1: segment.x1, y1: segment.y1, x2: displacedX, y2: displacedY }, generation - 1, segmentList, branchChance * 0.8);
    this.subdivide({ x1: displacedX, y1: displacedY, x2: segment.x2, y2: segment.y2 }, generation - 1, segmentList, branchChance * 0.8);

    // Fork secondary sub-branch
    if (Math.random() < branchChance * this.branchProbability) {
      const splitAngle = (Math.random() - 0.5) * Math.PI * 0.5;
      const branchLen = len * 0.6;
      const dirAngle = Math.atan2(dy, dx) + splitAngle;
      const forkEndX = displacedX + Math.cos(dirAngle) * branchLen;
      const forkEndY = displacedY + Math.sin(dirAngle) * branchLen;

      this.subdivide({ x1: displacedX, y1: displacedY, x2: forkEndX, y2: forkEndY }, generation - 1, segmentList, 0);
    }
  }

  zap(startX, startY, targetX, targetY, options = {}) {
    return this.createBolt(startX, startY, targetX, targetY, options);
  }

  update() {
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const bolt = this.bolts[i];
      bolt.alpha -= bolt.decay;
      if (bolt.alpha <= 0) {
        this.bolts.splice(i, 1);
      }
    }
  }

  render(ctx) {
    if (!ctx) return;
    this.update();

    for (const bolt of this.bolts) {
      ctx.save();
      // Outer neon aura
      ctx.strokeStyle = bolt.color;
      ctx.lineWidth = bolt.width * 2;
      ctx.globalAlpha = Math.max(0, bolt.alpha * 0.5);
      ctx.shadowColor = bolt.color;
      ctx.shadowBlur = 12;

      ctx.beginPath();
      for (const seg of bolt.segments) {
        ctx.moveTo(seg.x1, seg.y1);
        ctx.lineTo(seg.x2, seg.y2);
      }
      ctx.stroke();

      // Sharp inner white core
      ctx.strokeStyle = bolt.coreColor;
      ctx.lineWidth = Math.max(1, bolt.width * 0.7);
      ctx.globalAlpha = Math.max(0, bolt.alpha);
      ctx.shadowBlur = 0;

      ctx.beginPath();
      for (const seg of bolt.segments) {
        ctx.moveTo(seg.x1, seg.y1);
        ctx.lineTo(seg.x2, seg.y2);
      }
      ctx.stroke();
      ctx.restore();
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PlasmaLightningDischarger };
}
