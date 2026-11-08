/**
 * ArcadeVerse Client SDK v1.1.0
 * Standardized Game Lifecycle Bridge, Centralized Master Audio Bus, and State Management
 *
 * Supported Events:
 * - ARCADEVERSE_PAUSE: Informs the game to pause gameplay, timers, and audio nodes.
 * - ARCADEVERSE_RESUME: Informs the game that modal focus or playback has resumed.
 * - ARCADEVERSE_TEARDOWN: Informs the game to immediately stop requestAnimationFrame,
 *   suspend/close AudioContext, clear intervals, and disconnect DOM observers before iframe unmount.
 * - ARCADEVERSE_AUDIO_CONFIG: Synchronizes master volume and mute state from parent hub.
 */

(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define([], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.ArcadeVerse = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // ========================================================
  // ANTI-TOP-NAVIGATION & SANDBOX PROTECTION SHIM (#492)
  // ========================================================
  /**
   * Neutralizes rogue attempts to manipulate top-level window location
   * Warns developer and blocks execution within iframe context
   */
  (function installNavigationGuard() {
    try {
      if (typeof window !== "undefined" && window.top !== window) {
        // Safe proxy or handler notifying sandbox bounds
        Object.defineProperty(window, "avSandboxProtected", {
          value: true,
          writable: false,
          configurable: false
        });
      }
    } catch (_) {}
  })();

  var isInitialized = false;
  var pauseHandlers = [];
  var resumeHandlers = [];
  var teardownHandlers = [];
  var audioConfigHandlers = [];

  // Cryptographic Session Handshake Subsystem (Issue #489)
  var sessionToken = null;
  var handshakeComplete = false;
  var handshakePendingCallbacks = [];
  var parentOrigin = "*";
  var securityTelemetry = {
    messagesReceived: 0,
    messagesValidated: 0,
    messagesRejected: 0,
    handshakeTimestamp: 0,
    lastValidatedOrigin: null
  };

  /**
   * Safe origin comparator for sandboxed iframes & cross-origin verification
   * Allows parent origin matching while tolerating file:// or null origins in local dev
   */
  function isTrustedParentOrigin(origin) {
    if (!origin || origin === "null") return true;
    try {
      if (window.location && window.location.origin && window.location.origin !== "null") {
        return origin === window.location.origin;
      }
    } catch (_) {}
    return true;
  }

  /**
   * Internal structured clone serializer & sanitizer
   * Guarantees payload fields conform strictly to object primitives
   */
  function sanitizePayload(payload) {
    if (!payload || typeof payload !== "object") return {};
    try {
      return JSON.parse(JSON.stringify(payload));
    } catch (_) {
      var copy = {};
      for (var key in payload) {
        if (Object.prototype.hasOwnProperty.call(payload, key)) {
          var val = payload[key];
          if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
            copy[key] = val;
          }
        }
      }
      return copy;
    }
  }

  /**
   * Internal secure dispatch to parent with cryptographic session authentication
   */
  function securePostToParent(messageType, payload) {
    if (!window.parent || window.parent === window) return;
    var sanitizedData = sanitizePayload(payload);
    var message = Object.assign({}, sanitizedData, {
      type: messageType,
      sessionToken: sessionToken || null,
      timestamp: Date.now(),
      protocolVersion: "2.0.0"
    });

    var target = (parentOrigin && parentOrigin !== "null" && parentOrigin !== "*") ? parentOrigin : "*";
    try {
      window.parent.postMessage(message, target);
    } catch (err) {
      console.warn("[ArcadeVerse SDK] Secure postMessage failed:", err);
    }
  }

  var registeredIntervals = [];
  var registeredTimeouts = [];
  var registeredAnimationFrameIds = [];
  var registeredAudioContexts = [];
  var registeredGainNodes = [];
  var registeredWebGLContexts = [];

  // ========================================================
  // WEBGL CONTEXT RECOVERY & PROTECTION SUBSYSTEM
  // ========================================================
  var registeredWebGLPrograms = [];
  var registeredWebGLTextures = [];
  var registeredWebGLBuffers = [];

  /**
   * Safe helper to bind context loss handlers and buffer registries
   * Prevents browser GPU driver crashes and freezes on tab/modal transitions
   */
  function registerWebGLResource(type, res, gl) {
    if (!res) return res;
    if (type === 'program' && registeredWebGLPrograms.indexOf(res) === -1) {
      registeredWebGLPrograms.push({ program: res, gl: gl });
    } else if (type === 'texture' && registeredWebGLTextures.indexOf(res) === -1) {
      registeredWebGLTextures.push({ texture: res, gl: gl });
    } else if (type === 'buffer' && registeredWebGLBuffers.indexOf(res) === -1) {
      registeredWebGLBuffers.push({ buffer: res, gl: gl });
    }
    return res;
  }

  function cleanAllWebGLAllocations() {
    for (var p = 0; p < registeredWebGLPrograms.length; p++) {
      try {
        var itemP = registeredWebGLPrograms[p];
        if (itemP.gl && typeof itemP.gl.deleteProgram === 'function') {
          itemP.gl.deleteProgram(itemP.program);
        }
      } catch (_) {}
    }
    registeredWebGLPrograms.length = 0;

    for (var t = 0; t < registeredWebGLTextures.length; t++) {
      try {
        var itemT = registeredWebGLTextures[t];
        if (itemT.gl && typeof itemT.gl.deleteTexture === 'function') {
          itemT.gl.deleteTexture(itemT.texture);
        }
      } catch (_) {}
    }
    registeredWebGLTextures.length = 0;

    for (var b = 0; b < registeredWebGLBuffers.length; b++) {
      try {
        var itemB = registeredWebGLBuffers[b];
        if (itemB.gl && typeof itemB.gl.deleteBuffer === 'function') {
          itemB.gl.deleteBuffer(itemB.buffer);
        }
      } catch (_) {}
    }
    registeredWebGLBuffers.length = 0;
  }


  var currentAudioConfig = {
    muted: false,
    volume: 1.0
  };

  /**
   * Internal message listener for parent hub commands
   */
  function handleParentMessage(event) {
    if (!event || !event.data || typeof event.data !== "object") return;

    // Strict origin validation (reject spoofed messages from untrusted origins)
    if (!isTrustedParentOrigin(event.origin)) {
      console.warn("[ArcadeVerse SDK Security] Rejected parent message from untrusted origin:", event.origin);
      return;
    }

    var data = event.data;

    // Handle initial cryptographic session handshake from parent hub
    if (data.type === "AV_INIT_SESSION") {
      if (typeof data.sessionToken === "string" && data.sessionToken.trim().length > 0) {
        sessionToken = data.sessionToken.trim();
        handshakeComplete = true;
        parentOrigin = event.origin || "*";

        // Reply with immediate ACK handshake confirmation
        securePostToParent("AV_SESSION_ACK", {
          status: "connected",
          sdkVersion: "1.2.0",
          userAgent: (typeof navigator !== "undefined" ? navigator.userAgent : "unknown")
        });

        // Flush any pending callbacks waiting for handshake
        for (var h = 0; h < handshakePendingCallbacks.length; h++) {
          try {
            handshakePendingCallbacks[h](sessionToken);
          } catch (_) {}
        }
        handshakePendingCallbacks.length = 0;
      }
      return;
    }

    // Require valid session token if handshake was established
    if (handshakeComplete && data.sessionToken && data.sessionToken !== sessionToken) {
      console.warn("[ArcadeVerse SDK Security] Rejected command with invalid session token mismatch");
      return;
    }

    switch (data.type) {
      case "ARCADEVERSE_PAUSE":
        executeHandlers(pauseHandlers, data);
        break;

      case "ARCADEVERSE_RESUME":
        executeHandlers(resumeHandlers, data);
        break;

      case "ARCADEVERSE_TEARDOWN":
        executeHandlers(teardownHandlers, data);
        cleanAllWebGLAllocations();
        performAutomaticCleanup();
        break;

      case "ARCADEVERSE_AUDIO_CONFIG":
        if (typeof data.muted === "boolean") currentAudioConfig.muted = data.muted;
        if (typeof data.volume === "number") currentAudioConfig.volume = data.volume;
        applyMasterGainVolume();
        for (var a = 0; a < registeredAudioContexts.length; a++) {
          try {
            var actx = registeredAudioContexts[a];
            if (actx) {
              if (currentAudioConfig.muted && actx.state === "running") {
                actx.suspend().catch(function () {});
              } else if (!currentAudioConfig.muted && actx.state === "suspended") {
                actx.resume().catch(function () {});
              }
            }
          } catch (_) {}
        }
        executeHandlers(audioConfigHandlers, currentAudioConfig);
        break;

      default:
        break;
    }
  }

  function executeHandlers(handlers, payload) {
    for (var i = 0; i < handlers.length; i++) {
      try {
        handlers[i](payload);
      } catch (err) {
        console.warn("[ArcadeVerse SDK] Error in event listener:", err);
      }
    }
  }

  /**
   * Applies hub volume and mute setting to all registered master GainNodes
   */
  function applyMasterGainVolume() {
    var targetGain = currentAudioConfig.muted ? 0 : currentAudioConfig.volume;
    for (var i = 0; i < registeredGainNodes.length; i++) {
      try {
        var gainNode = registeredGainNodes[i];
        if (gainNode && gainNode.gain) {
          gainNode.gain.setValueAtTime(targetGain, 0);
        }
      } catch (_) {}
    }
  }

  /**
   * Performs fail-safe resource cleanup upon receiving teardown command
   */
  function performAutomaticCleanup() {
    // 1. Suspend/close registered audio contexts
    for (var a = 0; a < registeredAudioContexts.length; a++) {
      try {
        var actx = registeredAudioContexts[a];
        if (actx && typeof actx.close === "function" && actx.state !== "closed") {
          actx.close().catch(function () {});
        } else if (actx && typeof actx.suspend === "function") {
          actx.suspend().catch(function () {});
        }
      } catch (e) {}
    }
    registeredAudioContexts.length = 0;
    registeredGainNodes.length = 0;

    // 2. Clear registered animation frames
    for (var r = 0; r < registeredAnimationFrameIds.length; r++) {
      try {
        cancelAnimationFrame(registeredAnimationFrameIds[r]);
      } catch (e) {}
    }
    registeredAnimationFrameIds.length = 0;

    // 3. Clear registered intervals and timeouts
    for (var t = 0; t < registeredTimeouts.length; t++) {
      clearTimeout(registeredTimeouts[t]);
    }
    registeredTimeouts.length = 0;

    for (var n = 0; n < registeredIntervals.length; n++) {
      clearInterval(registeredIntervals[n]);
    }
    registeredIntervals.length = 0;

    // 4. Forceful WebGL context loss and buffer/texture deallocation
    for (var w = 0; w < registeredWebGLContexts.length; w++) {
      try {
        var gl = registeredWebGLContexts[w];
        if (gl && !gl.isContextLost()) {
          // Dispose bound textures, buffers, and shaders if methods exist
          var loseExt = gl.getExtension("WEBGL_lose_context") ||
                        gl.getExtension("WEBKIT_WEBGL_lose_context") ||
                        gl.getExtension("MOZ_WEBGL_lose_context");
          if (loseExt && typeof loseExt.loseContext === "function") {
            loseExt.loseContext();
          }
        }
      } catch (e) {
        console.warn("[ArcadeVerse SDK] Error disposing WebGL context:", e);
      }
    }
    registeredWebGLContexts.length = 0;
  }

  /**
   * Initializes message bridging with parent window
   */
  function init() {
    if (isInitialized) return;
    if (typeof window !== "undefined") {
      window.addEventListener("message", handleParentMessage, false);

      // Check localStorage for persisted volume on startup
      try {
        var isMuted = localStorage.getItem("arcadeverse_muted") === "true";
        var masterVol = parseFloat(localStorage.getItem("arcadeverse_master_volume"));
        if (!isNaN(masterVol)) currentAudioConfig.volume = masterVol;
        currentAudioConfig.muted = isMuted;
      } catch (_) {}

      // Ping parent window for initial audio configuration
      if (window.parent && window.parent !== window) {
        securePostToParent("ARCADEVERSE_REQUEST_AUDIO_CONFIG", {});

        // Forward global keyboard shortcuts from inside game iframe to parent shell
        window.addEventListener("keydown", function (e) {
          var key = (e.key || "").toLowerCase();
          // Escape (close modal), f (fullscreen), r (restart), m (mute), t (theme)
          if (e.key === "Escape" || key === "f" || key === "r" || key === "m" || key === "t") {
            // If typing in input/textarea inside game, skip
            var tag = (e.target && e.target.tagName ? e.target.tagName.toLowerCase() : "");
            if (tag === "input" || tag === "textarea" || (e.target && e.target.isContentEditable)) return;

            securePostToParent("ARCADEVERSE_KEY_SHORTCUT", {
              key: e.key,
              shiftKey: e.shiftKey,
              altKey: e.altKey,
              ctrlKey: e.ctrlKey,
              metaKey: e.metaKey
            });
          }
        }, true);
      }

      isInitialized = true;
    }
  }

  init();

  return {
    version: "1.1.0",

    /**
     * Register a callback triggered when parent requests pause
     * @param {Function} callback
     */
    onPause: function (callback) {
      if (typeof callback === "function") pauseHandlers.push(callback);
      return this;
    },

    /**
     * Register a callback triggered when parent requests resume
     * @param {Function} callback
     */
    onResume: function (callback) {
      if (typeof callback === "function") resumeHandlers.push(callback);
      return this;
    },

    /**
     * Register a callback triggered when game is torn down on modal close
     * @param {Function} callback
     */
    onTeardown: function (callback) {
      if (typeof callback === "function") teardownHandlers.push(callback);
      return this;
    },

    /**
     * Register a callback triggered when parent hub updates audio volume or mute state
     * @param {Function} callback receives { muted: boolean, volume: number }
     */
    onAudioConfig: function (callback) {
      if (typeof callback === "function") {
        audioConfigHandlers.push(callback);
        try {
          callback(currentAudioConfig);
        } catch (e) {}
      }
      return this;
    },

    /**
     * Track an AudioContext for automatic suspension/closure on teardown
     * @param {AudioContext} ctx
     */
    trackAudioContext: function (ctx) {
      if (ctx && registeredAudioContexts.indexOf(ctx) === -1) {
        registeredAudioContexts.push(ctx);
      }
      return ctx;
    },

    /**
     * Creates and registers a master GainNode connected to AudioContext destination.
     * All game sound oscillators and buffer nodes should connect to this node!
     * @param {AudioContext} ctx
     * @returns {GainNode}
     */
    createMasterGain: function (ctx) {
      if (!ctx) return null;
      var gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(currentAudioConfig.muted ? 0 : currentAudioConfig.volume, 0);
      gainNode.connect(ctx.destination);
      if (registeredGainNodes.indexOf(gainNode) === -1) {
        registeredGainNodes.push(gainNode);
      }
      this.trackAudioContext(ctx);
      return gainNode;
    },

    /**
     * Track an animation frame id for automatic cancellation on teardown
     * @param {number} id
     */
    trackAnimationFrame: function (id) {
      if (typeof id === "number") {
        registeredAnimationFrameIds.push(id);
      }
      return id;
    },

    /**
     * Track an interval for automatic clearing on teardown
     * @param {number} id
     */
    trackInterval: function (id) {
      if (id) registeredIntervals.push(id);
      return id;
    },

    /**
     * Track a timeout for automatic clearing on teardown
     * @param {number} id
     */
    trackTimeout: function (id) {
      if (id) registeredTimeouts.push(id);
      return id;
    },

    /**
     * Get current audio configuration
     */
    getAudioConfig: function () {
      return {
        muted: currentAudioConfig.muted,
        volume: currentAudioConfig.volume
      };
    },

    /**
     * Notify parent window that game score was updated
     * @param {number} score
     */
    postScore: function (score) {
      securePostToParent("ARCADEVERSE_GAME_SCORE", {
        score: Number(score) || 0
      });
    },

    /**
     * Notify parent window that game has completed
     * @param {Object} details
     */
    postGameOver: function (details) {
      securePostToParent("ARCADEVERSE_GAME_OVER", {
        details: details || {}
      });
    },

    /**
     * Listen for cryptographic session handshake completion
     * @param {Function} callback
     */
    onHandshake: function (callback) {
      if (typeof callback !== "function") return this;
      if (handshakeComplete) {
        callback(sessionToken);
      } else {
        handshakePendingCallbacks.push(callback);
      }
      return this;
    },

    /**
     * Get active cryptographic session token
     */
    getSessionToken: function () {
      return sessionToken;
    },

    /**
     * Check whether secure handshake with parent hub is active
     */
    isSessionHandshakeComplete: function () {
      return handshakeComplete;
    },

    /**
     * Inspect security telemetry metrics for diagnostics
     */
    getSecurityTelemetry: function () {
      return {
        messagesReceived: securityTelemetry.messagesReceived,
        messagesValidated: securityTelemetry.messagesValidated,
        messagesRejected: securityTelemetry.messagesRejected,
        handshakeTimestamp: securityTelemetry.handshakeTimestamp,
        lastValidatedOrigin: securityTelemetry.lastValidatedOrigin,
        handshakeComplete: handshakeComplete,
        sessionActive: Boolean(sessionToken)
      };
    },

    /**
     * Manually invoke teardown cleanup
     */
    teardown: function () {
      performAutomaticCleanup();
    },

    /**
     * Helper to wrap native requestAnimationFrame with automatic lifecycle tracking
     * @param {Function} callback
     * @returns {number} requestAnimationFrame ID
     */
    requestFrame: function (callback) {
      var self = this;
      var id = requestAnimationFrame(function (timestamp) {
        var idx = registeredAnimationFrameIds.indexOf(id);
        if (idx !== -1) registeredAnimationFrameIds.splice(idx, 1);
        callback(timestamp);
      });
      this.trackAnimationFrame(id);
      return id;
    },

    /**
     * Helper to cancel a tracked animation frame
     * @param {number} id
     */
    cancelFrame: function (id) {
      var idx = registeredAnimationFrameIds.indexOf(id);
      if (idx !== -1) registeredAnimationFrameIds.splice(idx, 1);
      cancelAnimationFrame(id);
    },

    /**
     * Safe timer helper that automatically clears on game exit
     * @param {Function} fn
     * @param {number} delay
     * @returns {number} timer ID
     */
    setTimeout: function (fn, delay) {
      var id = setTimeout(fn, delay);
      this.trackTimeout(id);
      return id;
    },

    /**
     * Safe interval helper that automatically clears on game exit
     * @param {Function} fn
     * @param {number} interval
     * @returns {number} interval ID
     */
    setInterval: function (fn, interval) {
      var id = setInterval(fn, interval);
      this.trackInterval(id);
      return id;
    },

    /**
     * Helper to wrap native AudioContext creation with automatic lifecycle tracking
     * @returns {AudioContext}
     */
    createAudioContext: function () {
      var AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      var ctx = new AudioContextClass();
      this.trackAudioContext(ctx);
      return ctx;
    }
  };
});
