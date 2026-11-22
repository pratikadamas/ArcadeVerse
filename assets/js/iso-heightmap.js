/**
 * Pure Vanilla Canvas Isometric 2.5D Tilemap Stacking & Heightmap Renderer
 * Pure HTML5 Canvas 2D & Isometric Projection Engine
 * Parses 2D integer elevation heightmaps (0 to 16 blocks tall), renders diamond isometric
 * projected voxel blocks with top/left/right directional shading, Painter's algorithm
 * depth sorting (x + y), and screen-to-world reverse affine picking.
 *
 * @module IsoHeightmap
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
    root.ArcadeVerse.IsoHeightmap = factory();
    root.IsoHeightmap = root.ArcadeVerse.IsoHeightmap;
  }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  function IsoHeightmap(options) {
    this.options = Object.assign({
      tileWidth: 32,
      tileHeight: 16,
      blockHeight: 12,
      originX: 400,
      originY: 150,
      topColor: '#10b981',
      leftColor: '#059669',
      rightColor: '#047857'
    }, options);

    this.heightmap = []; // 2D array [row][col] of integer heights
    this.cols = 0;
    this.rows = 0;
  }

  IsoHeightmap.prototype.loadHeightmap = function (matrix2D) {
    this.heightmap = matrix2D;
    this.rows = matrix2D.length;
    this.cols = matrix2D[0] ? matrix2D[0].length : 0;
  };

  /**
   * Classical isometric forward projection:
   * screenX = originX + (gx - gy) * (tileWidth / 2)
   * screenY = originY + (gx + gy) * (tileHeight / 2) - (height * blockHeight)
   */
  IsoHeightmap.prototype.gridToScreen = function (gx, gy, h) {
    h = h || 0;
    var tw2 = this.options.tileWidth / 2;
    var th2 = this.options.tileHeight / 2;
    var sx = this.options.originX + (gx - gy) * tw2;
    var sy = this.options.originY + (gx + gy) * th2 - (h * this.options.blockHeight);
    return { x: sx, y: sy };
  };

  /**
   * Reverse affine picking: converts screen (x, y) to (gridX, gridY) at ground plane
   */
  IsoHeightmap.prototype.screenToGrid = function (sx, sy) {
    var tw2 = this.options.tileWidth / 2;
    var th2 = this.options.tileHeight / 2;
    var dx = sx - this.options.originX;
    var dy = sy - this.options.originY;

    var gx = (dx / tw2 + dy / th2) / 2;
    var gy = (dy / th2 - dx / tw2) / 2;

    return {
      gridX: Math.floor(gx),
      gridY: Math.floor(gy)
    };
  };

  /**
   * Draws a single extruded voxel block with directional lighting faces
   */
  IsoHeightmap.prototype.drawVoxelBlock = function (ctx, gx, gy, h) {
    var pos = this.gridToScreen(gx, gy, h);
    var tw2 = this.options.tileWidth / 2;
    var th2 = this.options.tileHeight / 2;
    var bh = this.options.blockHeight;

    var px = pos.x;
    var py = pos.y;

    // 1. Top Diamond Face
    ctx.fillStyle = this.options.topColor;
    ctx.beginPath();
    ctx.moveTo(px, py - th2);
    ctx.lineTo(px + tw2, py);
    ctx.lineTo(px, py + th2);
    ctx.lineTo(px - tw2, py);
    ctx.closePath();
    ctx.fill();

    // 2. Left Shaded Face
    ctx.fillStyle = this.options.leftColor;
    ctx.beginPath();
    ctx.moveTo(px - tw2, py);
    ctx.lineTo(px, py + th2);
    ctx.lineTo(px, py + th2 + bh);
    ctx.lineTo(px - tw2, py + bh);
    ctx.closePath();
    ctx.fill();

    // 3. Right Dark Face
    ctx.fillStyle = this.options.rightColor;
    ctx.beginPath();
    ctx.moveTo(px, py + th2);
    ctx.lineTo(px + tw2, py);
    ctx.lineTo(px + tw2, py + bh);
    ctx.lineTo(px, py + th2 + bh);
    ctx.closePath();
    ctx.fill();
  };

  /**
   * Painter's Algorithm Depth-Sorted Rendering
   */
  IsoHeightmap.prototype.render = function (ctx) {
    if (!ctx || !this.heightmap.length) return;

    // Back-to-front depth order: sort by (gx + gy)
    for (var r = 0; r < this.rows; r++) {
      for (var c = 0; c < this.cols; c++) {
        var elevation = this.heightmap[r][c] || 0;
        // Stack blocks vertically from ground to elevation
        for (var h = 0; h < elevation; h++) {
          this.drawVoxelBlock(ctx, c, r, h);
        }
      }
    }
  };

  return IsoHeightmap;
});
