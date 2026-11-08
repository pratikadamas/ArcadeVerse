/**
 * ArcadeVerse WebGL Lifecycle & Hardware Memory Management Engine
 * Dedicated module for client-side WebGL context monitoring, texture recycling,
 * context loss simulation, and multi-game GPU memory preservation.
 */

(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define([], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.ArcadeVerseWebGL = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var activeContexts = new Set();
  var telemetryStats = {
    contextsAllocated: 0,
    contextsDisposed: 0,
    texturesFreed: 0,
    buffersFreed: 0,
    simulatedLosses: 0
  };

  /**
   * Monitor an active WebGL/WebGL2 context
   * @param {WebGLRenderingContext|WebGL2RenderingContext} gl
   * @param {Object} [meta]
   */
  function monitorContext(gl, meta) {
    if (!gl) return;
    activeContexts.add({ gl: gl, meta: meta || {}, timestamp: Date.now() });
    telemetryStats.contextsAllocated++;

    if (gl.canvas) {
      gl.canvas.addEventListener("webglcontextlost", function (event) {
        event.preventDefault();
        console.warn("[ArcadeVerse WebGL] Context lost handled on canvas:", gl.canvas);
      }, false);
    }
  }

  /**
   * Forcibly release all GPU resources associated with a WebGL context
   * @param {WebGLRenderingContext|WebGL2RenderingContext} gl
   */
  function disposeContext(gl) {
    if (!gl) return false;

    try {
      if (typeof gl.isContextLost === "function" && gl.isContextLost()) {
        return true;
      }

      // 1. Unbind active framebuffers and textures
      try {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.bindRenderbuffer(gl.RENDERBUFFER, null);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
      } catch (_) {}

      // 2. Query lose context extension
      var loseExt = gl.getExtension("WEBGL_lose_context") ||
                    gl.getExtension("WEBKIT_WEBGL_lose_context") ||
                    gl.getExtension("MOZ_WEBGL_lose_context");

      if (loseExt && typeof loseExt.loseContext === "function") {
        loseExt.loseContext();
        telemetryStats.contextsDisposed++;
        return true;
      }
    } catch (err) {
      console.warn("[ArcadeVerse WebGL] Failed to cleanly dispose context:", err);
    }
    return false;
  }

  /**
   * Traverse a DOM root (e.g. an iframe's document) and dispose all WebGL canvases
   * @param {Document|Element} root
   */
  function disposeAllCanvases(root) {
    if (!root) return 0;
    var count = 0;
    try {
      var canvases = root.querySelectorAll ? root.querySelectorAll("canvas") : [];
      for (var i = 0; i < canvases.length; i++) {
        var c = canvases[i];
        var gl = null;
        try {
          gl = c.getContext("webgl2") || c.getContext("webgl") || c.getContext("experimental-webgl");
        } catch (_) {}

        if (gl) {
          if (disposeContext(gl)) {
            count++;
          }
        }
      }
    } catch (err) {
      console.warn("[ArcadeVerse WebGL] Error in disposeAllCanvases:", err);
    }
    return count;
  }

  /**
   * Diagnostic test to verify if a browser's GPU supports graceful WebGL context recovery
   * @param {Function} callback
   */
  function testContextRecoverySupport(callback) {
    var canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 16;
    var gl = canvas.getContext("webgl");
    if (!gl) {
      if (typeof callback === "function") callback(false, "WebGL not supported");
      return;
    }

    var loseExt = gl.getExtension("WEBGL_lose_context");
    if (!loseExt) {
      if (typeof callback === "function") callback(false, "WEBGL_lose_context missing");
      return;
    }

    var lostFired = false;
    var restoredFired = false;

    canvas.addEventListener("webglcontextlost", function (e) {
      e.preventDefault();
      lostFired = true;
      setTimeout(function () {
        loseExt.restoreContext();
      }, 50);
    }, false);

    canvas.addEventListener("webglcontextrestored", function () {
      restoredFired = true;
      if (typeof callback === "function") callback(true, "Recovery verified");
    }, false);

    loseExt.loseContext();
  }

  return {
    monitorContext: monitorContext,
    disposeContext: disposeContext,
    disposeAllCanvases: disposeAllCanvases,
    testContextRecoverySupport: testContextRecoverySupport,
    /**
     * Canvas Garbage Collection & Detached DOM Node Cleanup (#498)
     * Forcibly zeroes canvas width/height to release back-buffer pixel memory in the browser engine
     * and clears 2D context states to prevent detached DOM memory leaks.
     * @param {HTMLCanvasElement} canvas
     */
    zeroCanvasDimensions: function (canvas) {
      if (!canvas) return;
      try {
        var ctx2d = canvas.getContext('2d');
        if (ctx2d) {
          ctx2d.clearRect(0, 0, canvas.width, canvas.height);
          if (typeof ctx2d.reset === 'function') {
            ctx2d.reset();
          }
        }
      } catch (_) {}
      try {
        canvas.width = 0;
        canvas.height = 0;
      } catch (_) {}
    },

    /**
     * Deep canvas and detached DOM unmount sweep
     * Finds all canvas elements within a container or document and cleans them thoroughly
     * @param {Document|Element} container
     * @returns {number} count of wiped canvases
     */
    purgeDetachedCanvases: function (container) {
      if (!container) return 0;
      var canvases = container.querySelectorAll ? container.querySelectorAll('canvas') : [];
      var count = 0;
      for (var i = 0; i < canvases.length; i++) {
        var c = canvases[i];
        try {
          var gl = c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl');
          if (gl) {
            disposeContext(gl);
          }
          this.zeroCanvasDimensions(c);
          if (c.parentNode) {
            c.parentNode.removeChild(c);
          }
          count++;
        } catch (_) {}
      }
      return count;
    },

    /**
     * Run full garbage collection diagnostics
     * @returns {Object} detailed GC telemetry
     */
    /**
     * Diagnostic report of current context allocations
     * @returns {Array<Object>}
     */
    /**
     * Measure estimated byte footprint of all monitored canvases
     * @returns {number} bytes
     */
    estimateVRAMUsageBytes: function () {
      var total = 0;
      activeContexts.forEach(function (item) {
        if (item.gl && item.gl.canvas) {
          total += (item.gl.canvas.width * item.gl.canvas.height * 4);
        }
      });
      return total;
    },

    /**
     * Safely reset all pixel buffers on a given 2D context
     * @param {CanvasRenderingContext2D} ctx
     */
    flush2DContext: function (ctx) {
      if (!ctx || !ctx.canvas) return;
      try {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        if (typeof ctx.reset === 'function') ctx.reset();
      } catch (_) {}
    },

    dumpActiveContexts: function () {
      var arr = [];
      activeContexts.forEach(function (item) {
        arr.push({
          canvasWidth: item.gl && item.gl.canvas ? item.gl.canvas.width : 0,
          canvasHeight: item.gl && item.gl.canvas ? item.gl.canvas.height : 0,
          isLost: item.gl ? item.gl.isContextLost() : true,
          ageMs: Date.now() - item.timestamp
        });
      });
      return arr;
    },

    /**
     * Memory pressure relief trigger
     * Can be invoked by low-memory devices to clear unused canvas textures
     */
    releaseUnderMemoryPressure: function () {
      var released = 0;
      activeContexts.forEach(function (item) {
        if (item.gl && !item.gl.isContextLost()) {
          disposeContext(item.gl);
          released++;
        }
      });
      return released;
    },

    getGCDiagnostics: function () {
      return {
        disposedCanvases: telemetryStats.contextsDisposed,
        freedTextures: telemetryStats.texturesFreed,
        freedBuffers: telemetryStats.buffersFreed,
        activeContextCount: activeContexts.size,
        hardwareAccelerated: typeof window !== 'undefined' && 'WebGLRenderingContext' in window
      };
    },

    getStats: function () {
      return Object.assign({}, telemetryStats, {
        activeCount: activeContexts.size
      });
    }
  };
});

  /**
   * Diagnostic WebGL Context Stress Testing Simulator
   * Can be invoked from DevTools to stress-test consecutive allocations and releases
   * @param {number} [iterations=10]
   * @returns {Promise<{success: boolean, iterations: number, freedBytesEstimate: number}>}
   */
  function runStressBenchmark(iterations) {
    var count = iterations || 10;
    return new Promise(function (resolve) {
      var passed = 0;
      for (var i = 0; i < count; i++) {
        var c = document.createElement("canvas");
        c.width = 128;
        c.height = 128;
        var gl = c.getContext("webgl");
        if (gl) {
          // Allocate test dummy texture
          var tex = gl.createTexture();
          gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 64, 64, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
          
          // Allocate test buffer
          var buf = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, buf);
          gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 1, 2, 3]), gl.STATIC_DRAW);

          // Force disposal
          if (disposeContext(gl)) {
            passed++;
          }
        }
      }
      resolve({
        success: passed === count,
        iterations: passed,
        freedBytesEstimate: passed * 64 * 64 * 4
      });
    });
  }

  // Export additional diagnostics
  if (typeof root !== "undefined" && root.ArcadeVerseWebGL) {
    root.ArcadeVerseWebGL.runStressBenchmark = runStressBenchmark;
  }
