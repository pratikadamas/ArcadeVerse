/**
 * ChaoticPendulumSandbox - 2D Rope & Double Pendulum Chaotic Motion Physics Sandbox
 * 
 * Implements Runge-Kutta 4th order (RK4) numerical integration to simulate
 * the non-linear chaotic dynamics of a double pendulum, rendering fading phosphorescent
 * attractor trajectory trails on HTML5 canvas.
 */

class ChaoticPendulumSandbox {
  constructor(options = {}) {
    this.l1 = options.l1 || 120; // Length of rod 1
    this.l2 = options.l2 || 100; // Length of rod 2
    this.m1 = options.m1 || 10;  // Mass of bob 1
    this.m2 = options.m2 || 10;  // Mass of bob 2
    this.theta1 = options.theta1 !== undefined ? options.theta1 : Math.PI / 2;
    this.theta2 = options.theta2 !== undefined ? options.theta2 : Math.PI / 2;
    this.omega1 = 0; // Angular velocity 1
    this.omega2 = 0; // Angular velocity 2
    this.g = options.g || 9.81;  // Gravity
    this.damping = options.damping || 0.9995; // Air resistance damping

    this.trail = [];
    this.maxTrail = options.maxTrail || 250;
    this.trailColor = options.trailColor || '#00f5ff';
  }

  derivatives(t1, t2, w1, w2) {
    const g = this.g;
    const m1 = this.m1;
    const m2 = this.m2;
    const l1 = this.l1;
    const l2 = this.l2;

    const delta = t1 - t2;

    // Equations of motion for double pendulum
    const den1 = l1 * (2 * m1 + m2 - m2 * Math.cos(2 * t1 - 2 * t2));
    const num1 = -g * (2 * m1 + m2) * Math.sin(t1) - m2 * g * Math.sin(t1 - 2 * t2) -
      2 * Math.sin(delta) * m2 * (w2 * w2 * l2 + w1 * w1 * l1 * Math.cos(delta));
    const alpha1 = num1 / (den1 || 1e-4);

    const den2 = l2 * (2 * m1 + m2 - m2 * Math.cos(2 * t1 - 2 * t2));
    const num2 = 2 * Math.sin(delta) * (w1 * w1 * l1 * (m1 + m2) + g * (m1 + m2) * Math.cos(t1) +
      w2 * w2 * l2 * m2 * Math.cos(delta));
    const alpha2 = num2 / (den2 || 1e-4);

    return { dw1: alpha1, dw2: alpha2 };
  }

  stepRK4(dt = 0.05) {
    const t1 = this.theta1;
    const t2 = this.theta2;
    const w1 = this.omega1;
    const w2 = this.omega2;

    // k1
    const d1 = this.derivatives(t1, t2, w1, w2);

    // k2
    const t1_k2 = t1 + 0.5 * dt * w1;
    const t2_k2 = t2 + 0.5 * dt * w2;
    const w1_k2 = w1 + 0.5 * dt * d1.dw1;
    const w2_k2 = w2 + 0.5 * dt * d1.dw2;
    const d2 = this.derivatives(t1_k2, t2_k2, w1_k2, w2_k2);

    // k3
    const t1_k3 = t1 + 0.5 * dt * w1_k2;
    const t2_k3 = t2 + 0.5 * dt * w2_k2;
    const w1_k3 = w1 + 0.5 * dt * d2.dw1;
    const w2_k3 = w2 + 0.5 * dt * d2.dw2;
    const d3 = this.derivatives(t1_k3, t2_k3, w1_k3, w2_k3);

    // k4
    const t1_k4 = t1 + dt * w1_k3;
    const t2_k4 = t2 + dt * w2_k3;
    const w1_k4 = w1 + dt * d3.dw1;
    const w2_k4 = w2 + dt * d3.dw2;
    const d4 = this.derivatives(t1_k4, t2_k4, w1_k4, w2_k4);

    // Update state
    this.theta1 += (dt / 6) * (w1 + 2 * w1_k2 + 2 * w1_k3 + w1_k4);
    this.theta2 += (dt / 6) * (w2 + 2 * w2_k2 + 2 * w2_k3 + w2_k4);
    this.omega1 = (w1 + (dt / 6) * (d1.dw1 + 2 * d2.dw1 + 2 * d3.dw1 + d4.dw1)) * this.damping;
    this.omega2 = (w2 + (dt / 6) * (d1.dw2 + 2 * d2.dw2 + 2 * d3.dw2 + d4.dw2)) * this.damping;

    // Track tip position for phosphorescent trail
    const pos = this.getTipPosition(400, 200);
    this.trail.push(pos);
    if (this.trail.length > this.maxTrail) {
      this.trail.shift();
    }
  }

  getBob1Position(originX = 0, originY = 0) {
    return {
      x: originX + this.l1 * Math.sin(this.theta1),
      y: originY + this.l1 * Math.cos(this.theta1)
    };
  }

  getTipPosition(originX = 0, originY = 0) {
    const p1 = this.getBob1Position(originX, originY);
    return {
      x: p1.x + this.l2 * Math.sin(this.theta2),
      y: p1.y + this.l2 * Math.cos(this.theta2)
    };
  }

  render(ctx, originX = 400, originY = 200) {
    if (!ctx) return;
    this.stepRK4(0.04);

    ctx.save();
    // Render phosphorescent fading trail
    if (this.trail.length > 1) {
      for (let i = 1; i < this.trail.length; i++) {
        const pA = this.trail[i - 1];
        const pB = this.trail[i];
        const alpha = i / this.trail.length;
        ctx.strokeStyle = this.trailColor;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(pA.x, pA.y);
        ctx.lineTo(pB.x, pB.y);
        ctx.stroke();
      }
    }

    // Render rods and bobs
    const p1 = this.getBob1Position(originX, originY);
    const p2 = this.getTipPosition(originX, originY);

    ctx.globalAlpha = 1.0;
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ffffff';

    // Rod 1
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();

    // Rod 2
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();

    // Bobs
    ctx.fillStyle = '#ff0055';
    ctx.beginPath();
    ctx.arc(p1.x, p1.y, Math.sqrt(this.m1) * 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#00f5ff';
    ctx.beginPath();
    ctx.arc(p2.x, p2.y, Math.sqrt(this.m2) * 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ChaoticPendulumSandbox };
}
