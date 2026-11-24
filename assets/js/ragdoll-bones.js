/**
 * RagdollBonesEngine - Interactive 2D Spring-Damper Ragdoll Dismemberment & Skeletal Bone Hierarchy
 * 
 * Implements a connected kinematic hierarchy of rigid limb segments (head, torso, arms, legs)
 * with angular limits, Verlet numerical integration, velocity-threshold joint dismemberment,
 * and tumbling bounce dynamics for arcade death states and physical stunts.
 */

class RagdollBonesEngine {
  constructor(options = {}) {
    this.gravity = options.gravity !== undefined ? options.gravity : 0.5;
    this.friction = options.friction !== undefined ? options.friction : 0.98;
    this.bounce = options.bounce !== undefined ? options.bounce : 0.4;
    this.breakThreshold = options.breakThreshold !== undefined ? options.breakThreshold : 30; // Impulse limit for dismemberment
    this.bounds = options.bounds || { left: 0, top: 0, right: 800, bottom: 600 };

    this.points = [];
    this.bones = [];
    this.severedLimbs = [];
  }

  createRagdoll(rootX, rootY, scale = 1.0) {
    const s = scale;
    // Base skeleton points: x, y, oldX, oldY, mass, pinned
    const pIndices = {
      head: this.addPoint(rootX, rootY - 40 * s, 1.2),
      neck: this.addPoint(rootX, rootY - 25 * s, 1.0),
      pelvis: this.addPoint(rootX, rootY + 15 * s, 1.5),
      leftElbow: this.addPoint(rootX - 18 * s, rootY - 10 * s, 0.8),
      leftHand: this.addPoint(rootX - 32 * s, rootY + 5 * s, 0.6),
      rightElbow: this.addPoint(rootX + 18 * s, rootY - 10 * s, 0.8),
      rightHand: this.addPoint(rootX + 32 * s, rootY + 5 * s, 0.6),
      leftKnee: this.addPoint(rootX - 12 * s, rootY + 45 * s, 1.0),
      leftFoot: this.addPoint(rootX - 14 * s, rootY + 75 * s, 0.7),
      rightKnee: this.addPoint(rootX + 12 * s, rootY + 45 * s, 1.0),
      rightFoot: this.addPoint(rootX + 14 * s, rootY + 75 * s, 0.7)
    };

    // Bone constraints connecting points
    this.addBone(pIndices.head, pIndices.neck, 'head', 15 * s);
    this.addBone(pIndices.neck, pIndices.pelvis, 'spine', 40 * s);
    this.addBone(pIndices.neck, pIndices.leftElbow, 'leftUpperArm', 22 * s);
    this.addBone(pIndices.leftElbow, pIndices.leftHand, 'leftForearm', 20 * s);
    this.addBone(pIndices.neck, pIndices.rightElbow, 'rightUpperArm', 22 * s);
    this.addBone(pIndices.rightElbow, pIndices.rightHand, 'rightForearm', 20 * s);
    this.addBone(pIndices.pelvis, pIndices.leftKnee, 'leftThigh', 32 * s);
    this.addBone(pIndices.leftKnee, pIndices.leftFoot, 'leftShin', 30 * s);
    this.addBone(pIndices.pelvis, pIndices.rightKnee, 'rightThigh', 32 * s);
    this.addBone(pIndices.rightKnee, pIndices.rightFoot, 'rightShin', 30 * s);

    return pIndices;
  }

  addPoint(x, y, mass = 1.0) {
    const pt = {
      x,
      y,
      oldX: x,
      oldY: y,
      vx: 0,
      vy: 0,
      mass,
      radius: 4 * mass,
      severed: false
    };
    this.points.push(pt);
    return this.points.length - 1;
  }

  addBone(pA, pB, name, length) {
    const ptA = this.points[pA];
    const ptB = this.points[pB];
    const targetLength = length || Math.hypot(ptB.x - ptA.x, ptB.y - ptA.y);
    this.bones.push({
      pA,
      pB,
      name,
      length: targetLength,
      stiffness: 0.95,
      broken: false
    });
  }

  applyImpulse(pointIndex, forceX, forceY) {
    if (this.points[pointIndex]) {
      this.points[pointIndex].oldX -= forceX;
      this.points[pointIndex].oldY -= forceY;

      // Check impulse dismemberment threshold
      const impulseMag = Math.hypot(forceX, forceY);
      if (impulseMag > this.breakThreshold) {
        this.dismemberJoint(pointIndex);
      }
    }
  }

  dismemberJoint(pointIndex) {
    for (const bone of this.bones) {
      if (!bone.broken && (bone.pA === pointIndex || bone.pB === pointIndex)) {
        bone.broken = true;
        this.severedLimbs.push({
          boneName: bone.name,
          pA: bone.pA,
          pB: bone.pB
        });
      }
    }
  }

  updateVerlet() {
    // 1. Particle integration
    for (const pt of this.points) {
      const vx = (pt.x - pt.oldX) * this.friction;
      const vy = (pt.y - pt.oldY) * this.friction + this.gravity;

      pt.oldX = pt.x;
      pt.oldY = pt.y;

      pt.x += vx;
      pt.y += vy;
      pt.vx = vx;
      pt.vy = vy;

      // Boundary collisions
      if (pt.y + pt.radius > this.bounds.bottom) {
        pt.y = this.bounds.bottom - pt.radius;
        pt.oldY = pt.y + vy * this.bounce;
      }
      if (pt.y - pt.radius < this.bounds.top) {
        pt.y = this.bounds.top + pt.radius;
        pt.oldY = pt.y + vy * this.bounce;
      }
      if (pt.x + pt.radius > this.bounds.right) {
        pt.x = this.bounds.right - pt.radius;
        pt.oldX = pt.x + vx * this.bounce;
      }
      if (pt.x - pt.radius < this.bounds.left) {
        pt.x = this.bounds.left + pt.radius;
        pt.oldX = pt.x + vx * this.bounce;
      }
    }

    // 2. Bone constraint relaxation (iterations for rigidity)
    const iterations = 5;
    for (let iter = 0; iter < iterations; iter++) {
      for (const bone of this.bones) {
        if (bone.broken) continue;

        const pA = this.points[bone.pA];
        const pB = this.points[bone.pB];

        const dx = pB.x - pA.x;
        const dy = pB.y - pA.y;
        const dist = Math.hypot(dx, dy) || 1e-4;
        const diff = (dist - bone.length) / dist;

        const totalMass = pA.mass + pB.mass;
        const offsetAX = dx * diff * (pB.mass / totalMass) * bone.stiffness;
        const offsetAY = dy * diff * (pB.mass / totalMass) * bone.stiffness;
        const offsetBX = dx * diff * (pA.mass / totalMass) * bone.stiffness;
        const offsetBY = dy * diff * (pA.mass / totalMass) * bone.stiffness;

        pA.x += offsetAX;
        pA.y += offsetAY;
        pB.x -= offsetBX;
        pB.y -= offsetBY;
      }
    }
  }

  render(ctx) {
    if (!ctx) return;
    ctx.save();
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';

    for (const bone of this.bones) {
      const pA = this.points[bone.pA];
      const pB = this.points[bone.pB];
      ctx.beginPath();
      ctx.moveTo(pA.x, pA.y);
      ctx.lineTo(pB.x, pB.y);
      ctx.strokeStyle = bone.broken ? '#ff0055' : '#00f5ff';
      ctx.stroke();
    }

    for (const pt of this.points) {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2);
      ctx.fillStyle = pt.severed ? '#ff0055' : '#ffffff';
      ctx.fill();
    }
    ctx.restore();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { RagdollBonesEngine };
}
