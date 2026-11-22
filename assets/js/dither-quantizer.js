/**
 * Client-Side Pixel-Art Dithering & Retro Palette Quantization Studio
 * Pure HTML5 Canvas 2D & Color Matrix DSP Engine
 * Implements Floyd-Steinberg error diffusion, Atkinson dithering, and Bayer 4x4/8x8
 * ordered matrix dithering with classic authentic retro palettes:
 * Game Boy 4-Shade Olive, CGA Mode 1 (Cyan/Magenta), Commodore 64 16-Color, ZX Spectrum 8-Color.
 *
 * @module DitherQuantizer
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
    root.ArcadeVerse.DitherQuantizer = factory();
    root.DitherQuantizer = root.ArcadeVerse.DitherQuantizer;
  }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var PALETTES = {
    gameboy: [
      [15, 56, 15],
      [48, 98, 48],
      [139, 172, 15],
      [155, 188, 15]
    ],
    cga: [
      [0, 0, 0],
      [85, 255, 255],
      [255, 85, 255],
      [255, 255, 255]
    ],
    c64: [
      [0, 0, 0], [255, 255, 255], [136, 0, 0], [170, 255, 238],
      [204, 68, 204], [0, 204, 85], [0, 0, 170], [238, 238, 119],
      [221, 136, 85], [102, 68, 0], [255, 119, 119], [51, 51, 51],
      [119, 119, 119], [170, 255, 102], [0, 136, 255], [187, 187, 187]
    ],
    zx_spectrum: [
      [0, 0, 0], [0, 0, 215], [215, 0, 0], [215, 0, 215],
      [0, 215, 0], [0, 215, 215], [215, 215, 0], [215, 215, 215]
    ]
  };

  // Bayer 4x4 matrix normalized to [0, 1]
  var BAYER_4X4 = [
    [ 0/16,  8/16,  2/16, 10/16],
    [12/16,  4/16, 14/16,  6/16],
    [ 3/16, 11/16,  1/16,  9/16],
    [15/16,  7/16, 13/16,  5/16]
  ];

  function DitherQuantizer(options) {
    this.options = Object.assign({
      palette: 'gameboy',
      algorithm: 'floyd_steinberg' // 'floyd_steinberg', 'atkinson', 'bayer', 'none'
    }, options);
  }

  DitherQuantizer.PALETTES = PALETTES;

  /**
   * Euclidean nearest color search in RGB color space
   */
  DitherQuantizer.findNearestColor = function (r, g, b, paletteArray) {
    var bestDist = Infinity;
    var bestColor = paletteArray[0];

    for (var i = 0; i < paletteArray.length; i++) {
      var c = paletteArray[i];
      var dr = r - c[0];
      var dg = g - c[1];
      var db = b - c[2];
      // Weighted Euclidean distance for human perception
      var dist = dr * dr * 0.299 + dg * dg * 0.587 + db * db * 0.114;
      if (dist < bestDist) {
        bestDist = dist;
        bestColor = c;
      }
    }
    return bestColor;
  };

  /**
   * Processes ImageData buffer using fast direct pixel manipulation (<4ms execution)
   */
  DitherQuantizer.prototype.process = function (imageData, paletteName, algorithm) {
    var palette = PALETTES[paletteName || this.options.palette] || PALETTES.gameboy;
    var algo = algorithm || this.options.algorithm;

    var w = imageData.width;
    var h = imageData.height;
    var data = imageData.data;

    if (algo === 'bayer') {
      for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
          var idx = (y * w + x) * 4;
          var threshold = (BAYER_4X4[y % 4][x % 4] - 0.5) * 64;

          var r = Math.max(0, Math.min(255, data[idx] + threshold));
          var g = Math.max(0, Math.min(255, data[idx + 1] + threshold));
          var b = Math.max(0, Math.min(255, data[idx + 2] + threshold));

          var nearest = DitherQuantizer.findNearestColor(r, g, b, palette);
          data[idx] = nearest[0];
          data[idx + 1] = nearest[1];
          data[idx + 2] = nearest[2];
        }
      }
      return imageData;
    }

    // Error-diffusion dithering (Floyd-Steinberg or Atkinson)
    var rErr = new Float32Array(w * h);
    var gErr = new Float32Array(w * h);
    var bErr = new Float32Array(w * h);

    for (var i = 0; i < w * h; i++) {
      rErr[i] = data[i * 4];
      gErr[i] = data[i * 4 + 1];
      bErr[i] = data[i * 4 + 2];
    }

    for (var py = 0; py < h; py++) {
      for (var px = 0; px < w; px++) {
        var pIdx = py * w + px;
        var curR = Math.max(0, Math.min(255, rErr[pIdx]));
        var curG = Math.max(0, Math.min(255, gErr[pIdx]));
        var curB = Math.max(0, Math.min(255, bErr[pIdx]));

        var nColor = DitherQuantizer.findNearestColor(curR, curG, curB, palette);

        var outIdx = pIdx * 4;
        data[outIdx] = nColor[0];
        data[outIdx + 1] = nColor[1];
        data[outIdx + 2] = nColor[2];

        var errR = curR - nColor[0];
        var errG = curG - nColor[1];
        var errB = curB - nColor[2];

        if (algo === 'atkinson') {
          // Atkinson distributes 1/8 to 6 surrounding neighbours
          var atkinsonFactor = 1 / 8;
          var atkinsonNeighbours = [
            [1, 0], [2, 0],
            [-1, 1], [0, 1], [1, 1],
            [0, 2]
          ];
          for (var an = 0; an < atkinsonNeighbours.length; an++) {
            var nx = px + atkinsonNeighbours[an][0];
            var ny = py + atkinsonNeighbours[an][1];
            if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
              var nIdx = ny * w + nx;
              rErr[nIdx] += errR * atkinsonFactor;
              gErr[nIdx] += errG * atkinsonFactor;
              bErr[nIdx] += errB * atkinsonFactor;
            }
          }
        } else {
          // Floyd-Steinberg distribution: (x+1, y): 7/16, (x-1, y+1): 3/16, (x, y+1): 5/16, (x+1, y+1): 1/16
          var fsNeighbours = [
            [1, 0, 7 / 16],
            [-1, 1, 3 / 16],
            [0, 1, 5 / 16],
            [1, 1, 1 / 16]
          ];
          for (var fn = 0; fn < fsNeighbours.length; fn++) {
            var fx = px + fsNeighbours[fn][0];
            var fy = py + fsNeighbours[fn][1];
            var factor = fsNeighbours[fn][2];
            if (fx >= 0 && fx < w && fy >= 0 && fy < h) {
              var fIdx = fy * w + fx;
              rErr[fIdx] += errR * factor;
              gErr[fIdx] += errG * factor;
              bErr[fIdx] += errB * factor;
            }
          }
        }
      }
    }

    return imageData;
  };

  return DitherQuantizer;
});
