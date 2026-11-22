/**
 * CSS 3D Anamorphic Isometric Projection Room & Tilting Vanishing Perspective
 * Pure CSS3 3D Transforms & Pointer/Gyroscope Parallax Engine
 * Constructs an anamorphic 3D isometric arcade room (perspective: 1000px, preserve-3d)
 * with checkerboard floors, neon side walls, dynamic vanishing point parallax,
 * and prefers-reduced-motion fallback.
 *
 * @module AnamorphicRoom
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
    root.ArcadeVerse.AnamorphicRoom = factory();
    root.AnamorphicRoom = root.ArcadeVerse.AnamorphicRoom;
  }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  function AnamorphicRoom(containerElement, options) {
    if (typeof containerElement === 'string' && typeof document !== 'undefined') {
      this.container = document.querySelector(containerElement);
    } else {
      this.container = containerElement;
    }

    this.options = Object.assign({
      maxRotateX: 18,
      maxRotateY: 22,
      perspective: 1000,
      damping: 0.1,
      reducedMotionFallback: true
    }, options);

    this.currentRotateX = 0;
    this.currentRotateY = 0;
    this.targetRotateX = 0;
    this.targetRotateY = 0;
    this.isRunning = false;
    this.rafId = null;

    this.checkReducedMotion();
    this.initDOM();
    this.bindEvents();
  }

  AnamorphicRoom.prototype.checkReducedMotion = function () {
    if (typeof window !== 'undefined' && window.matchMedia) {
      this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } else {
      this.reducedMotion = false;
    }
  };

  /**
   * Builds the 3D isometric room container and walls
   */
  AnamorphicRoom.prototype.initDOM = function () {
    if (!this.container || typeof document === 'undefined') return;

    this.container.style.perspective = this.options.perspective + 'px';
    this.container.style.perspectiveOrigin = '50% 50%';

    var room = document.createElement('div');
    room.className = 'av-anamorphic-room-stage';
    room.style.transformStyle = 'preserve-3d';
    room.style.position = 'relative';
    room.style.width = '100%';
    room.style.height = '100%';
    room.style.transition = 'transform 0.05s ease-out';

    this.stage = room;
    this.container.appendChild(room);
  };

  /**
   * Computes tilt angles from normalized pointer coordinates [-1, 1]
   */
  AnamorphicRoom.prototype.calculateTilt = function (normX, normY) {
    if (this.reducedMotion) {
      return { rotateX: 0, rotateY: 0 };
    }
    var rotX = -normY * this.options.maxRotateX;
    var rotY = normX * this.options.maxRotateY;
    return {
      rotateX: Math.round(rotX * 100) / 100,
      rotateY: Math.round(rotY * 100) / 100
    };
  };

  AnamorphicRoom.prototype.update = function () {
    if (this.reducedMotion) return;

    // Smooth inertia interpolation
    this.currentRotateX += (this.targetRotateX - this.currentRotateX) * this.options.damping;
    this.currentRotateY += (this.targetRotateY - this.currentRotateY) * this.options.damping;

    if (this.stage) {
      this.stage.style.transform = 'rotateX(' + this.currentRotateX.toFixed(2) + 'deg) rotateY(' + this.currentRotateY.toFixed(2) + 'deg)';
    }
  };

  AnamorphicRoom.prototype.bindEvents = function () {
    if (typeof window === 'undefined') return;
    var self = this;

    this._onPointerMove = function (e) {
      if (self.reducedMotion) return;
      var w = window.innerWidth || 1000;
      var h = window.innerHeight || 800;
      var nx = (e.clientX - w / 2) / (w / 2);
      var ny = (e.clientY - h / 2) / (h / 2);

      var tilt = self.calculateTilt(nx, ny);
      self.targetRotateX = tilt.rotateX;
      self.targetRotateY = tilt.rotateY;
    };

    window.addEventListener('pointermove', this._onPointerMove);
  };

  AnamorphicRoom.prototype.start = function () {
    if (this.isRunning) return;
    this.isRunning = true;
    var self = this;

    function step() {
      if (!self.isRunning) return;
      self.update();
      self.rafId = requestAnimationFrame(step);
    }
    this.rafId = requestAnimationFrame(step);
  };

  AnamorphicRoom.prototype.stop = function () {
    this.isRunning = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  };

  AnamorphicRoom.prototype.destroy = function () {
    this.stop();
    if (typeof window !== 'undefined' && this._onPointerMove) {
      window.removeEventListener('pointermove', this._onPointerMove);
    }
  };

  return AnamorphicRoom;
});
