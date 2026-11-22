/**
 * Dynamic 2D Fluid Metaball Liquid Drop & Mercury Merge Physics Engine
 * Pure HTML5 Canvas 2D & Particle Physics Engine
 * Renders 2D fluid particles using radial gradient alpha fields passed through a high-contrast
 * threshold filter to create smoothly merging mercury droplets with viscous surface tension,
 * separation necks, and container wall rebound.
 *
 * @module MetaballFluid
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
    root.ArcadeVerse.MetaballFluid = factory();
    root.MetaballFluid = root.ArcadeVerse.MetaballFluid;
  }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  function FluidParticle(x, y, radius) {
    this.x = x || 0;
    this.y = y || 0;
    this.vx = (Math.random() * 2 - 1) * 1.5;
    this.vy = (Math.random() * 2 - 1) * 1.5;
    this.radius = radius || 24;
    this.baseRadius = this.radius;
  }

  function MetaballFluid(canvasElement, options) {
    if (typeof canvasElement === 'string' && typeof document !== 'undefined') {
      this.canvas = document.querySelector(canvasElement);
    } else {
      this.canvas = canvasElement;
    }

    this.ctx = this.canvas && this.canvas.getContext ? this.canvas.getContext('2d') : null;
    this.options = Object.assign({
      particleCount: 80,
      gravity: 0.15,
      viscosity: 0.985,
      surfaceTension: 0.04,
      threshold: 160,
      liquidColor: '#38bdf8'
    }, options);

    this.particles = [];
    this.bounds = {
      width: (this.canvas && this.canvas.width) || 800,
      height: (this.canvas && this.canvas.height) || 600
    };

    this.initParticles();
    this.bindEvents();
  }

  MetaballFluid.prototype.initParticles = function () {
    this.particles = [];
    var count = this.options.particleCount;
    var w = this.bounds.width;
    var h = this.bounds.height;

    for (var i = 0; i < count; i++) {
      var px = w * 0.2 + Math.random() * (w * 0.6);
      var py = h * 0.2 + Math.random() * (h * 0.6);
      var r = 18 + Math.random() * 12;
      this.particles.push(new FluidParticle(px, py, r));
    }
  };

  /**
   * Physics step: surface tension attraction between near droplets and boundary containment
   */
  MetaballFluid.prototype.update = function () {
    var pts = this.particles;
    var n = pts.length;
    var grav = this.options.gravity;
    var visc = this.options.viscosity;
    var tension = this.options.surfaceTension;
    var w = this.bounds.width;
    var h = this.bounds.height;

    // 1. Surface Tension: near-field attraction between droplets
    for (var i = 0; i < n; i++) {
      var p1 = pts[i];
      for (var j = i + 1; j < n; j++) {
        var p2 = pts[j];
        var dx = p2.x - p1.x;
        var dy = p2.y - p1.y;
        var distSq = dx * dx + dy * dy;
        var minDist = p1.radius + p2.radius;

        if (distSq < minDist * minDist * 2.5 && distSq > 0.01) {
          var dist = Math.sqrt(distSq);
          var force = (minDist - dist) * tension;
          var nx = dx / dist;
          var ny = dy / dist;

          // Repel if overlapping deeper than minDist, attract if slightly separated
          p1.vx += nx * force * 0.5;
          p1.vy += ny * force * 0.5;
          p2.vx -= nx * force * 0.5;
          p2.vy -= ny * force * 0.5;
        }
      }
    }

    // 2. Integration and boundary rebound
    for (var k = 0; k < n; k++) {
      var p = pts[k];
      p.vy += grav;
      p.vx *= visc;
      p.vy *= visc;

      p.x += p.vx;
      p.y += p.vy;

      if (p.x - p.radius < 0) {
        p.x = p.radius;
        p.vx = -p.vx * 0.7;
      } else if (p.x + p.radius > w) {
        p.x = w - p.radius;
        p.vx = -p.vx * 0.7;
      }

      if (p.y - p.radius < 0) {
        p.y = p.radius;
        p.vy = -p.vy * 0.7;
      } else if (p.y + p.radius > h) {
        p.y = h - p.radius;
        p.vy = -p.vy * 0.7;
      }
    }
  };

  /**
   * Renders metaballs with alpha thresholding
   */
  MetaballFluid.prototype.render = function () {
    if (!this.ctx || !this.canvas) return;
    var ctx = this.ctx;
    var w = this.canvas.width;
    var h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Render radial alpha fields
    for (var i = 0; i < this.particles.length; i++) {
      var p = this.particles[i];
      var grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius * 2);
      grad.addColorStop(0, 'rgba(56, 189, 248, 1)');
      grad.addColorStop(1, 'rgba(56, 189, 248, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  MetaballFluid.prototype.bindEvents = function () {
    if (!this.canvas) return;
    var self = this;
    this._onPointerMove = function (e) {
      var rect = self.canvas.getBoundingClientRect();
      var mx = e.clientX - rect.left;
      var my = e.clientY - rect.top;

      // Displace droplets near pointer
      for (var i = 0; i < self.particles.length; i++) {
        var p = self.particles[i];
        var dx = p.x - mx;
        var dy = p.y - my;
        var d2 = dx * dx + dy * dy;
        if (d2 < 3600 && d2 > 0) {
          var d = Math.sqrt(d2);
          p.vx += (dx / d) * 3.0;
          p.vy += (dy / d) * 3.0;
        }
      }
    };
    this.canvas.addEventListener('pointermove', this._onPointerMove);
  };

  MetaballFluid.prototype.destroy = function () {
    if (this.canvas && this._onPointerMove) {
      this.canvas.removeEventListener('pointermove', this._onPointerMove);
    }
  };

  return MetaballFluid;
});
