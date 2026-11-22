/**
 * Client-Side Animated Matrix LED Marquee Signage & 5x7 Dot-Font Banner Studio
 * Pure HTML5 Canvas 2D & Retro Dot-Matrix Phosphor Glow Engine
 * Renders physical arcade cabinet dot-matrix LED scoreboards (128x16 diodes),
 * complete ASCII 5x7 bitmask font glyphs, scrolling ticker text,
 * and authentic diode decay/persistence presets (Amber, Ruby, Emerald, Cyan).
 *
 * @module LedMarqueeSignage
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
    root.ArcadeVerse.LedMarqueeSignage = factory();
    root.LedMarqueeSignage = root.ArcadeVerse.LedMarqueeSignage;
  }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  // 5x7 Dot-Matrix Font Glyphs (ASCII 32 to 90: space, punctuation, numbers, uppercase letters)
  // Each entry consists of 5 columns, each column being a 7-bit number (bits 0-6 represent rows)
  var FONT_5X7 = {
    ' ': [0x00, 0x00, 0x00, 0x00, 0x00],
    '!': [0x00, 0x00, 0x5F, 0x00, 0x00],
    '"': [0x00, 0x07, 0x00, 0x07, 0x00],
    '#': [0x14, 0x7F, 0x14, 0x7F, 0x14],
    '$': [0x24, 0x2A, 0x7F, 0x2A, 0x12],
    '%': [0x23, 0x13, 0x08, 0x64, 0x62],
    '&': [0x36, 0x49, 0x55, 0x22, 0x50],
    '\'': [0x00, 0x05, 0x03, 0x00, 0x00],
    '(': [0x00, 0x1C, 0x22, 0x41, 0x00],
    ')': [0x00, 0x41, 0x22, 0x1C, 0x00],
    '*': [0x14, 0x08, 0x3E, 0x08, 0x14],
    '+': [0x08, 0x08, 0x3E, 0x08, 0x08],
    ',': [0x00, 0x50, 0x30, 0x00, 0x00],
    '-': [0x08, 0x08, 0x08, 0x08, 0x08],
    '.': [0x00, 0x60, 0x60, 0x00, 0x00],
    '/': [0x20, 0x10, 0x08, 0x04, 0x02],
    '0': [0x3E, 0x51, 0x49, 0x45, 0x3E],
    '1': [0x00, 0x42, 0x7F, 0x40, 0x00],
    '2': [0x42, 0x61, 0x51, 0x49, 0x46],
    '3': [0x21, 0x41, 0x45, 0x4B, 0x31],
    '4': [0x18, 0x14, 0x12, 0x7F, 0x10],
    '5': [0x27, 0x45, 0x45, 0x45, 0x39],
    '6': [0x3C, 0x4A, 0x49, 0x49, 0x30],
    '7': [0x01, 0x71, 0x09, 0x05, 0x03],
    '8': [0x36, 0x49, 0x49, 0x49, 0x36],
    '9': [0x06, 0x49, 0x49, 0x29, 0x1E],
    ':': [0x00, 0x36, 0x36, 0x00, 0x00],
    ';': [0x00, 0x56, 0x36, 0x00, 0x00],
    '<': [0x08, 0x14, 0x22, 0x41, 0x00],
    '=': [0x14, 0x14, 0x14, 0x14, 0x14],
    '>': [0x00, 0x41, 0x22, 0x14, 0x08],
    '?': [0x02, 0x01, 0x51, 0x09, 0x06],
    '@': [0x32, 0x49, 0x79, 0x41, 0x3E],
    'A': [0x7E, 0x11, 0x11, 0x11, 0x7E],
    'B': [0x7F, 0x49, 0x49, 0x49, 0x36],
    'C': [0x3E, 0x41, 0x41, 0x41, 0x22],
    'D': [0x7F, 0x41, 0x41, 0x22, 0x1C],
    'E': [0x7F, 0x49, 0x49, 0x49, 0x41],
    'F': [0x7F, 0x09, 0x09, 0x09, 0x01],
    'G': [0x3E, 0x41, 0x49, 0x49, 0x7A],
    'H': [0x7F, 0x08, 0x08, 0x08, 0x7F],
    'I': [0x00, 0x41, 0x7F, 0x41, 0x00],
    'J': [0x20, 0x40, 0x41, 0x3F, 0x01],
    'K': [0x7F, 0x08, 0x14, 0x22, 0x41],
    'L': [0x7F, 0x40, 0x40, 0x40, 0x40],
    'M': [0x7F, 0x02, 0x0C, 0x02, 0x7F],
    'N': [0x7F, 0x04, 0x08, 0x10, 0x7F],
    'O': [0x3E, 0x41, 0x41, 0x41, 0x3E],
    'P': [0x7F, 0x09, 0x09, 0x09, 0x06],
    'Q': [0x3E, 0x41, 0x51, 0x21, 0x5E],
    'R': [0x7F, 0x09, 0x19, 0x29, 0x46],
    'S': [0x46, 0x49, 0x49, 0x49, 0x31],
    'T': [0x01, 0x01, 0x7F, 0x01, 0x01],
    'U': [0x3F, 0x40, 0x40, 0x40, 0x3F],
    'V': [0x1F, 0x20, 0x40, 0x20, 0x1F],
    'W': [0x7F, 0x20, 0x18, 0x20, 0x7F],
    'X': [0x63, 0x14, 0x08, 0x14, 0x63],
    'Y': [0x07, 0x08, 0x70, 0x08, 0x07],
    'Z': [0x61, 0x51, 0x49, 0x45, 0x43]
  };

  var COLORWAYS = {
    amber: { on: '#ffb300', off: '#261b00', glow: 'rgba(255, 179, 0, 0.4)' },
    ruby: { on: '#ff1744', off: '#290007', glow: 'rgba(255, 23, 68, 0.4)' },
    emerald: { on: '#00e676', off: '#002613', glow: 'rgba(0, 230, 118, 0.4)' },
    cyan: { on: '#00e5ff', off: '#002229', glow: 'rgba(0, 229, 255, 0.4)' }
  };

  function LedMarqueeSignage(canvasElement, options) {
    if (typeof canvasElement === 'string' && typeof document !== 'undefined') {
      this.canvas = document.querySelector(canvasElement);
    } else {
      this.canvas = canvasElement;
    }

    this.ctx = this.canvas && this.canvas.getContext ? this.canvas.getContext('2d') : null;
    this.options = Object.assign({
      cols: 128,
      rows: 16,
      dotSize: 4,
      dotGap: 1,
      scrollSpeed: 1.5,
      colorway: 'amber',
      text: 'ARCADEVERSE RETRO TICKER'
    }, options);

    this.cols = this.options.cols;
    this.rows = this.options.rows;
    this.text = this.options.text;
    this.colorScheme = COLORWAYS[this.options.colorway] || COLORWAYS.amber;
    this.scrollOffset = 0;
    this.isRunning = false;
    this.rafId = null;

    this.gridBuffer = [];
    for (var r = 0; r < this.rows; r++) {
      this.gridBuffer[r] = new Uint8Array(this.cols);
    }

    this.buildTextMatrix();
    this.setupObserver();
  }

  LedMarqueeSignage.COLORWAYS = COLORWAYS;
  LedMarqueeSignage.FONT = FONT_5X7;

  LedMarqueeSignage.prototype.buildTextMatrix = function () {
    var upper = this.text.toUpperCase();
    this.fullTextCols = [];

    for (var i = 0; i < upper.length; i++) {
      var char = upper[i];
      var glyph = FONT_5X7[char] || FONT_5X7[' '];
      for (var c = 0; c < 5; c++) {
        this.fullTextCols.push(glyph[c]);
      }
      // Add 1 blank column between letters
      this.fullTextCols.push(0);
    }
    // Trailing buffer spaces
    for (var s = 0; s < 10; s++) {
      this.fullTextCols.push(0);
    }
  };

  LedMarqueeSignage.prototype.update = function () {
    this.scrollOffset += this.options.scrollSpeed;
    if (this.scrollOffset >= this.fullTextCols.length) {
      this.scrollOffset = 0;
    }

    var baseCol = Math.floor(this.scrollOffset);
    var verticalMargin = Math.floor((this.rows - 7) / 2);

    // Populate active 128x16 diode states
    for (var x = 0; x < this.cols; x++) {
      var sourceColIdx = (baseCol + x) % this.fullTextCols.length;
      var bitCol = this.fullTextCols[sourceColIdx] || 0;

      for (var y = 0; y < this.rows; y++) {
        var charRow = y - verticalMargin;
        if (charRow >= 0 && charRow < 7) {
          var isLit = (bitCol & (1 << charRow)) !== 0;
          this.gridBuffer[y][x] = isLit ? 1 : 0;
        } else {
          this.gridBuffer[y][x] = 0;
        }
      }
    }
  };

  LedMarqueeSignage.prototype.render = function () {
    if (!this.ctx) return;
    var ctx = this.ctx;
    var size = this.options.dotSize;
    var gap = this.options.dotGap;
    var pitch = size + gap;

    // Draw background bezel
    ctx.fillStyle = '#0a0a0c';
    ctx.fillRect(0, 0, this.cols * pitch, this.rows * pitch);

    for (var y = 0; y < this.rows; y++) {
      for (var x = 0; x < this.cols; x++) {
        var px = x * pitch;
        var py = y * pitch;
        var isLit = this.gridBuffer[y][x] === 1;

        if (isLit) {
          ctx.fillStyle = this.colorScheme.on;
          ctx.shadowColor = this.colorScheme.glow;
          ctx.shadowBlur = size * 1.5;
          ctx.fillRect(px, py, size, size);
        } else {
          ctx.fillStyle = this.colorScheme.off;
          ctx.shadowBlur = 0;
          ctx.fillRect(px, py, size, size);
        }
      }
    }
  };

  LedMarqueeSignage.prototype.setupObserver = function () {
    if (typeof IntersectionObserver === 'undefined' || !this.canvas) return;
    var self = this;
    this.observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          self.start();
        } else {
          self.stop();
        }
      });
    });
    this.observer.observe(this.canvas);
  };

  LedMarqueeSignage.prototype.start = function () {
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

  LedMarqueeSignage.prototype.stop = function () {
    this.isRunning = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  };

  LedMarqueeSignage.prototype.destroy = function () {
    this.stop();
    if (this.observer && this.canvas) {
      this.observer.unobserve(this.canvas);
    }
  };

  return LedMarqueeSignage;
});
