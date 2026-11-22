/**
 * High-Resolution Retro Arcade Trading Card & Polaroid Trophy Compositor
 * Pure HTML5 Canvas 2D & Web Share API Graphics Compositor
 * Composites gameplay snapshots onto collectible retro trading cards / Polaroid frames
 * with metallic holographic border foils, dynamic trophy typography, dynamic QR codes,
 * and 1-click PNG download & navigator.share() integration.
 *
 * @module ScreenshotCardCompositor
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
    root.ArcadeVerse.ScreenshotCardCompositor = factory();
    root.ScreenshotCardCompositor = root.ArcadeVerse.ScreenshotCardCompositor;
  }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  function ScreenshotCardCompositor(options) {
    this.options = Object.assign({
      cardWidth: 1200,
      cardHeight: 1600,
      cardTheme: 'holographic', // 'holographic', 'cyber_neon', 'classic_polaroid'
      playerHandle: 'Player1',
      gameTitle: 'Arcade Game',
      score: 0,
      dateString: new Date().toLocaleDateString()
    }, options);

    this.cardWidth = this.options.cardWidth;
    this.cardHeight = this.options.cardHeight;
  }

  /**
   * Procedural holographic foil gradient & border renderer
   */
  ScreenshotCardCompositor.prototype.drawHolographicBorder = function (ctx, w, h) {
    ctx.save();
    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0.0, '#ff007f');
    grad.addColorStop(0.2, '#7928ca');
    grad.addColorStop(0.4, '#0070f3');
    grad.addColorStop(0.6, '#00dfd8');
    grad.addColorStop(0.8, '#7928ca');
    grad.addColorStop(1.0, '#ff007f');

    ctx.strokeStyle = grad;
    ctx.lineWidth = 24;
    ctx.strokeRect(12, 12, w - 24, h - 24);

    // Inner bevel
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(32, 32, w - 64, h - 64);
    ctx.restore();
  };

  /**
   * Draws dynamic retro pixel-art QR code placeholder
   */
  ScreenshotCardCompositor.prototype.drawQrPattern = function (ctx, x, y, size) {
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = '#0f172a';

    var cells = 15;
    var cellSize = size / cells;

    // Outer corner finder patterns
    var drawFinder = function (fx, fy) {
      ctx.fillRect(fx, fy, cellSize * 5, cellSize * 5);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(fx + cellSize, fy + cellSize, cellSize * 3, cellSize * 3);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(fx + cellSize * 2, fy + cellSize * 2, cellSize, cellSize);
    };

    drawFinder(x, y);
    drawFinder(x + size - cellSize * 5, y);
    drawFinder(x, y + size - cellSize * 5);

    // Procedural pseudo-data bits
    for (var r = 0; r < cells; r++) {
      for (var c = 0; c < cells; c++) {
        if ((r < 5 && (c < 5 || c >= cells - 5)) || (r >= cells - 5 && c < 5)) continue;
        if ((r * 7 + c * 13) % 3 === 0) {
          ctx.fillRect(x + c * cellSize, y + r * cellSize, cellSize, cellSize);
        }
      }
    }
    ctx.restore();
  };

  /**
   * Composites snapshot image, typography, holographic border, and trophy badge
   */
  ScreenshotCardCompositor.prototype.compositeCard = function (sourceCanvasOrImage, metadata) {
    metadata = Object.assign({}, this.options, metadata);
    var canvas = null;

    if (typeof document !== 'undefined' && document.createElement) {
      canvas = document.createElement('canvas');
    } else {
      canvas = {
        width: this.cardWidth,
        height: this.cardHeight,
        getContext: function () {
          return {
            save: function () {},
            restore: function () {},
            fillRect: function () {},
            strokeRect: function () {},
            drawImage: function () {},
            fillText: function () {},
            createLinearGradient: function () {
              return { addColorStop: function () {} };
            }
          };
        },
        toDataURL: function () { return 'data:image/png;base64,mock'; }
      };
    }

    canvas.width = this.cardWidth;
    canvas.height = this.cardHeight;
    var ctx = canvas.getContext('2d');
    var w = this.cardWidth;
    var h = this.cardHeight;

    // 1. Dark sleek base background
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, w, h);

    // 2. Holographic foil frame
    this.drawHolographicBorder(ctx, w, h);

    // 3. Gameplay snapshot window
    var snapshotX = 64;
    var snapshotY = 120;
    var snapshotW = w - 128;
    var snapshotH = 880;

    ctx.fillStyle = '#020408';
    ctx.fillRect(snapshotX, snapshotY, snapshotW, snapshotH);

    if (sourceCanvasOrImage && ctx.drawImage) {
      try {
        ctx.drawImage(sourceCanvasOrImage, snapshotX, snapshotY, snapshotW, snapshotH);
      } catch (e) {
        // Safe fallback for CORS/tainted canvases
      }
    }

    // 4. Header Badge & Typography
    ctx.fillStyle = '#00dfd8';
    ctx.font = 'bold 36px monospace';
    ctx.fillText('ARCADEVERSE COLLECTIBLE TROPHY', 64, 80);

    // 5. Game and Score Stats Plaque
    var statsY = 1080;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 64px sans-serif';
    ctx.fillText(metadata.gameTitle.toUpperCase(), 64, statsY);

    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 84px monospace';
    ctx.fillText('SCORE: ' + metadata.score.toLocaleString(), 64, statsY + 110);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '36px sans-serif';
    ctx.fillText('PLAYER: @' + metadata.playerHandle, 64, statsY + 180);
    ctx.fillText('DATE: ' + metadata.dateString, 64, statsY + 235);

    // 6. Dynamic QR Code
    this.drawQrPattern(ctx, w - 240, statsY - 30, 160);

    return canvas;
  };

  /**
   * 1-Click Instant PNG Download trigger
   */
  ScreenshotCardCompositor.prototype.downloadCard = function (canvas, filename) {
    if (typeof document === 'undefined' || !canvas || !canvas.toDataURL) return;
    var link = document.createElement('a');
    link.download = filename || ('arcade-trophy-' + Date.now() + '.png');
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  /**
   * Web Share API integration on supported devices
   */
  ScreenshotCardCompositor.prototype.shareCard = function (canvas, title) {
    if (typeof navigator === 'undefined' || !navigator.share || !canvas || !canvas.toBlob) {
      this.downloadCard(canvas);
      return Promise.resolve(false);
    }

    return new Promise(function (resolve) {
      canvas.toBlob(function (blob) {
        if (!blob) {
          resolve(false);
          return;
        }
        var file = new File([blob], 'arcade-trophy.png', { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          navigator.share({
            title: title || 'ArcadeVerse Trophy Card',
            text: 'Check out my high-score trophy card on ArcadeVerse!',
            files: [file]
          }).then(function () { resolve(true); }).catch(function () { resolve(false); });
        } else {
          resolve(false);
        }
      });
    });
  };

  return ScreenshotCardCompositor;
});
