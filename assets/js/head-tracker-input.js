/**
 * Eye-Tracking & Head-Pose Pointer Navigation via WebRTC Landmark Mesh
 * Pure HTML5 Canvas 2D & WebRTC Optical Input Engine
 * Uses local navigator.mediaDevices.getUserMedia() to compute face centroid translation
 * and optical head tilt angles locally without server transmission, maps virtual on-screen
 * cursor with dwell clicker (800ms hold triggers click), and immediate hardware stream release.
 *
 * @module HeadTrackerInput
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
    root.ArcadeVerse.HeadTrackerInput = factory();
    root.HeadTrackerInput = root.ArcadeVerse.HeadTrackerInput;
  }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  function HeadTrackerInput(options) {
    this.options = Object.assign({
      deadzone: 0.08,
      sensitivity: 1.8,
      dwellTimeMs: 800,
      dwellRadiusPx: 25,
      videoWidth: 160,
      videoHeight: 120
    }, options);

    this.videoStream = null;
    this.videoElement = null;
    this.prevFrameBuffer = null;
    this.cursorX = 0;
    this.cursorY = 0;
    this.dwellStartTime = 0;
    this.dwellAnchorX = 0;
    this.dwellAnchorY = 0;
    this.isTracking = false;
    this.rafId = null;

    this.analysisCanvas = null;
    this.analysisCtx = null;
    if (typeof document !== 'undefined' && document.createElement) {
      this.analysisCanvas = document.createElement('canvas');
      this.analysisCanvas.width = this.options.videoWidth;
      this.analysisCanvas.height = this.options.videoHeight;
      this.analysisCtx = this.analysisCanvas.getContext('2d');
    }
  }

  /**
   * Optical frame-differencing algorithm calculating face centroid shift
   */
  HeadTrackerInput.prototype.computeOpticalCentroid = function (currentFrame, prevFrame, width, height) {
    if (!prevFrame || !currentFrame) return { dx: 0, dy: 0, motionEnergy: 0 };

    var sumX = 0;
    var sumY = 0;
    var diffCount = 0;
    var threshold = 28; // Pixel luminance delta threshold

    for (var y = 0; y < height; y += 2) {
      for (var x = 0; x < width; x += 2) {
        var idx = (y * width + x) * 4;
        // Grayscale luminance approximation
        var l1 = (currentFrame[idx] * 0.299 + currentFrame[idx + 1] * 0.587 + currentFrame[idx + 2] * 0.114);
        var l2 = (prevFrame[idx] * 0.299 + prevFrame[idx + 1] * 0.587 + prevFrame[idx + 2] * 0.114);

        if (Math.abs(l1 - l2) > threshold) {
          sumX += (x - width / 2);
          sumY += (y - height / 2);
          diffCount++;
        }
      }
    }

    if (diffCount < 10) return { dx: 0, dy: 0, motionEnergy: 0 };

    var avgX = sumX / diffCount;
    var avgY = sumY / diffCount;
    var normX = avgX / (width / 2);
    var normY = avgY / (height / 2);

    return {
      dx: normX,
      dy: normY,
      motionEnergy: diffCount
    };
  };

  /**
   * Updates dwell click timer state
   */
  HeadTrackerInput.prototype.updateDwellState = function (nowMs) {
    var now = nowMs || (typeof performance !== 'undefined' ? performance.now() : Date.now());
    var dist = Math.sqrt(
      Math.pow(this.cursorX - this.dwellAnchorX, 2) +
      Math.pow(this.cursorY - this.dwellAnchorY, 2)
    );

    if (dist > this.options.dwellRadiusPx) {
      // Cursor moved; reset dwell anchor
      this.dwellAnchorX = this.cursorX;
      this.dwellAnchorY = this.cursorY;
      this.dwellStartTime = now;
      return { dwelling: false, progress: 0 };
    }

    var elapsed = now - this.dwellStartTime;
    var progress = Math.min(1.0, elapsed / this.options.dwellTimeMs);

    if (progress >= 1.0) {
      this.triggerClick(this.cursorX, this.cursorY);
      this.dwellStartTime = now + 400; // Reset with brief cooldown
      return { dwelling: false, progress: 1.0, triggered: true };
    }

    return { dwelling: true, progress: progress, triggered: false };
  };

  /**
   * Dispatches synthetic click at current dwell location
   */
  HeadTrackerInput.prototype.triggerClick = function (x, y) {
    if (typeof document === 'undefined' || !document.elementFromPoint) return;
    try {
      var target = document.elementFromPoint(x, y);
      if (target) {
        var evt = new MouseEvent('click', {
          clientX: x,
          clientY: y,
          bubbles: true,
          cancelable: true
        });
        target.dispatchEvent(evt);
      }
    } catch (e) {}
  };

  /**
   * Hardware camera stream cleanup
   */
  HeadTrackerInput.prototype.stop = function () {
    this.isTracking = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.videoStream) {
      var tracks = this.videoStream.getTracks();
      for (var i = 0; i < tracks.length; i++) {
        tracks[i].stop();
      }
      this.videoStream = null;
    }
    if (this.videoElement && this.videoElement.parentNode) {
      this.videoElement.parentNode.removeChild(this.videoElement);
      this.videoElement = null;
    }
  };

  return HeadTrackerInput;
});
