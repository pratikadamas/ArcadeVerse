/**
 * Virtual Multi-Touch Arcade Trackball & Inertial Spinner Physics Controller
 * Pure HTML5 Canvas 2D & PointerEvent Physics Controller
 * Simulates physical retro trackball (Centipede, Missile Command) and dial spinner (Arkanoid)
 * controllers with rolling pseudo-3D grid lines, optical spin dots, angular momentum,
 * tangential flick velocity, friction decay, and continuous 'arcade-trackball-move' DOM event dispatch.
 *
 * @module VirtualTrackball
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
    root.ArcadeVerse.VirtualTrackball = factory();
    root.VirtualTrackball = root.ArcadeVerse.VirtualTrackball;
  }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  function VirtualTrackball(canvasElement, options) {
    if (typeof canvasElement === 'string' && typeof document !== 'undefined') {
      this.canvas = document.querySelector(canvasElement);
    } else {
      this.canvas = canvasElement;
    }

    this.ctx = this.canvas && this.canvas.getContext ? this.canvas.getContext('2d') : null;
    this.options = Object.assign({
      mode: 'trackball', // 'trackball' (2D) or 'spinner' (1D rotary dial)
      friction: 0.94,
      sensitivity: 1.2,
      detents: false,
      detentCount: 24,
      orbRadius: 60
    }, options);

    this.vx = 0;
    this.vy = 0;
    this.rotationX = 0;
    this.rotationY = 0;
    this.isDragging = false;
    this.lastPointerX = 0;
    this.lastPointerY = 0;
    this.lastPointerTime = 0;
    this.isRunning = false;
    this.rafId = null;

    this.bindEvents();
  }

  VirtualTrackball.prototype.bindEvents = function () {
    if (!this.canvas) return;
    var self = this;

    this._onPointerDown = function (e) {
      self.isDragging = true;
      self.lastPointerX = e.clientX;
      self.lastPointerY = e.clientY;
      self.lastPointerTime = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      self.vx = 0;
      self.vy = 0;
      if (self.canvas.setPointerCapture) {
        try { self.canvas.setPointerCapture(e.pointerId); } catch (err) {}
      }
    };

    this._onPointerMove = function (e) {
      if (!self.isDragging) return;
      var now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      var dt = Math.max(1, now - self.lastPointerTime);
      var dx = (e.clientX - self.lastPointerX) * self.options.sensitivity;
      var dy = (e.clientY - self.lastPointerY) * self.options.sensitivity;

      self.lastPointerX = e.clientX;
      self.lastPointerY = e.clientY;
      self.lastPointerTime = now;

      if (self.options.mode === 'spinner') {
        dy = 0; // Lock to 1D rotary axis
      }

      // Track immediate velocity for flick inertia
      self.vx = (dx / dt) * 16.6;
      self.vy = (dy / dt) * 16.6;

      self.rotationX += dx * 0.05;
      self.rotationY += dy * 0.05;

      self.dispatchMoveEvent(dx, dy);
    };

    this._onPointerUp = function (e) {
      self.isDragging = false;
      if (self.canvas.releasePointerCapture) {
        try { self.canvas.releasePointerCapture(e.pointerId); } catch (err) {}
      }
    };

    this.canvas.addEventListener('pointerdown', this._onPointerDown);
    this.canvas.addEventListener('pointermove', this._onPointerMove);
    this.canvas.addEventListener('pointerup', this._onPointerUp);
    this.canvas.addEventListener('pointercancel', this._onPointerUp);
  };

  /**
   * Dispatches 'arcade-trackball-move' custom DOM event
   */
  VirtualTrackball.prototype.dispatchMoveEvent = function (dx, dy) {
    if (typeof window === 'undefined' || typeof CustomEvent !== 'function') return;
    try {
      var event = new CustomEvent('arcade-trackball-move', {
        detail: {
          dx: dx,
          dy: dy,
          vx: this.vx,
          vy: this.vy,
          mode: this.options.mode
        },
        bubbles: true
      });
      window.dispatchEvent(event);
    } catch (e) {}
  };

  /**
   * Physics inertia step loop
   */
  VirtualTrackball.prototype.update = function () {
    if (!this.isDragging) {
      if (Math.abs(this.vx) > 0.01 || Math.abs(this.vy) > 0.01) {
        this.vx *= this.options.friction;
        this.vy *= this.options.friction;

        this.rotationX += this.vx * 0.05;
        this.rotationY += this.vy * 0.05;

        this.dispatchMoveEvent(this.vx, this.vy);
      } else {
        this.vx = 0;
        this.vy = 0;
      }
    }
  };

  /**
   * Renders 3D rolling grid lines and optical tracking dots
   */
  VirtualTrackball.prototype.render = function () {
    if (!this.ctx || !this.canvas) return;
    var ctx = this.ctx;
    var w = this.canvas.width;
    var h = this.canvas.height;
    var cx = w / 2;
    var cy = h / 2;
    var r = this.options.orbRadius || (Math.min(w, h) / 2 - 10);

    ctx.clearRect(0, 0, w, h);

    // Bezel housing ring
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
    ctx.stroke();

    // Billiard marble / translucent orb sphere gradient
    var sphereGrad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
    sphereGrad.addColorStop(0, '#f8fafc');
    sphereGrad.addColorStop(0.6, '#94a3b8');
    sphereGrad.addColorStop(1, '#334155');

    ctx.fillStyle = sphereGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Pseudo-3D latitude / longitude rolling curves
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;

    var rollX = (this.rotationX % (Math.PI * 2));
    var rollY = (this.rotationY % (Math.PI * 2));

    for (var i = -2; i <= 2; i++) {
      var lat = cy + Math.sin(rollY + i * 0.8) * (r * 0.8);
      ctx.beginPath();
      ctx.ellipse(cx, lat, r * Math.cos(i * 0.4), r * 0.25, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Optical tracking dot
    var dotX = cx + Math.sin(rollX) * (r * 0.5);
    var dotY = cy + Math.cos(rollY) * (r * 0.5);
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.arc(dotX, dotY, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  VirtualTrackball.prototype.start = function () {
    if (this.isRunning) return;
    this.isRunning = true;
    var self = this;
    function loop() {
      if (!self.isRunning) return;
      self.update();
      self.render();
      self.rafId = requestAnimationFrame(loop);
    }
    this.rafId = requestAnimationFrame(loop);
  };

  VirtualTrackball.prototype.stop = function () {
    this.isRunning = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  };

  VirtualTrackball.prototype.destroy = function () {
    this.stop();
    if (this.canvas) {
      this.canvas.removeEventListener('pointerdown', this._onPointerDown);
      this.canvas.removeEventListener('pointermove', this._onPointerMove);
      this.canvas.removeEventListener('pointerup', this._onPointerUp);
      this.canvas.removeEventListener('pointercancel', this._onPointerUp);
    }
  };

  return VirtualTrackball;
});
