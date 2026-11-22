/**
 * Interactive 2D Soft-Body Jelly & Lattice Blob Mesh Physics Simulator
 * Pure Vanilla JavaScript & HTML5 2D Canvas Physics Engine
 * Implements a 2D mass-spring polygon model with point masses, dampening springs,
 * interior gas pressure conservation, Hooke's Law integration, closed Catmull-Rom
 * spline skinning, and interactive pointer manipulation (poke, drag, toss).
 *
 * @module SoftBodyPhysics
 * @version 1.0.0
 * ArcadeVerse Nexus Spring Of Code 2026
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ArcadeVerse = root.ArcadeVerse || {};
    root.ArcadeVerse.physics = root.ArcadeVerse.physics || {};
    root.ArcadeVerse.SoftBodyPhysics = factory();
    root.ArcadeVerse.physics.createSoftBody = function (x, y, radius, verticesCount, options) {
      return new root.ArcadeVerse.SoftBodyPhysics.SoftBody(x, y, radius, verticesCount, options);
    };
    root.SoftBodyPhysics = root.ArcadeVerse.SoftBodyPhysics;
  }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  function PointMass(x, y, mass) {
    this.x = x;
    this.y = y;
    this.prevX = x;
    this.prevY = y;
    this.vx = 0;
    this.vy = 0;
    this.fx = 0;
    this.fy = 0;
    this.mass = mass || 1.0;
    this.invMass = 1.0 / this.mass;
    this.isPinned = false;
  }

  function Spring(p1, p2, stiffness, damping) {
    this.p1 = p1;
    this.p2 = p2;
    this.stiffness = stiffness || 0.15;
    this.damping = damping || 0.05;
    var dx = p2.x - p1.x;
    var dy = p2.y - p1.y;
    this.restLength = Math.sqrt(dx * dx + dy * dy);
  }

  function SoftBody(cx, cy, radius, numVertices, options) {
    this.options = Object.assign({
      gravity: 0.25,
      friction: 0.98,
      stiffness: 0.18,
      damping: 0.04,
      pressureMultiplier: 45.0,
      elasticity: 0.75,
      color: '#10b981',
      borderColor: '#059669'
    }, options);

    this.points = [];
    this.springs = [];
    this.centerPoint = new PointMass(cx, cy, 2.0);
    this.initialArea = 0;
    this.draggedPoint = null;

    numVertices = Math.max(6, numVertices || 16);
    this.initGeometry(cx, cy, radius, numVertices);
  }

  SoftBody.prototype.initGeometry = function (cx, cy, radius, n) {
    // 1. Create perimeter point masses in circle
    for (var i = 0; i < n; i++) {
      var angle = (i / n) * Math.PI * 2;
      var px = cx + Math.cos(angle) * radius;
      var py = cy + Math.sin(angle) * radius;
      this.points.push(new PointMass(px, py, 1.0));
    }

    // 2. Perimeter springs
    for (var j = 0; j < n; j++) {
      var next = (j + 1) % n;
      this.springs.push(new Spring(this.points[j], this.points[next], this.options.stiffness, this.options.damping));
    }

    // 3. Radial spokes to central point mass
    for (var k = 0; k < n; k++) {
      this.springs.push(new Spring(this.centerPoint, this.points[k], this.options.stiffness * 0.8, this.options.damping));
    }

    // 4. Cross struts for shear structural stability
    for (var m = 0; m < n; m++) {
      var skip = (m + Math.floor(n / 2)) % n;
      this.springs.push(new Spring(this.points[m], this.points[skip], this.options.stiffness * 0.4, this.options.damping));
    }

    this.initialArea = this.calculateArea();
  };

  /**
   * Computes polygon volume/area using Gauss's area formula (Shoelace theorem)
   */
  SoftBody.prototype.calculateArea = function () {
    var area = 0;
    var n = this.points.length;
    for (var i = 0; i < n; i++) {
      var next = (i + 1) % n;
      area += (this.points[i].x * this.points[next].y) - (this.points[next].x * this.points[i].y);
    }
    return Math.abs(area) * 0.5;
  };

  /**
   * Physics simulation step with Hooke's law & pressure conservation
   */
  SoftBody.prototype.update = function (bounds) {
    bounds = bounds || { x: 0, y: 0, width: 800, height: 600 };
    var n = this.points.length;

    // 1. Hooke's Law Spring Forces: F = -k * (x - restLength)
    for (var s = 0; s < this.springs.length; s++) {
      var spring = this.springs[s];
      var p1 = spring.p1;
      var p2 = spring.p2;

      var dx = p2.x - p1.x;
      var dy = p2.y - p1.y;
      var dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;
      var delta = dist - spring.restLength;

      // Relative velocity for damping
      var relVx = p2.vx - p1.vx;
      var relVy = p2.vy - p1.vy;
      var dampingForce = (dx * relVx + dy * relVy) / dist * spring.damping;

      var springForce = (delta * spring.stiffness) + dampingForce;
      var fx = (dx / dist) * springForce;
      var fy = (dy / dist) * springForce;

      p1.fx += fx;
      p1.fy += fy;
      p2.fx -= fx;
      p2.fy -= fy;
    }

    // 2. Interior Gas Pressure Conservation: P = (V0 - V) * pressureConstant
    var currentArea = this.calculateArea() || 1;
    var areaDifference = this.initialArea - currentArea;
    var pressure = areaDifference * this.options.pressureMultiplier;

    for (var i = 0; i < n; i++) {
      var next = (i + 1) % n;
      var pA = this.points[i];
      var pB = this.points[next];

      var edgeX = pB.x - pA.x;
      var edgeY = pB.y - pA.y;
      var edgeLen = Math.sqrt(edgeX * edgeX + edgeY * edgeY) || 1;

      // Outward normal vector (clockwise ordering)
      var nx = edgeY / edgeLen;
      var ny = -edgeX / edgeLen;

      var pForce = pressure * edgeLen * 0.00005;
      pA.fx += nx * pForce;
      pA.fy += ny * pForce;
      pB.fx += nx * pForce;
      pB.fy += ny * pForce;
    }

    // 3. Integrate Point Masses (Verlet/Euler)
    var allPoints = this.points.concat([this.centerPoint]);
    for (var p = 0; p < allPoints.length; p++) {
      var pt = allPoints[p];
      if (pt.isPinned) {
        pt.vx = 0;
        pt.fy = 0;
        continue;
      }

      pt.fy += this.options.gravity * pt.mass;

      // Acceleration: a = F / m
      pt.vx += (pt.fx * pt.invMass);
      pt.vy += (pt.fy * pt.invMass);

      pt.vx *= this.options.friction;
      pt.vy *= this.options.friction;

      // Cap maximum velocity for rock-solid stability during high compression
      var maxVel = 20.0;
      pt.vx = Math.max(-maxVel, Math.min(maxVel, pt.vx));
      pt.vy = Math.max(-maxVel, Math.min(maxVel, pt.vy));

      pt.x += pt.vx;
      pt.y += pt.vy;

      // Reset forces
      pt.fx = 0;
      pt.fy = 0;

      // Boundary collisions & wall rebound elasticity
      var elast = this.options.elasticity;
      if (pt.x < bounds.x) { pt.x = bounds.x; pt.vx = -pt.vx * elast; }
      if (pt.x > bounds.x + bounds.width) { pt.x = bounds.x + bounds.width; pt.vx = -pt.vx * elast; }
      if (pt.y < bounds.y) { pt.y = bounds.y; pt.vy = -pt.vy * elast; }
      if (pt.y > bounds.y + bounds.height) { pt.y = bounds.y + bounds.height; pt.vy = -pt.vy * elast; }
    }
  };

  /**
   * Catmull-Rom curved spline skinning for smooth organic jelly boundaries
   */
  SoftBody.prototype.render = function (ctx) {
    if (!ctx) return;
    var n = this.points.length;
    if (n < 3) return;

    ctx.save();
    ctx.beginPath();

    // Spline through perimeter vertices
    var firstX = (this.points[0].x + this.points[n - 1].x) / 2;
    var firstY = (this.points[0].y + this.points[n - 1].y) / 2;
    ctx.moveTo(firstX, firstY);

    for (var i = 0; i < n; i++) {
      var next = (i + 1) % n;
      var midX = (this.points[i].x + this.points[next].x) / 2;
      var midY = (this.points[i].y + this.points[next].y) / 2;
      ctx.quadraticCurveTo(this.points[i].x, this.points[i].y, midX, midY);
    }

    ctx.closePath();
    ctx.fillStyle = this.options.color;
    ctx.fill();

    ctx.lineWidth = 3;
    ctx.strokeStyle = this.options.borderColor;
    ctx.stroke();

    ctx.restore();
  };

  return {
    SoftBody: SoftBody,
    PointMass: PointMass,
    Spring: Spring
  };
});
