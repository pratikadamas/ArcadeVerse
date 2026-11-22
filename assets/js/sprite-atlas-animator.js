/**
 * Dynamic Canvas Sprite Sheet Atlas Slicer & Multi-Track Frame Sequence Animator
 * Pure Vanilla JavaScript & HTML5 2D Canvas Sprite Management Engine
 * Accepts uniform grid matrices (cols, rows, frame dimensions, padding) or custom JSON slices,
 * manages named multi-track animation states (idle, run, jump, attack, death) with delta-time
 * progression decoupled from refresh rate, and dynamic canvas rendering with flip/scale/rotate.
 *
 * @module SpriteAtlasAnimator
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
    root.ArcadeVerse.SpriteAtlasAnimator = factory();
    root.SpriteAtlasAnimator = root.ArcadeVerse.SpriteAtlasAnimator;
  }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  function SpriteAtlasAnimator(options) {
    this.options = Object.assign({
      frameWidth: 32,
      frameHeight: 32,
      columns: 1,
      rows: 1,
      padding: 0,
      margin: 0,
      fps: 12
    }, options);

    this.slices = []; // Array of { x, y, width, height }
    this.animations = {}; // { name: { frames: [indices], fps, loop, onComplete } }
    this.currentTrack = null;
    this.currentFrameIndex = 0;
    this.frameTimer = 0;
    this.isPaused = false;

    if (this.options.slices && Array.isArray(this.options.slices)) {
      this.slices = this.options.slices;
    } else {
      this.generateUniformGridSlices();
    }
  }

  /**
   * Automatically slices sprite grid into bounding coordinates
   */
  SpriteAtlasAnimator.prototype.generateUniformGridSlices = function () {
    this.slices = [];
    var fw = this.options.frameWidth;
    var fh = this.options.frameHeight;
    var cols = this.options.columns;
    var rows = this.options.rows;
    var pad = this.options.padding;
    var mar = this.options.margin;

    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var x = mar + c * (fw + pad);
        var y = mar + r * (fh + pad);
        this.slices.push({
          x: x,
          y: y,
          width: fw,
          height: fh
        });
      }
    }
  };

  /**
   * Registers a named animation track
   * e.g. defineTrack('run', [0, 1, 2, 3], { fps: 10, loop: true })
   */
  SpriteAtlasAnimator.prototype.defineTrack = function (name, frameIndices, trackOptions) {
    trackOptions = Object.assign({
      fps: this.options.fps,
      loop: true,
      onFrame: null,
      onComplete: null
    }, trackOptions);

    this.animations[name] = {
      frames: frameIndices || [0],
      fps: trackOptions.fps,
      loop: trackOptions.loop,
      onFrame: trackOptions.onFrame,
      onComplete: trackOptions.onComplete
    };

    if (!this.currentTrack) {
      this.play(name);
    }
    return this;
  };

  /**
   * Switches active animation track
   */
  SpriteAtlasAnimator.prototype.play = function (trackName, reset) {
    if (!this.animations[trackName]) return;
    if (this.currentTrack === trackName && !reset) return;

    this.currentTrack = trackName;
    this.currentFrameIndex = 0;
    this.frameTimer = 0;
    this.isPaused = false;
  };

  /**
   * Advances animation state using high-precision delta-time (milliseconds)
   */
  SpriteAtlasAnimator.prototype.update = function (deltaMs) {
    if (this.isPaused || !this.currentTrack) return;
    var track = this.animations[this.currentTrack];
    if (!track || track.frames.length === 0) return;

    var frameDuration = 1000 / (track.fps || 12);
    this.frameTimer += deltaMs;

    while (this.frameTimer >= frameDuration) {
      this.frameTimer -= frameDuration;
      var nextIndex = this.currentFrameIndex + 1;

      if (nextIndex >= track.frames.length) {
        if (track.loop) {
          this.currentFrameIndex = 0;
        } else {
          this.currentFrameIndex = track.frames.length - 1;
          this.isPaused = true;
          if (typeof track.onComplete === 'function') {
            track.onComplete();
          }
          break;
        }
      } else {
        this.currentFrameIndex = nextIndex;
      }

      if (typeof track.onFrame === 'function') {
        track.onFrame(this.currentFrameIndex, track.frames[this.currentFrameIndex]);
      }
    }
  };

  /**
   * Retrieves current slice bounding box
   */
  SpriteAtlasAnimator.prototype.getCurrentSlice = function () {
    if (!this.currentTrack) return this.slices[0] || null;
    var track = this.animations[this.currentTrack];
    if (!track) return this.slices[0] || null;

    var sliceIdx = track.frames[this.currentFrameIndex];
    return this.slices[sliceIdx] || this.slices[0] || null;
  };

  /**
   * Dynamic Canvas Rendering helper with flip, scale, and rotation
   */
  SpriteAtlasAnimator.prototype.render = function (ctx, imageSource, x, y, renderOptions) {
    if (!ctx) return;
    renderOptions = Object.assign({
      flipX: false,
      flipY: false,
      scale: 1,
      rotation: 0
    }, renderOptions);

    var slice = this.getCurrentSlice();
    if (!slice) return;

    var w = slice.width;
    var h = slice.height;

    ctx.save();
    ctx.translate(x, y);

    if (renderOptions.rotation !== 0) {
      ctx.rotate(renderOptions.rotation);
    }

    var scaleX = (renderOptions.flipX ? -1 : 1) * renderOptions.scale;
    var scaleY = (renderOptions.flipY ? -1 : 1) * renderOptions.scale;
    ctx.scale(scaleX, scaleY);

    if (imageSource && ctx.drawImage) {
      ctx.drawImage(
        imageSource,
        slice.x, slice.y, slice.width, slice.height,
        -w / 2, -h / 2, w, h
      );
    } else {
      // Diagnostic fallback bounding box
      ctx.strokeStyle = '#00ffcc';
      ctx.strokeRect(-w / 2, -h / 2, w, h);
    }

    ctx.restore();
  };

  return SpriteAtlasAnimator;
});
