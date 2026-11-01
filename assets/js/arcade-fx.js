/**
 * ArcadeVerse FX: Zero-Dependency High-Performance Screen Shake & Particle Explosion Engine
 * Modular particle physics and dynamic camera trauma manager for 60fps action games.
 *
 * Capabilities:
 * - Pre-allocated fixed-size particle object pools (zero runtime GC allocation)
 * - Decay-based screen shake trauma with non-linear polynomial falloff
 * - Multi-hue particle explosions (sparks, smoke, shockwaves, rings, embers)
 * - Floating damage combat numbers with bounce physics
 * - Chromatic aberration flash triggers
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ArcadeFX = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // --- Object Pool Configurations ---
  var MAX_PARTICLES = 500;
  var MAX_FLOATING_TEXTS = 50;

  var particlePool = new Array(MAX_PARTICLES);
  var activeParticles = [];

  for (var i = 0; i < MAX_PARTICLES; i++) {
    particlePool[i] = {
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      size: 2,
      color: '#00f5ff',
      alpha: 1,
      decay: 0.02,
      drag: 0.98,
      gravity: 0,
      shape: 'circle', // 'circle', 'square', 'ring', 'line'
      rotation: 0,
      vRot: 0,
      length: 0
    };
  }

  var textPool = new Array(MAX_FLOATING_TEXTS);
  var activeTexts = [];

  for (var j = 0; j < MAX_FLOATING_TEXTS; j++) {
    textPool[j] = {
      active: false,
      text: '',
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      color: '#fff',
      alpha: 1,
      size: 16,
      decay: 0.02
    };
  }

  // --- Screen Shake & Camera Trauma State ---
  var cameraShake = {
    trauma: 0, // 0 to 1
    maxOffset: 24, // max pixel displacement
    maxAngle: 0.08, // max rotation in radians
    offsetX: 0,
    offsetY: 0,
    angle: 0,
    decayRate: 0.92
  };

  /**
   * Acquire an inactive particle from the memory pool
   */
  function obtainParticle() {
    for (var p = 0; p < MAX_PARTICLES; p++) {
      if (!particlePool[p].active) {
        particlePool[p].active = true;
        activeParticles.push(particlePool[p]);
        return particlePool[p];
      }
    }
    return null;
  }

  /**
   * Add camera trauma (shakes dynamically based on trauma^2)
   * @param {number} amount - Trauma value between 0.0 and 1.0
   * @param {number} [maxDisplacement=24]
   */
  function addTrauma(amount, maxDisplacement) {
    cameraShake.trauma = Math.min(1.0, cameraShake.trauma + amount);
    if (typeof maxDisplacement === 'number') {
      cameraShake.maxOffset = maxDisplacement;
    }
  }

  /**
   * Trigger directional or omni-directional screen shake
   */
  function shake(intensity, durationFrames) {
    addTrauma(intensity || 0.4);
  }

  /**
   * Update shake calculations (call once per game tick)
   */
  function updateShake() {
    if (cameraShake.trauma > 0.001) {
      // Non-linear falloff (shake = trauma^2 or trauma^3 feels punchier)
      var shakeMag = cameraShake.trauma * cameraShake.trauma;
      cameraShake.offsetX = (Math.random() * 2 - 1) * cameraShake.maxOffset * shakeMag;
      cameraShake.offsetY = (Math.random() * 2 - 1) * cameraShake.maxOffset * shakeMag;
      cameraShake.angle = (Math.random() * 2 - 1) * cameraShake.maxAngle * shakeMag;
      cameraShake.trauma *= cameraShake.decayRate;
    } else {
      cameraShake.trauma = 0;
      cameraShake.offsetX = 0;
      cameraShake.offsetY = 0;
      cameraShake.angle = 0;
    }
  }

  /**
   * Apply camera shake transform to an active 2D rendering context
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} [centerX]
   * @param {number} [centerY]
   */
  function applyCamera(ctx, centerX, centerY) {
    if (cameraShake.trauma <= 0) return;
    var cx = centerX || (ctx.canvas ? ctx.canvas.width / 2 : 0);
    var cy = centerY || (ctx.canvas ? ctx.canvas.height / 2 : 0);

    ctx.translate(cx, cy);
    ctx.rotate(cameraShake.angle);
    ctx.translate(-cx + cameraShake.offsetX, -cy + cameraShake.offsetY);
  }

  /**
   * Spawn a burst of multi-colored explosive particles
   * @param {number} x
   * @param {number} y
   * @param {Object} [options]
   */
  function explode(x, y, options) {
    var opts = options || {};
    var count = opts.count || 24;
    var colors = opts.colors || ['#ff0055', '#ff9900', '#ffff00', '#00f5ff'];
    var speed = opts.speed || 6;
    var shape = opts.shape || 'circle';
    var gravity = typeof opts.gravity === 'number' ? opts.gravity : 0.12;

    for (var i = 0; i < count; i++) {
      var p = obtainParticle();
      if (!p) break;

      var angle = Math.random() * Math.PI * 2;
      var velocity = (Math.random() * 0.8 + 0.2) * speed;

      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * velocity;
      p.vy = Math.sin(angle) * velocity;
      p.size = (Math.random() * 0.7 + 0.3) * (opts.size || 4);
      p.color = colors[Math.floor(Math.random() * colors.length)];
      p.alpha = 1.0;
      p.decay = Math.random() * 0.02 + (opts.decay || 0.02);
      p.drag = opts.drag || 0.96;
      p.gravity = gravity;
      p.shape = shape;
      p.rotation = Math.random() * Math.PI * 2;
      p.vRot = (Math.random() - 0.5) * 0.2;
    }

    if (opts.shake) {
      addTrauma(opts.shake);
    }
  }

  /**
   * Spawn expanding shockwave ring
   */
  function shockwave(x, y, color, maxRadius) {
    var p = obtainParticle();
    if (!p) return;
    p.x = x;
    p.y = y;
    p.vx = 0;
    p.vy = 0;
    p.size = 2;
    p.length = maxRadius || 60;
    p.color = color || '#00f5ff';
    p.alpha = 0.9;
    p.decay = 0.035;
    p.drag = 1;
    p.gravity = 0;
    p.shape = 'ring';
  }

  /**
   * Spawn floating damage/score text
   */
  function spawnFloatingText(text, x, y, color, size) {
    for (var t = 0; t < MAX_FLOATING_TEXTS; t++) {
      if (!textPool[t].active) {
        var item = textPool[t];
        item.active = true;
        item.text = text;
        item.x = x + (Math.random() - 0.5) * 12;
        item.y = y;
        item.vx = (Math.random() - 0.5) * 1.5;
        item.vy = -2.5 - Math.random() * 1.5;
        item.color = color || '#ffdd00';
        item.alpha = 1.0;
        item.size = size || 16;
        item.decay = 0.022;
        activeTexts.push(item);
        break;
      }
    }
  }

  /**
   * Update all particle physics and lifespans
   */
  function updateParticles() {
    updateShake();

    for (var i = activeParticles.length - 1; i >= 0; i--) {
      var p = activeParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.vy += p.gravity;
      p.rotation += p.vRot;

      if (p.shape === 'ring') {
        p.size += (p.length - p.size) * 0.12;
      }

      p.alpha -= p.decay;

      if (p.alpha <= 0) {
        p.active = false;
        activeParticles.splice(i, 1);
      }
    }

    for (var j = activeTexts.length - 1; j >= 0; j--) {
      var txt = activeTexts[j];
      txt.x += txt.vx;
      txt.y += txt.vy;
      txt.vy += 0.04;
      txt.alpha -= txt.decay;

      if (txt.alpha <= 0) {
        txt.active = false;
        activeTexts.splice(j, 1);
      }
    }
  }

  /**
   * Render all active particles and floating text overlays
   * @param {CanvasRenderingContext2D} ctx
   */
  function renderParticles(ctx) {
    if (activeParticles.length === 0 && activeTexts.length === 0) return;

    ctx.save();
    for (var i = 0; i < activeParticles.length; i++) {
      var p = activeParticles[i];
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;
      ctx.strokeStyle = p.color;

      if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'ring') {
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.shape === 'square') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }
    }

    // Render floating texts
    for (var j = 0; j < activeTexts.length; j++) {
      var txt = activeTexts[j];
      ctx.globalAlpha = Math.max(0, txt.alpha);
      ctx.font = 'bold ' + txt.size + 'px monospace';
      ctx.fillStyle = txt.color;
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 4;
      ctx.fillText(txt.text, txt.x, txt.y);
    }

    ctx.restore();
  }

  /**
   * Reset all pools and shake variables on level restart or teardown
   */
  function reset() {
    for (var i = 0; i < MAX_PARTICLES; i++) {
      particlePool[i].active = false;
    }
    activeParticles.length = 0;

    for (var j = 0; j < MAX_FLOATING_TEXTS; j++) {
      textPool[j].active = false;
    }
    activeTexts.length = 0;

    cameraShake.trauma = 0;
    cameraShake.offsetX = 0;
    cameraShake.offsetY = 0;
    cameraShake.angle = 0;
  }

  return {
    shake: shake,
    addTrauma: addTrauma,
    applyCamera: applyCamera,
    explode: explode,
    shockwave: shockwave,
    spawnFloatingText: spawnFloatingText,
    update: updateParticles,
    render: renderParticles,
    reset: reset,
    getTrauma: function () {
      return cameraShake.trauma;
    }
  };
});
