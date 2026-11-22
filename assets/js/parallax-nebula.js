/**
 * Parallax Starfield & Space Nebula Canvas Generator
 * Pure Vanilla JS & HTML5 2D Canvas Procedural Engine
 * Generates 3-layer parallax starfields with twinkling flares,
 * procedural cellular/value-noise nebula gas clouds, mouse/gyro tilt inertia,
 * and prefers-reduced-motion accessibility compliance.
 *
 * @module ParallaxNebula
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
    root.ArcadeVerse.ParallaxNebula = factory();
    root.ParallaxNebula = root.ArcadeVerse.ParallaxNebula;
  }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  // Seeded Linear Congruential Generator for reproducible procedural star patterns
  function createRng(seed) {
    var s = (seed || 1337) >>> 0;
    return function () {
      s = (Math.imul(1664525, s) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  // 2D Value Noise Synthesizer for procedural nebula clouds
  var Noise2D = (function () {
    var PERM = new Uint8Array(512);
    var p = [
      151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,
      8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,
      35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,
      134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,
      55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,
      18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,
      250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,
      189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,
      172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,
      228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,
      107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,
      138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180
    ];
    for (var i = 0; i < 256; i++) {
      PERM[i] = p[i];
      PERM[256 + i] = p[i];
    }

    function fade(t) {
      return t * t * t * (t * (t * 6 - 15) + 10);
    }

    function lerp(t, a, b) {
      return a + t * (b - a);
    }

    function grad(hash, x, y) {
      var h = hash & 7;
      var u = h < 4 ? x : y;
      var v = h < 4 ? y : x;
      return ((h & 1) ? -u : u) + ((h & 2) ? -2.0 * v : 2.0 * v);
    }

    return {
      perlin2D: function (x, y) {
        var X = Math.floor(x) & 255;
        var Y = Math.floor(y) & 255;
        var xf = x - Math.floor(x);
        var yf = y - Math.floor(y);

        var u = fade(xf);
        var v = fade(yf);

        var A = PERM[X] + Y;
        var B = PERM[X + 1] + Y;

        return lerp(v,
          lerp(u, grad(PERM[A], xf, yf), grad(PERM[B], xf - 1, yf)),
          lerp(u, grad(PERM[A + 1], xf, yf - 1), grad(PERM[B + 1], xf - 1, yf - 1))
        );
      },
      fractalOctaves: function (x, y, octaves, persistence) {
        var total = 0;
        var frequency = 1;
        var amplitude = 1;
        var maxValue = 0;
        octaves = octaves || 4;
        persistence = persistence || 0.5;

        for (var o = 0; o < octaves; o++) {
          total += this.perlin2D(x * frequency, y * frequency) * amplitude;
          maxValue += amplitude;
          amplitude *= persistence;
          frequency *= 2.0;
        }
        return total / maxValue;
      }
    };
  })();

  /**
   * ParallaxNebula Generator Constructor
   * @param {HTMLCanvasElement|string} canvasElement
   * @param {Object} [options]
   */
  function ParallaxNebula(canvasElement, options) {
    if (typeof canvasElement === 'string') {
      this.canvas = document.querySelector(canvasElement);
    } else {
      this.canvas = canvasElement;
    }

    if (!this.canvas || !this.canvas.getContext) {
      throw new Error('[ParallaxNebula] Valid HTML5 Canvas element required.');
    }

    this.ctx = this.canvas.getContext('2d');
    this.options = Object.assign({
      starCount: 240,
      layers: 3,
      nebulaEnabled: true,
      nebulaHue: 275, // Cosmic violet / deep cyan
      nebulaScale: 0.003,
      nebulaSpeed: 0.0004,
      scrollSpeed: 0.25,
      pixelArtScale: 1, // Optional pixel scaling
      enableMouseReact: true,
      enableGyroTilt: true,
      maxParallaxOffset: 45
    }, options);

    this.width = this.canvas.width || 800;
    this.height = this.canvas.height || 600;

    // Viewport camera and parallax inertia state
    this.camera = {
      x: 0,
      y: 0,
      targetX: 0,
      targetY: 0,
      vx: 0,
      vy: 0
    };

    this.reducedMotion = false;
    this.checkReducedMotion();

    this.time = 0;
    this.rafId = null;
    this.isRunning = false;

    // Off-screen canvas buffer for procedural nebula rendering (optimization)
    if (typeof document !== 'undefined' && document.createElement) {
      this.nebulaCanvas = document.createElement('canvas');
      this.nebulaCtx = this.nebulaCanvas.getContext('2d');
    } else {
      this.nebulaCanvas = {
        width: 100,
        height: 100,
        getContext: function () {
          return {
            createImageData: function (w, h) { return { data: new Uint8ClampedArray(w * h * 4) }; },
            putImageData: function () {}
          };
        }
      };
      this.nebulaCtx = this.nebulaCanvas.getContext('2d');
    }
    this.nebulaDirty = true;
    this.nebulaTimer = 0;

    this.initStars();
    this.bindEvents();
    this.resize(this.canvas.clientWidth || this.width, this.canvas.clientHeight || this.height);
  }

  ParallaxNebula.prototype.checkReducedMotion = function () {
    if (typeof window !== 'undefined' && window.matchMedia) {
      var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.reducedMotion = mq.matches;
      var self = this;
      mq.addEventListener('change', function (e) {
        self.reducedMotion = e.matches;
      });
    }
  };

  ParallaxNebula.prototype.initStars = function () {
    var rng = createRng(4208);
    this.stars = [];
    var count = this.options.starCount;

    // 3 distinct depth layers:
    // Layer 0: Distant micro-stars (density 55%, slow speed, subtle twinkle)
    // Layer 1: Midground stars (density 30%, medium speed, moderate twinkle)
    // Layer 2: Foreground prominent stars with retro cross-glint flares (density 15%, fast)
    for (var i = 0; i < count; i++) {
      var layerIndex = 0;
      var r = rng();
      if (r > 0.85) {
        layerIndex = 2;
      } else if (r > 0.55) {
        layerIndex = 1;
      }

      var baseBrightness = 0.3 + rng() * 0.7;
      var twinkleSpeed = 0.002 + rng() * 0.005;
      var hasGlint = (layerIndex === 2 && rng() > 0.65);

      // Retro star colors: Cool blue, warm amber, cyan, pure white
      var starPalette = [
        'rgba(255, 255, 255, ',
        'rgba(180, 220, 255, ',
        'rgba(255, 235, 180, ',
        'rgba(170, 255, 240, '
      ];
      var colorBase = starPalette[Math.floor(rng() * starPalette.length)];

      this.stars.push({
        x: rng() * this.width,
        y: rng() * this.height,
        layer: layerIndex,
        size: layerIndex === 2 ? (rng() > 0.8 ? 2.5 : 2) : (layerIndex === 1 ? 1.5 : 1),
        baseBrightness: baseBrightness,
        twinkleOffset: rng() * Math.PI * 2,
        twinkleSpeed: twinkleSpeed,
        colorBase: colorBase,
        hasGlint: hasGlint,
        glintPhase: rng() * Math.PI
      });
    }
  };

  ParallaxNebula.prototype.bindEvents = function () {
    var self = this;
    this._onMouseMove = function (e) {
      if (!self.options.enableMouseReact || self.reducedMotion) return;
      var rect = self.canvas.getBoundingClientRect();
      var cx = rect.left + rect.width / 2;
      var cy = rect.top + rect.height / 2;
      var normX = (e.clientX - cx) / (rect.width / 2);
      var normY = (e.clientY - cy) / (rect.height / 2);

      self.camera.targetX = normX * self.options.maxParallaxOffset;
      self.camera.targetY = normY * self.options.maxParallaxOffset;
    };

    this._onDeviceOrientation = function (e) {
      if (!self.options.enableGyroTilt || self.reducedMotion || e.gamma === null) return;
      var tiltX = (e.gamma || 0) / 45; // -1 to 1
      var tiltY = ((e.beta || 0) - 45) / 45;

      self.camera.targetX = Math.max(-1, Math.min(1, tiltX)) * self.options.maxParallaxOffset;
      self.camera.targetY = Math.max(-1, Math.min(1, tiltY)) * self.options.maxParallaxOffset;
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('mousemove', this._onMouseMove, { passive: true });
      window.addEventListener('deviceorientation', this._onDeviceOrientation, { passive: true });
    }
  };

  ParallaxNebula.prototype.unbindEvents = function () {
    if (typeof window !== 'undefined') {
      window.removeEventListener('mousemove', this._onMouseMove);
      window.removeEventListener('deviceorientation', this._onDeviceOrientation);
    }
  };

  ParallaxNebula.prototype.resize = function (width, height) {
    this.width = width;
    this.height = height;
    this.canvas.width = width;
    this.canvas.height = height;

    // Buffer canvas for nebula resolution (downscaled for ultra-lightweight execution)
    this.nebulaCanvas.width = Math.max(64, Math.floor(width / 8));
    this.nebulaCanvas.height = Math.max(48, Math.floor(height / 8));
    this.nebulaDirty = true;
  };

  /**
   * Pure procedural value-noise nebula cloud synthesizer (pure canvas 2d math)
   */
  ParallaxNebula.prototype.renderNebulaBuffer = function (t) {
    if (!this.options.nebulaEnabled) return;

    var nw = this.nebulaCanvas.width;
    var nh = this.nebulaCanvas.height;
    var imgData = this.nebulaCtx.createImageData(nw, nh);
    var data = imgData.data;

    var scale = this.options.nebulaScale * 8; // Adjust for low-res grid
    var timeOffset = t * this.options.nebulaSpeed;

    var hue = this.options.nebulaHue;

    for (var y = 0; y < nh; y++) {
      for (var x = 0; x < nw; x++) {
        var idx = (y * nw + x) * 4;
        var n = Noise2D.fractalOctaves(x * scale + timeOffset, y * scale - timeOffset * 0.5, 3, 0.5);
        // Normalize noise [-1, 1] to [0, 1]
        var density = (n + 1) * 0.5;

        // Apply threshold curve for wispy deep-space clouds
        density = Math.pow(density, 2.2) * 1.5;
        if (density > 0.08) {
          // Dual color tone: Primary cosmic hue (e.g., magenta/violet) + secondary cyan shift
          var intensity = Math.min(1, density);
          var r = Math.floor(intensity * 120 + Math.sin(x * 0.1) * 30);
          var g = Math.floor(intensity * 40 + (1 - intensity) * 40);
          var b = Math.floor(intensity * 200 + Math.cos(y * 0.1) * 55);
          var alpha = Math.floor(Math.min(0.65, intensity * 0.45) * 255);

          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
          data[idx + 3] = alpha;
        } else {
          data[idx + 3] = 0;
        }
      }
    }

    this.nebulaCtx.putImageData(imgData, 0, 0);
  };

  /**
   * Draw classic retro cross-glint flare for bright primary stars
   */
  ParallaxNebula.prototype.drawStarGlint = function (ctx, x, y, size, alpha) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, ' + (alpha * 0.75).toFixed(3) + ')';
    ctx.lineWidth = 1;
    var arm = size * 3.5;

    // Horizontal & vertical flare lines
    ctx.beginPath();
    ctx.moveTo(x - arm, y);
    ctx.lineTo(x + arm, y);
    ctx.moveTo(x, y - arm);
    ctx.lineTo(x, y + arm);
    ctx.stroke();

    // Center micro diamond
    ctx.fillStyle = 'rgba(255, 255, 255, ' + alpha.toFixed(3) + ')';
    ctx.beginPath();
    ctx.arc(x, y, size * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  ParallaxNebula.prototype.update = function (delta) {
    if (!this.reducedMotion) {
      this.time += delta;

      // Smooth camera interpolation towards target (spring inertia)
      this.camera.x += (this.camera.targetX - this.camera.x) * 0.08;
      this.camera.y += (this.camera.targetY - this.camera.y) * 0.08;

      // Update nebula buffer periodically for performance (every ~100ms)
      this.nebulaTimer += delta;
      if (this.nebulaDirty || this.nebulaTimer > 100) {
        this.renderNebulaBuffer(this.time);
        this.nebulaDirty = false;
        this.nebulaTimer = 0;
      }
    }
  };

  ParallaxNebula.prototype.render = function () {
    var ctx = this.ctx;
    var w = this.width;
    var h = this.height;

    // 1. Deep space void base
    ctx.fillStyle = '#060714';
    ctx.fillRect(0, 0, w, h);

    // 2. Procedural Nebula Gas Cloud Layer (interpolated scaling)
    if (this.options.nebulaEnabled && this.nebulaCanvas) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.imageSmoothingEnabled = true;
      // Slight parallax shift for nebula cloud
      var nebOffsetX = this.reducedMotion ? 0 : this.camera.x * 0.15;
      var nebOffsetY = this.reducedMotion ? 0 : this.camera.y * 0.15;
      ctx.drawImage(this.nebulaCanvas, nebOffsetX, nebOffsetY, w, h);
      ctx.restore();
    }

    // 3. 3-Layer Parallax Starfield
    var layerDepths = [0.2, 0.55, 1.0]; // Parallax velocity coefficients

    for (var i = 0; i < this.stars.length; i++) {
      var s = this.stars[i];
      var depth = layerDepths[s.layer];

      // Parallax coordinate displacement
      var offsetX = this.reducedMotion ? 0 : (this.camera.x * depth);
      var offsetY = this.reducedMotion ? 0 : (this.camera.y * depth);

      // Continuous slow vertical or horizontal cosmic drift
      var driftY = this.reducedMotion ? 0 : (this.time * this.options.scrollSpeed * depth);
      var drawX = (s.x + offsetX) % w;
      var drawY = (s.y + offsetY + driftY) % h;

      if (drawX < 0) drawX += w;
      if (drawY < 0) drawY += h;

      // Dynamic twinkle oscillation
      var twinkle = this.reducedMotion
        ? s.baseBrightness
        : Math.sin(this.time * s.twinkleSpeed + s.twinkleOffset);
      var currentAlpha = Math.max(0.15, Math.min(1.0, s.baseBrightness + twinkle * 0.35));

      if (s.hasGlint && currentAlpha > 0.75) {
        this.drawStarGlint(ctx, drawX, drawY, s.size, currentAlpha);
      } else {
        ctx.fillStyle = s.colorBase + currentAlpha.toFixed(3) + ')';
        ctx.fillRect(Math.floor(drawX), Math.floor(drawY), s.size, s.size);
      }
    }
  };

  ParallaxNebula.prototype.start = function () {
    if (this.isRunning) return;
    this.isRunning = true;
    var self = this;
    var lastTime = (typeof performance !== 'undefined' ? performance.now() : Date.now());

    function loop(now) {
      if (!self.isRunning) return;
      var delta = now - lastTime;
      lastTime = now;

      // Cap delta time for stability during tab unfocus
      if (delta > 100) delta = 100;

      self.update(delta);
      self.render();

      self.rafId = requestAnimationFrame(loop);
    }

    this.rafId = requestAnimationFrame(loop);
  };

  ParallaxNebula.prototype.stop = function () {
    this.isRunning = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  };

  ParallaxNebula.prototype.destroy = function () {
    this.stop();
    this.unbindEvents();
    this.stars = [];
  };

  return ParallaxNebula;
});
