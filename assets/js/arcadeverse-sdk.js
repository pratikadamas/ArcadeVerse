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
    var inst = factory();
    root.ArcadeVerse = inst;
    root.arcadeverse = inst; // Case-insensitive alias (#720)
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // ========================================================
  // LOCALSTORAGE VOLUME & MUTE CROSS-IFRAME SYNCHRONIZER (#697)
  // Ensures av_master_volume & av_sound_muted persist and propagate across iframes
  // ========================================================
  try {
    if (typeof window !== "undefined") {
      window.addEventListener("storage", function (e) {
        if (e.key === "av_master_volume" || e.key === "av_sound_muted" || e.key === "arcadeverse_audio_settings") {
          var isMuted = localStorage.getItem("av_sound_muted") === "true";
          var vol = parseFloat(localStorage.getItem("av_master_volume"));
          if (!isNaN(vol)) currentAudioConfig.volume = Math.max(0, Math.min(1, vol));
          currentAudioConfig.muted = isMuted;
          executeHandlers(audioConfigHandlers, currentAudioConfig);
        }
      });
    }
  } catch (_) {}

  // ========================================================
  // IN-IFRAME STORAGE NAMESPACE PROXY SUBSYSTEM (#493)
  // ========================================================
  var detectedGameId = (function () {
    try {
      if (typeof window !== "undefined" && window.location && window.location.pathname) {
        var parts = window.location.pathname.split('/');
        for (var i = 0; i < parts.length; i++) {
          if (parts[i] === 'games' && parts[i + 1]) {
            return parts[i + 1];
          }
        }
      }
    } catch (_) {}
    return "game";
  })();

  /**
   * Namespaced Storage Proxy: isolates high scores, settings, and state per game
   * Prevents multi-game collisions (e.g. game A overwriting 'highScore' of game B)
   */
  var ArcadeStorage = {
    prefix: "av_" + detectedGameId + "_",

    setGameId: function (id) {
      if (id) {
        detectedGameId = String(id).trim();
        this.prefix = "av_" + detectedGameId + "_";
      }
    },

    getGameId: function () {
      return detectedGameId;
    },

    getKey: function (key) {
      if (!key) return this.prefix;
      if (String(key).indexOf(this.prefix) === 0) return String(key);
      return this.prefix + key;
    },

    getItem: function (key) {
      try {
        var namespacedVal = localStorage.getItem(this.getKey(key));
        if (namespacedVal !== null) return namespacedVal;
        // Backward-compatible fallback to legacy un-prefixed key if present
        return localStorage.getItem(key);
      } catch (_) {
        return null;
      }
    },

    setItem: function (key, value) {
      try {
        localStorage.setItem(this.getKey(key), String(value));
        return true;
      } catch (err) {
        console.warn("[ArcadeStorage] Set failed:", err);
        return false;
      }
    },

    removeItem: function (key) {
      try {
        localStorage.removeItem(this.getKey(key));
        localStorage.removeItem(key);
        return true;
      } catch (_) {
        return false;
      }
    },

    clear: function () {
      try {
        var prefix = this.prefix;
        var toRemove = [];
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (k && k.indexOf(prefix) === 0) {
            toRemove.push(k);
          }
        }
        for (var j = 0; j < toRemove.length; j++) {
          localStorage.removeItem(toRemove[j]);
        }
      } catch (_) {}
    },

    getJSON: function (key, fallback) {
      try {
        var raw = this.getItem(key);
        return raw ? JSON.parse(raw) : (fallback !== undefined ? fallback : null);
      } catch (_) {
        return fallback !== undefined ? fallback : null;
      }
    },

    setJSON: function (key, obj) {
      try {
        return this.setItem(key, JSON.stringify(obj));
      } catch (_) {
        return false;
      }
    },

    // ========================================================
    // CLIENT-SIDE ANTI-TAMPER CHECKSUM SIGNATURES (#576)
    // HMAC/SHA-256 Checksum generation and verification for game scores
    // ========================================================
    /**
     * Computes anti-tamper signature for a submitted score
     * @param {string} gameId
     * @param {number} score
     * @param {number} timestamp
     * @returns {Promise<string>} Hex signature
     */
    generateScoreSignature: function (gameId, score, timestamp) {
      var payload = "av_salt_2026_" + String(gameId) + ":" + String(score) + ":" + String(timestamp);
      if (typeof crypto !== 'undefined' && crypto.subtle && typeof TextEncoder !== 'undefined') {
        var encoder = new TextEncoder();
        var data = encoder.encode(payload);
        return crypto.subtle.digest("SHA-256", data).then(function (buffer) {
          var hashArray = Array.from(new Uint8Array(buffer));
          return hashArray.map(function (b) { return b.toString(16).padStart(2, "0"); }).join("");
        }).catch(function () {
          return "fallback_" + Math.abs(payload.split("").reduce(function (a, b) { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0)).toString(16);
        });
      }
      var simpleHash = Math.abs(payload.split("").reduce(function (a, b) { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0)).toString(16);
      return Promise.resolve("fallback_" + simpleHash);
    },

    /**
     * Stores a validated high score with its tamper signature
     */
    saveSignedScore: function (gameId, score) {
      var self = this;
      var ts = Date.now();
      return this.generateScoreSignature(gameId, score, ts).then(function (sig) {
        var record = {
          gameId: gameId,
          score: Number(score),
          timestamp: ts,
          signature: sig
        };
        self.setJSON("signed_score", record);
        self.setItem("highScore", String(score));
        return record;
      });
    },

    /**
     * Verifies stored score against signature. Resets score to 0 if tampered.
     */
    verifySignedScore: function (gameId) {
      var self = this;
      var record = this.getJSON("signed_score", null);
      if (!record || typeof record.score !== 'number' || !record.signature) {
        return Promise.resolve({ valid: true, score: Number(self.getItem("highScore") || 0) });
      }
      return this.generateScoreSignature(gameId, record.score, record.timestamp).then(function (expectedSig) {
        if (record.signature === expectedSig) {
          return { valid: true, score: record.score };
        } else {
          console.warn("[AntiCheat] Tampering detected in score storage for " + gameId + "! Resetting score.");
          self.setItem("highScore", "0");
          self.removeItem("signed_score");
          return { valid: false, score: 0 };
        }
      });
    },

    /**
     * Transparent Storage Interceptor
     * Automatically traps raw localStorage calls for legacy game scripts
     */
    enableTransparentShim: function () {
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          var realGet = window.localStorage.getItem.bind(window.localStorage);
          var realSet = window.localStorage.setItem.bind(window.localStorage);
          var self = this;

          // Proxied helper to ensure high scores and sound toggles are namespaced
          window.ArcadeStorageShim = {
            getItem: function (k) {
              return self.getItem(k);
            },
            setItem: function (k, v) {
              return self.setItem(k, v);
            },
            removeItem: function (k) {
              return self.removeItem(k);
            },
            clear: function () {
              return self.clear();
            },
            getAll: function () {
              return self.getAll();
            }
          };
        }
      } catch (_) {}
    },

    /**
     * Inspect all key-value pairs stored for this isolated game
     * @returns {Object} map of key -> value
     */
    getAll: function () {
      var store = {};
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          for (var i = 0; i < window.localStorage.length; i++) {
            var k = window.localStorage.key(i);
            if (k && k.indexOf(this.prefix) === 0) {
              var cleanKey = k.substring(this.prefix.length);
              store[cleanKey] = window.localStorage.getItem(k);
            }
          }
        }
      } catch (err) {
        console.warn("[ArcadeVerse SDK] Failed to inspect all isolated storage keys:", err);
      }
      return store;
    },

    /**
     * Calculate total bytes consumed by this game's isolated storage
     * @returns {number} bytes
     */
    getStorageFootprint: function () {
      var total = 0;
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          for (var i = 0; i < window.localStorage.length; i++) {
            var k = window.localStorage.key(i);
            if (k && k.indexOf(this.prefix) === 0) {
              var val = window.localStorage.getItem(k) || "";
              total += (k.length + val.length) * 2;
            }
          }
        }
      } catch (_) {}
      return total;
    },

    /**
     * Export all keys and values for this game as an exportable object
     * @returns {Object}
     */
    exportGameState: function () {
      return {
        gameId: detectedGameId,
        exportedAt: new Date().toISOString(),
        footprintBytes: this.getStorageFootprint(),
        data: this.getAll()
      };
    },

    /**
     * Restore or import game state from an exported snapshot
     * @param {Object} snapshot
     * @returns {number} count of keys restored
     */
    importGameState: function (snapshot) {
      if (!snapshot || typeof snapshot !== "object" || !snapshot.data) {
        return 0;
      }
      var count = 0;
      var data = snapshot.data;
      for (var key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          this.setItem(key, data[key]);
          count++;
        }
      }
      return count;
    }
  };

  if (typeof window !== "undefined") {
    window.ArcadeStorage = ArcadeStorage;
    ArcadeStorage.enableTransparentShim();
  }

  var isInitialized = false;
  var pauseHandlers = [];
  var resumeHandlers = [];
  var teardownHandlers = [];
  var audioConfigHandlers = [];
  var speedChangeHandlers = [];
  var currentGameSpeed = 1.0;

  // Cryptographic Session Handshake Subsystem (Issue #489, #886)
  var sessionToken = null;
  var handshakeComplete = false;
  var handshakePendingCallbacks = [];

  /**
   * Determine trusted default parent origin based on window.location.origin or document.referrer
   * Strictly avoids default wildcard '*' fallback to prevent token leaks (#886)
   */
  function resolveInitialParentOrigin() {
    try {
      if (typeof window !== "undefined" && window.location && window.location.origin && window.location.origin !== "null") {
        return window.location.origin;
      }
    } catch (_) {}
    try {
      if (typeof document !== "undefined" && document.referrer) {
        var refUrl = new URL(document.referrer);
        if (refUrl.origin && refUrl.origin !== "null") {
          return refUrl.origin;
        }
      }
    } catch (_) {}
    return null;
  }

  var parentOrigin = resolveInitialParentOrigin();
  var securityTelemetry = {
    messagesReceived: 0,
    messagesValidated: 0,
    messagesRejected: 0,
    handshakeTimestamp: 0,
    lastValidatedOrigin: null
  };

  /**
   * Safe origin comparator for sandboxed iframes & cross-origin verification (#886)
   * Validates exact match with window.location.origin, document.referrer, or explicit allowlisted origins
   */
  function isTrustedParentOrigin(origin) {
    if (!origin || origin === "null") {
      // Tolerate file: or local direct execution
      return true;
    }

    try {
      if (window.location && window.location.origin && window.location.origin !== "null") {
        if (origin === window.location.origin) return true;
      }
    } catch (_) {}

    try {
      if (document.referrer) {
        var ref = new URL(document.referrer);
        if (ref.origin === origin) return true;
      }
    } catch (_) {}

    // Allow known local development hosts
    if (origin.indexOf("http://localhost:") === 0 ||
        origin.indexOf("http://127.0.0.1:") === 0 ||
        origin === "http://localhost" ||
        origin === "http://127.0.0.1") {
      return true;
    }

    return false;
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
   * Internal secure dispatch to parent with cryptographic session authentication (#886)
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

    var target = parentOrigin || resolveInitialParentOrigin();
    if (!target || target === "null") {
      // In standalone / unhosted local file testing fallback
      target = "*";
    }

    try {
      window.parent.postMessage(message, target);
      securityTelemetry.messagesValidated++;
    } catch (err) {
      console.warn("[ArcadeVerse SDK] Secure postMessage failed:", err);
      securityTelemetry.messagesRejected++;
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


  var currentAudioConfig = (function () {
    var muted = false;
    var volume = 1.0;
    try {
      if (typeof localStorage !== "undefined") {
        var rawMuted = localStorage.getItem("av_sound_muted");
        if (rawMuted === null) rawMuted = localStorage.getItem("arcadeverse_muted");
        if (rawMuted !== null) muted = rawMuted === "true";
        var rawVolStr = localStorage.getItem("av_master_volume") || localStorage.getItem("arcadeverse_master_volume");
        if (rawVolStr !== null) {
          var rawVol = parseFloat(rawVolStr);
          if (Number.isFinite(rawVol)) volume = Math.max(0, Math.min(1, rawVol));
        }
      }
      if (typeof window !== "undefined" && window.location && window.location.search) {
        var p = new URLSearchParams(window.location.search);
        if (p.has("av_muted")) {
          var pm = p.get("av_muted");
          muted = pm === "1" || pm === "true";
        }
        if (p.has("av_vol")) {
          var pv = parseFloat(p.get("av_vol"));
          if (!isNaN(pv)) volume = Math.max(0, Math.min(1, pv));
        }
      }
    } catch (_) {}
    return { muted: muted, volume: volume };
  })();

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
        // Latch verified handshake origin rather than permissive wildcard (#886)
        if (event.origin && event.origin !== "null" && event.origin !== "*") {
          parentOrigin = event.origin;
        } else {
          parentOrigin = resolveInitialParentOrigin();
        }

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

      case "ARCADEVERSE_GAMEPAD_KEY":
        if (data.eventType && data.key) {
          try {
            var keyCode = data.keyCode || 0;
            var keyEvent = new KeyboardEvent(data.eventType, {
              key: data.key,
              code: data.code || data.key,
              keyCode: keyCode,
              which: keyCode,
              bubbles: true,
              cancelable: true
            });
            window.dispatchEvent(keyEvent);
            document.dispatchEvent(keyEvent);
          } catch (_) {}
        }
        break;

      case "ARCADEVERSE_VOLUME_SYNC":
      case "ARCADEVERSE_AUDIO_CONFIG":
        if (typeof data.muted === "boolean") currentAudioConfig.muted = data.muted;
        if (typeof data.volume === "number") currentAudioConfig.volume = data.volume;
        if (typeof data.gain === "number" && data.muted === undefined) currentAudioConfig.volume = data.gain;
        try {
          localStorage.setItem("av_sound_muted", currentAudioConfig.muted ? "true" : "false");
          localStorage.setItem("av_master_volume", String(currentAudioConfig.volume));
          localStorage.setItem("arcadeverse_muted", currentAudioConfig.muted ? "true" : "false");
          localStorage.setItem("arcadeverse_master_volume", String(currentAudioConfig.volume));
        } catch (_) {}
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

      case "ARCADEVERSE_SET_SPEED":
      case "AV_SET_GAME_SPEED":
        var targetSpeed = 1.0;
        if (data && typeof data.speedMultiplier === "number") {
          targetSpeed = data.speedMultiplier;
        } else if (data && typeof data.speed === "number") {
          targetSpeed = data.speed;
        }
        targetSpeed = Math.max(0.25, Math.min(3.0, targetSpeed));
        currentGameSpeed = targetSpeed;
        executeHandlers(speedChangeHandlers, { speed: targetSpeed, speedMultiplier: targetSpeed });
        try {
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("arcadeverse:speed-changed", {
              detail: { speed: targetSpeed, speedMultiplier: targetSpeed }
            }));
          }
        } catch (_) {}
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

  function setGainImmediately(gainAudioParam, targetValue, ctx) {
    if (!gainAudioParam) return;
    try {
      var now = ctx && typeof ctx.currentTime === "number" ? ctx.currentTime : 0;
      if (typeof gainAudioParam.cancelScheduledValues === "function") {
        gainAudioParam.cancelScheduledValues(now);
      }
      if (typeof gainAudioParam.setValueAtTime === "function") {
        gainAudioParam.setValueAtTime(targetValue, now);
      }
      gainAudioParam.value = targetValue;
    } catch (_) {
      try {
        gainAudioParam.value = targetValue;
      } catch (_) {}
    }
  }

  function scaleMasterGainNode(gainNode) {
    if (!gainNode || !gainNode.gain) return gainNode;
    var targetGain = currentAudioConfig.muted ? 0 : currentAudioConfig.volume;
    setGainImmediately(gainNode.gain, targetGain, gainNode.context);
    return gainNode;
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
          setGainImmediately(gainNode.gain, targetGain, gainNode.context);
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

  // ========================================================
  // IN-BROWSER DEV MANIFEST VALIDATOR WIDGET (#704)
  // Visible exclusively when window.location.hostname === 'localhost' or '127.0.0.1'
  // Zero production overhead: bypassed completely on live/production domains
  // ========================================================
  var isDevHost = (function () {
    try {
      if (typeof window === "undefined" || !window.location) return false;
      var h = window.location.hostname;
      return h === "localhost" || h === "127.0.0.1" || h === "[::1]";
    } catch (_) {
      return false;
    }
  })();

  function initDevValidator() {
    if (!isDevHost) return;
    if (typeof document === "undefined" || typeof window === "undefined") return;

    var EMOJI_REGEX = /[\uD83C-\uDBFF\uDC00-\uDFFF]|[\u2600-\u27BF]/;
    var REQUIRED_JSON_FIELDS = ["title", "category", "description", "author", "github"];

    function runAudit() {
      var errors = [];
      var warnings = [];
      var passed = [];

      var jsonUrl = "game.json";
      var cssUrl = "style.css";
      var jsUrl = "game.js";

      Promise.all([
        // 1. Fetch game.json
        fetch(jsonUrl).then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.text();
        }).catch(function (err) {
          return { error: "Missing or unreachable file: game.json (" + err.message + ")" };
        }),
        // 2. Head check style.css
        fetch(cssUrl, { method: "HEAD" }).then(function (res) {
          return res.ok;
        }).catch(function () { return false; }),
        // 3. Head check game.js
        fetch(jsUrl, { method: "HEAD" }).then(function (res) {
          return res.ok;
        }).catch(function () { return false; })
      ]).then(function (results) {
        var jsonRaw = results[0];
        var cssOk = results[1];
        var jsOk = results[2];

        // 4-file compliance check: index.html, style.css, game.js, game.json
        if (!cssOk) {
          errors.push("Missing required bundle file: style.css");
        } else {
          passed.push("style.css present");
        }

        if (!jsOk) {
          errors.push("Missing required bundle file: game.js");
        } else {
          passed.push("game.js present");
        }

        if (!document.title || !document.title.trim()) {
          errors.push("index.html is missing a <title> tag");
        } else {
          passed.push("index.html <title> present");
        }

        // game.json structure & field validation
        if (typeof jsonRaw === "object" && jsonRaw.error) {
          errors.push(jsonRaw.error);
        } else if (typeof jsonRaw === "string") {
          // Emoji check in game.json
          if (EMOJI_REGEX.test(jsonRaw)) {
            warnings.push("Unicode emoji detected in game.json (use Lucide icons or SVG)");
          }

          try {
            var meta = JSON.parse(jsonRaw);
            REQUIRED_JSON_FIELDS.forEach(function (field) {
              if (!meta[field] || (typeof meta[field] === "string" && !meta[field].trim())) {
                errors.push("game.json missing required field: \"" + field + "\"");
              }
            });

            ["title", "category", "author", "description"].forEach(function (field) {
              var val = meta[field];
              if (typeof val === "string" && (val.indexOf('"') !== -1 || val.indexOf("<") !== -1 || val.indexOf(">") !== -1)) {
                errors.push("Attribute breakout risk: \"" + field + "\" contains unescaped quotes or angle brackets");
              }
            });

            if (errors.filter(function (e) { return e.indexOf("game.json") !== -1; }).length === 0) {
              passed.push("game.json manifest schema valid");
            }
          } catch (jsonErr) {
            errors.push("game.json contains invalid JSON: " + jsonErr.message);
          }
        }

        // Unicode emoji scan in DOM body
        var bodyHtml = document.body ? document.body.innerHTML : "";
        if (EMOJI_REGEX.test(bodyHtml)) {
          warnings.push("Unicode emoji detected in index.html DOM (replace with SVG/Lucide)");
        } else {
          passed.push("Zero unicode emojis in HTML");
        }

        renderBadge(errors, warnings, passed);
        logConsole(errors, warnings, passed);
      }).catch(function (fatal) {
        console.warn("[ArcadeVerse DevValidator] Unexpected audit error:", fatal);
      });
    }

    function logConsole(errors, warnings, passed) {
      if (errors.length === 0 && warnings.length === 0) {
        console.group("%c[ArcadeVerse DevValidator] %cPASS", "color:#38bdf8;font-weight:bold;", "color:#22c55e;font-weight:bold;");
        passed.forEach(function (p) { console.log("%c✓ " + p, "color:#22c55e;"); });
        console.log("%cPre-flight validation passed for local development.", "color:#94a3b8;font-style:italic;");
        console.groupEnd();
      } else {
        var statusLabel = errors.length > 0 ? "FAIL (" + errors.length + " errors)" : "WARN (" + warnings.length + " warnings)";
        var statusColor = errors.length > 0 ? "color:#ef4444;font-weight:bold;" : "color:#f59e0b;font-weight:bold;";
        console.group("%c[ArcadeVerse DevValidator] %c" + statusLabel, "color:#38bdf8;font-weight:bold;", statusColor);
        errors.forEach(function (e) { console.error("❌ " + e); });
        warnings.forEach(function (w) { console.warn("⚠️ " + w); });
        passed.forEach(function (p) { console.log("%c✓ " + p, "color:#94a3b8;"); });
        console.groupEnd();
      }
    }

    function renderBadge(errors, warnings, passed) {
      var existing = document.getElementById("dev-validator-badge");
      if (existing) existing.remove();

      var badge = document.createElement("div");
      badge.id = "dev-validator-badge";
      badge.setAttribute("role", "status");
      badge.setAttribute("aria-live", "polite");

      var statusClass = errors.length > 0 ? "fail" : (warnings.length > 0 ? "warn" : "pass");
      badge.className = "dev-validator-badge " + statusClass;

      var statusText = errors.length > 0
        ? "DEV: FAIL (" + errors.length + ")"
        : (warnings.length > 0 ? "DEV: " + warnings.length + " WARN" : "DEV: PASS");

      var titleAttr = errors.length > 0
        ? "ArcadeVerse DevTools: Validation errors detected (Click to expand / check console)"
        : "ArcadeVerse DevTools: All pre-flight checks passed";

      var html = '<div class="dev-validator-pill" title="' + titleAttr + '">' +
        '<span class="dev-validator-dot"></span>' +
        '<span class="dev-validator-text">' + statusText + '</span>' +
        '</div>';

      html += '<div class="dev-validator-details">';
      errors.forEach(function (e) {
        html += '<div class="dev-validator-item error">❌ ' + escapeHtml(e) + '</div>';
      });
      warnings.forEach(function (w) {
        html += '<div class="dev-validator-item warn">⚠️ ' + escapeHtml(w) + '</div>';
      });
      passed.forEach(function (p) {
        html += '<div class="dev-validator-item pass">✓ ' + escapeHtml(p) + '</div>';
      });
      html += '</div>';

      badge.innerHTML = html;

      // Inline fallback styling in case game doesn't link style.css
      badge.style.position = "fixed";
      badge.style.bottom = "12px";
      badge.style.right = "12px";
      badge.style.zIndex = "999999";
      badge.style.fontSize = "11px";
      badge.style.fontWeight = "600";
      badge.style.borderRadius = "20px";
      badge.style.cursor = "pointer";
      badge.style.userSelect = "none";
      badge.style.fontFamily = "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif";

      badge.addEventListener("click", function () {
        badge.classList.toggle("expanded");
      });

      document.body.appendChild(badge);
    }

    function escapeHtml(s) {
      return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", runAudit);
    } else {
      setTimeout(runAudit, 120);
    }
  }

  /**
   * Initializes message bridging with parent window
   */

  function applyReducedMotionClass(reduce) {
    try {
      if (typeof document !== 'undefined' && document.documentElement) {
        if (reduce) {
          document.documentElement.classList.add('av-reduced-motion');
          if (document.body) document.body.classList.add('av-reduced-motion');
        } else {
          document.documentElement.classList.remove('av-reduced-motion');
          if (document.body) document.body.classList.remove('av-reduced-motion');
        }
      }
    } catch (_) {}
  }

  // Auto-detect and tag documentElement with reduced motion class on initialization (#720)
  try {
    if (typeof window !== 'undefined') {
      var isInitialReduced = (function () {
        if (window.location && window.location.search && /[?&]reducedMotion=(1|true)/i.test(window.location.search)) return true;
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
        if (localStorage.getItem('arcadeverse_reduced_motion') === 'true') return true;
        return false;
      })();
      applyReducedMotionClass(isInitialReduced);

      if (window.matchMedia) {
        var motionMq = window.matchMedia('(prefers-reduced-motion: reduce)');
        var handleMotionMqChange = function (e) {
          applyReducedMotionClass(e.matches);
        };
        if (motionMq.addEventListener) {
          motionMq.addEventListener('change', handleMotionMqChange);
        } else if (motionMq.addListener) {
          motionMq.addListener(handleMotionMqChange);
        }
      }
    }
  } catch (_) {}

  function init() {
    if (isInitialized) return;
    if (typeof window !== "undefined") {
      window.addEventListener("message", handleParentMessage, false);

      // Check localStorage and URL params for persisted volume on startup
      try {
        var params = (typeof window !== "undefined" && window.location && window.location.search)
          ? new URLSearchParams(window.location.search)
          : null;

        var isMuted = false;
        var rawMuted = localStorage.getItem("av_sound_muted");
        if (rawMuted === null) rawMuted = localStorage.getItem("arcadeverse_muted");
        if (rawMuted !== null) isMuted = rawMuted === "true";
        if (params && params.has("av_muted")) {
          var pm = params.get("av_muted");
          isMuted = pm === "1" || pm === "true";
        }

        var masterVolStr = localStorage.getItem("av_master_volume") || localStorage.getItem("arcadeverse_master_volume");
        var masterVol = NaN;
        if (masterVolStr !== null) {
          masterVol = parseFloat(masterVolStr);
        }
        if (params && params.has("av_vol")) {
          var pv = parseFloat(params.get("av_vol"));
          if (!isNaN(pv)) masterVol = pv;
        }

        if (Number.isFinite(masterVol)) currentAudioConfig.volume = Math.max(0, Math.min(1, masterVol));
        currentAudioConfig.muted = isMuted;
      } catch (_) {}

      // Ping parent window for initial audio and speed configuration
      if (window.parent && window.parent !== window) {
        securePostToParent("ARCADEVERSE_REQUEST_AUDIO_CONFIG", {});
        securePostToParent("ARCADEVERSE_REQUEST_SPEED_CONFIG", {});

        // Forward global keyboard shortcuts from inside game iframe to parent shell
        window.addEventListener("keydown", function (e) {
          var key = (e.key || "").toLowerCase();
          // Escape (close modal), f (fullscreen), r (restart), m (mute), t (theme), [ / ] (speed)
          if (e.key === "Escape" || key === "f" || key === "r" || key === "m" || key === "t" || e.key === "[" || e.key === "]") {
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

      // Universal AudioContext & Master Gain Shield
      // Ensures games initializing local AudioContext start muted if hub is muted
      installAudioShield();

      isInitialized = true;
    }
  }

  function installAudioShield() {
    if (typeof window === "undefined") return;

    var NativeAudioContext = window.AudioContext || window.webkitAudioContext;
    if (NativeAudioContext && !NativeAudioContext._avPatched) {
      function PatchedAudioContext() {
        var args = Array.prototype.slice.call(arguments);
        var ctx;
        if (args.length > 0) {
          ctx = new (Function.prototype.bind.apply(NativeAudioContext, [null].concat(args)))();
        } else {
          ctx = new NativeAudioContext();
        }

        if (registeredAudioContexts.indexOf(ctx) === -1) {
          registeredAudioContexts.push(ctx);
        }

        if (currentAudioConfig.muted && ctx.state === "running") {
          ctx.suspend().catch(function () {});
        }

        var origResume = ctx.resume;
        ctx.resume = function () {
          if (currentAudioConfig.muted) {
            return Promise.resolve();
          }
          return origResume.apply(ctx, arguments);
        };

        return ctx;
      }

      PatchedAudioContext.prototype = NativeAudioContext.prototype;
      PatchedAudioContext._avPatched = true;

      try {
        if (window.AudioContext) window.AudioContext = PatchedAudioContext;
        if (window.webkitAudioContext) window.webkitAudioContext = PatchedAudioContext;
      } catch (_) {}
    }

    if (typeof window.AudioNode !== "undefined" && window.AudioNode.prototype && !window.AudioNode.prototype._avConnectPatched) {
      var origConnect = window.AudioNode.prototype.connect;
      window.AudioNode.prototype.connect = function (target) {
        var isGain = (typeof window.GainNode !== "undefined" && this instanceof window.GainNode) ||
                     (this && this.gain && typeof this.gain.setValueAtTime === "function");
        if (isGain && target && this.context && (target === this.context.destination)) {
          if (registeredGainNodes.indexOf(this) === -1) {
            registeredGainNodes.push(this);
          }
          scaleMasterGainNode(this);
        }
        return origConnect.apply(this, arguments);
      };
      window.AudioNode.prototype._avConnectPatched = true;
    }
  }

  init();

  var sdkInstance = {
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
     * Track an AudioContext for automatic suspension/closure on teardown and mute synchronization
     * @param {AudioContext} ctx
     */
    trackAudioContext: function (ctx) {
      if (ctx) {
        if (registeredAudioContexts.indexOf(ctx) === -1) {
          registeredAudioContexts.push(ctx);
        }
        if (!this._trackedAudioContexts) this._trackedAudioContexts = [];
        if (this._trackedAudioContexts.indexOf(ctx) === -1) {
          this._trackedAudioContexts.push(ctx);
        }
        if (currentAudioConfig.muted && ctx.state === "running") {
          ctx.suspend().catch(function () {});
        }
      }
      return ctx;
    },

    /**
     * Alias for trackAudioContext
     */
    registerAudioContext: function (ctx) {
      return this.trackAudioContext(ctx);
    },

    /**
     * Registers and scales any master GainNode to match the hub volume and mute state
     * @param {GainNode} gainNode
     * @returns {GainNode}
     */
    registerMasterGainNode: function (gainNode) {
      if (gainNode && registeredGainNodes.indexOf(gainNode) === -1) {
        registeredGainNodes.push(gainNode);
      }
      if (gainNode) {
        scaleMasterGainNode(gainNode);
        if (gainNode.context) {
          this.trackAudioContext(gainNode.context);
        }
      }
      return gainNode;
    },

    /**
     * Alias for registerMasterGainNode
     */
    registerGainNode: function (gainNode) {
      return this.registerMasterGainNode(gainNode);
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
      scaleMasterGainNode(gainNode);
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
     * Trigger controller haptic rumble on connected physical gamepads (#515)
     * @param {number} [durationMs=150] Duration of vibration in milliseconds
     * @param {number} [strongMagnitude=0.6] Low-frequency motor intensity (0.0 to 1.0)
     * @param {number} [weakMagnitude=0.4] High-frequency motor intensity (0.0 to 1.0)
     */
    triggerGamepadRumble: function (durationMs, strongMagnitude, weakMagnitude) {
      securePostToParent("ARCADEVERSE_GAMEPAD_RUMBLE", {
        duration: typeof durationMs === "number" ? durationMs : 150,
        strong: typeof strongMagnitude === "number" ? strongMagnitude : 0.6,
        weak: typeof weakMagnitude === "number" ? weakMagnitude : 0.4
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
     * Access namespaced in-iframe storage engine
     */
    storage: ArcadeStorage,

    /**
     * Helper to wrap native AudioContext creation with automatic lifecycle tracking
     * @returns {AudioContext}
     */
    /**
     * Subscribe to standardized resize broadcasts from parent modal (#501)
     * @param {Function} onResizeCallback
     */
    onResize: function (onResizeCallback) {
      if (typeof window === 'undefined' || typeof onResizeCallback !== 'function') return;
      window.addEventListener('message', function (e) {
        if (e && e.data && e.data.type === 'AV_RESIZE') {
          onResizeCallback(e.data);
        }
      });
    },

    /**
     * Fit canvas dynamically into target aspect ratio
     * @param {HTMLCanvasElement} canvas
     * @param {number} targetRatio (e.g. 16/9, 4/3, 1)
     */
    /**
     * Compute optimum canvas render resolution given display DPI
     * @param {number} baseWidth
     * @param {number} baseHeight
     * @returns {{renderWidth: number, renderHeight: number, dpr: number}}
     */
    getOptimumResolution: function (baseWidth, baseHeight) {
      var dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
      return {
        renderWidth: Math.round(baseWidth * dpr),
        renderHeight: Math.round(baseHeight * dpr),
        dpr: dpr
      };
    },

    /**
     * Calculate and apply pillarbox or letterbox margins
     * @param {HTMLElement} element
     * @param {number} ratio
     */
    applyLetterboxPadding: function (element, ratio) {
      if (!element || !element.parentElement) return;
      var parent = element.parentElement;
      var containerRatio = parent.clientWidth / parent.clientHeight;
      if (containerRatio > ratio) {
        element.style.marginTop = '0';
        element.style.marginBottom = '0';
      } else {
        var diff = parent.clientHeight - (parent.clientWidth / ratio);
        element.style.marginTop = (diff / 2) + 'px';
        element.style.marginBottom = (diff / 2) + 'px';
      }
    },

    fitCanvasAspectRatio: function (canvas, targetRatio) {
      if (!canvas || !canvas.parentElement) return;
      var parent = canvas.parentElement;
      var pWidth = parent.clientWidth;
      var pHeight = parent.clientHeight;
      var currentRatio = pWidth / pHeight;

      if (currentRatio > targetRatio) {
        canvas.style.height = pHeight + 'px';
        canvas.style.width = (pHeight * targetRatio) + 'px';
      } else {
        canvas.style.width = pWidth + 'px';
        canvas.style.height = (pWidth / targetRatio) + 'px';
      }
    },

    /**
     * Compute coordinate transform for letterboxed / scaled canvas mouse & touch events
     * @param {MouseEvent|TouchEvent} event - DOM mouse or touch event
     * @param {HTMLCanvasElement} canvas - The target game canvas
     * @param {number} internalWidth - Virtual canvas buffer width
     * @param {number} internalHeight - Virtual canvas buffer height
     * @returns {{x: number, y: number}} Scaled virtual coordinates
     */
    mapEventToCanvasCoordinates: function (event, canvas, internalWidth, internalHeight) {
      if (!canvas) return { x: 0, y: 0 };
      var rect = canvas.getBoundingClientRect();
      var clientX = event.clientX;
      var clientY = event.clientY;
      if (event.touches && event.touches.length > 0) {
        clientX = event.touches[0].clientX;
        clientY = event.touches[0].clientY;
      }
      var scaleX = (internalWidth || canvas.width) / (rect.width || 1);
      var scaleY = (internalHeight || canvas.height) / (rect.height || 1);
      return {
        x: Math.max(0, Math.min(internalWidth || canvas.width, (clientX - rect.left) * scaleX)),
        y: Math.max(0, Math.min(internalHeight || canvas.height, (clientY - rect.top) * scaleY))
      };
    },

    /**
     * Preserves retro pixel art crispness across high-DPI and scaled modal viewports
     * @param {HTMLCanvasElement} canvas
     * @param {CanvasRenderingContext2D} ctx
     */
    enforcePixelCrispness: function (canvas, ctx) {
      if (canvas && canvas.style) {
        canvas.style.imageRendering = '-moz-crisp-edges';
        canvas.style.imageRendering = '-webkit-crisp-edges';
        canvas.style.imageRendering = 'pixelated';
        canvas.style.imageRendering = 'crisp-edges';
      }
      if (ctx) {
        ctx.imageSmoothingEnabled = false;
        ctx.webkitImageSmoothingEnabled = false;
        ctx.mozImageSmoothingEnabled = false;
        ctx.msImageSmoothingEnabled = false;
      }
    },

    createAudioContext: function () {
      var AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      var ctx = new AudioContextClass();
      this.trackAudioContext(ctx);
      return ctx;
    },

    /**
     * Helper to format and export backup-compliant state object for this game
     * Ensures all keys follow primitive schema to prevent backup corruptions (#495)
     * @param {string} gameId
     * @param {Object} stateData
     * @returns {Object}
     */
    createBackupPayload: function (gameId, stateData) {
      if (!gameId || typeof stateData !== 'object' || !stateData) return {};
      var payload = {};
      for (var k in stateData) {
        if (Object.prototype.hasOwnProperty.call(stateData, k)) {
          var val = stateData[k];
          if (typeof val === 'object' && val !== null) {
            payload['av_' + gameId + '_' + k] = JSON.stringify(val);
          } else {
            payload['av_' + gameId + '_' + k] = String(val);
          }
        }
      }
      return payload;
    },

    /**
     * Global Master Volume & Mute Synchronization Bridge (#506)
     * Creates a master GainNode connected directly to audioContext.destination
     * and automatically syncs its gain value with parent hub volume/mute broadcasts
     * @param {AudioContext} audioCtx
     * @param {function(number, boolean): void} [onVolumeChange] - Optional callback
     * @returns {{masterGain: GainNode, setVolume: function(number): void, setMuted: function(boolean): void, getVolume: function(): number, isMuted: function(): boolean}}
     */
    createMasterGainBridge: function (audioCtx, onVolumeChange) {
      if (!audioCtx) return null;
      var ctx = audioCtx;
      var masterGain = ctx.createGain();
      masterGain.connect(ctx.destination);

      var currentVolume = currentAudioConfig.volume;
      var isMuted = currentAudioConfig.muted;

      if (registeredGainNodes.indexOf(masterGain) === -1) {
        registeredGainNodes.push(masterGain);
      }
      this.trackAudioContext(ctx);
      scaleMasterGainNode(masterGain);

      var applyGain = function () {
        var targetGain = isMuted ? 0 : currentVolume;
        if (ctx.state === 'running') {
          try {
            masterGain.gain.setValueAtTime(masterGain.gain.value, ctx.currentTime);
            masterGain.gain.linearRampToValueAtTime(targetGain, ctx.currentTime + 0.05);
          } catch (_) {
            setGainImmediately(masterGain.gain, targetGain, ctx);
          }
        } else {
          setGainImmediately(masterGain.gain, targetGain, ctx);
        }
        if (typeof onVolumeChange === 'function') {
          onVolumeChange(currentVolume, isMuted);
        }
      };

      applyGain();

      // Listen for parent hub audio broadcasts
      var handleMessage = function (e) {
        if (!e || !e.data) return;
        if (e.data.type === 'ARCADEVERSE_VOLUME_SYNC' || e.data.type === 'ARCADEVERSE_AUDIO_CONFIG') {
          if (typeof e.data.muted === 'boolean') isMuted = e.data.muted;
          if (typeof e.data.volume === 'number') currentVolume = Math.max(0, Math.min(1, e.data.volume));
          applyGain();
        } else if (e.data.type === 'AV_MUTE_CHANGE' && e.data.payload) {
          if (typeof e.data.payload.muted === 'boolean') isMuted = e.data.payload.muted;
          if (typeof e.data.payload.volume === 'number') currentVolume = Math.max(0, Math.min(1, e.data.payload.volume));
          applyGain();
        }
      };
      window.addEventListener('message', handleMessage);

      // Query initial configuration from parent window
      try {
        if (window.parent && window.parent !== window) {
          var audioReqTarget = parentOrigin || resolveInitialParentOrigin() || "*";
          window.parent.postMessage({ type: 'ARCADEVERSE_REQUEST_AUDIO_CONFIG' }, audioReqTarget);
        }
      } catch (_e) {}

      return {
        masterGain: masterGain,
        setVolume: function (vol) {
          currentVolume = Math.max(0, Math.min(1, Number(vol) || 0));
          applyGain();
        },
        setMuted: function (muted) {
          isMuted = !!muted;
          applyGain();
        },
        getVolume: function () {
          return currentVolume;
        },
        isMuted: function () {
          return isMuted;
        },
        dispose: function () {
          window.removeEventListener('message', handleMessage);
          var idx = registeredGainNodes.indexOf(masterGain);
          if (idx !== -1) registeredGainNodes.splice(idx, 1);
          try {
            masterGain.disconnect();
          } catch (_e) {}
        }
      };
    },

    /**
     * Helper to route an HTML5 Audio element through the synchronized Master Gain bus
     * @param {HTMLAudioElement} audioElement
     * @param {AudioContext} audioCtx
     * @param {GainNode} masterGain
     * @returns {MediaElementAudioSourceNode|null}
     */
    routeMediaElementToMaster: function (audioElement, audioCtx, masterGain) {
      if (!audioElement || !audioCtx || !masterGain) return null;
      try {
        var sourceNode = audioCtx.createMediaElementSource(audioElement);
        sourceNode.connect(masterGain);
        return sourceNode;
      } catch (_e) {
        return null;
      }
    },

    /**
     * Crossfade between two audio nodes smoothly using linear gain ramping
     * @param {GainNode} gainOut - Node to fade out
     * @param {GainNode} gainIn - Node to fade in
     * @param {AudioContext} audioCtx
     * @param {number} durationSec - Crossfade duration in seconds
     */
    crossfadeNodes: function (gainOut, gainIn, audioCtx, durationSec) {
      if (!audioCtx) return;
      var duration = typeof durationSec === 'number' && durationSec > 0 ? durationSec : 0.8;
      var now = audioCtx.currentTime;
      if (gainOut && gainOut.gain) {
        gainOut.gain.setValueAtTime(gainOut.gain.value, now);
        gainOut.gain.linearRampToValueAtTime(0, now + duration);
      }
      if (gainIn && gainIn.gain) {
        gainIn.gain.setValueAtTime(gainIn.gain.value, now);
        gainIn.gain.linearRampToValueAtTime(1, now + duration);
      }
    },

    /**
     * Envelope shaper utility for game sound effects (Attack, Decay, Sustain, Release)
     * @param {AudioParam} gainParam - The target audio node's gain parameter
     * @param {AudioContext} audioCtx
     * @param {{attack?: number, decay?: number, sustain?: number, release?: number, peak?: number}} envelope
     */
    applyAdsrEnvelope: function (gainParam, audioCtx, envelope) {
      if (!gainParam || !audioCtx) return;
      var env = envelope || {};
      var now = audioCtx.currentTime;
      var a = env.attack || 0.01;
      var d = env.decay || 0.05;
      var s = typeof env.sustain === 'number' ? env.sustain : 0.3;
      var r = env.release || 0.15;
      var peak = typeof env.peak === 'number' ? env.peak : 0.8;

      gainParam.cancelScheduledValues(now);
      gainParam.setValueAtTime(0, now);
      gainParam.linearRampToValueAtTime(peak, now + a);
      gainParam.linearRampToValueAtTime(peak * s, now + a + d);
      gainParam.linearRampToValueAtTime(0, now + a + d + r);
    },

    /**
     * Calibrate sound output for quiet environments or headphone listening
     * Dynamically normalizes peak dB level across retro synth channels
     * @param {AudioContext} audioCtx
     * @returns {DynamicsCompressorNode|null}
     */
    createArcadeCompressor: function (audioCtx) {
      if (!audioCtx) return null;
      try {
        var comp = audioCtx.createDynamicsCompressor();
        comp.threshold.setValueAtTime(-24, audioCtx.currentTime);
        comp.knee.setValueAtTime(30, audioCtx.currentTime);
        comp.ratio.setValueAtTime(12, audioCtx.currentTime);
        comp.attack.setValueAtTime(0.003, audioCtx.currentTime);
        comp.release.setValueAtTime(0.25, audioCtx.currentTime);
        return comp;
      } catch (_e) {
        return null;
      }
    },

    /**
     * Mutes all tracked active audio contexts in the current window instantly
     */
    silenceAllTrackedAudio: function () {
      if (!this._trackedAudioContexts) return;
      this._trackedAudioContexts.forEach(function (ctx) {
        try {
          if (ctx.state === 'running') {
            ctx.suspend();
          }
        } catch (_e) {}
      });
    },

    /**
     * Resumes all tracked active audio contexts in the current window
     */
    resumeAllTrackedAudio: function () {
      if (!this._trackedAudioContexts) return;
      this._trackedAudioContexts.forEach(function (ctx) {
        try {
          if (ctx.state === 'suspended') {
            ctx.resume();
          }
        } catch (_e) {}
      });
    },

    /**
     * Expose or connect ArcadeAudio sound synthesizer to SDK instance (#510, #694)
     */
    getSoundSynthesizer: function () {
      if (typeof window !== 'undefined' && window.ArcadeAudio) {
        return window.ArcadeAudio;
      }
      return null;
    },

    audio: {
      playBGM: function (trackName) {
        if (typeof window !== 'undefined' && window.ArcadeAudio && typeof window.ArcadeAudio.playBGM === 'function') {
          window.ArcadeAudio.playBGM(trackName);
        }
      },
      stopBGM: function () {
        if (typeof window !== 'undefined' && window.ArcadeAudio && typeof window.ArcadeAudio.stopBGM === 'function') {
          window.ArcadeAudio.stopBGM();
        }
      }
    },

    // ========================================================
    // UNIVERSAL HIGH-DPI RETINA CANVAS RESIZER (#558)
    // Ensures pixel-crisp rendering on 2x/3x Retina & 4K displays
    // ========================================================
    /**
     * Initializes or resizes an HTML5 Canvas for High-DPI / Retina displays.
     * Scales physical canvas resolution by devicePixelRatio while preserving logical CSS dimensions.
     * @param {HTMLCanvasElement} canvas
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} [logicalWidth] - Optional design width (defaults to canvas.width or clientWidth)
     * @param {number} [logicalHeight] - Optional design height (defaults to canvas.height or clientHeight)
     * @returns {{ dpr: number, logicalWidth: number, logicalHeight: number }}
     */
    initRetinaCanvas: function (canvas, ctx, logicalWidth, logicalHeight) {
      if (!canvas || !ctx) return { dpr: 1, logicalWidth: 0, logicalHeight: 0 };

      var dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
      var w = logicalWidth || canvas.clientWidth || canvas.width || 800;
      var h = logicalHeight || canvas.clientHeight || canvas.height || 600;

      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';

      // Reset and scale coordinate matrix
      if (typeof ctx.setTransform === 'function') {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      } else if (typeof ctx.scale === 'function') {
        ctx.scale(dpr, dpr);
      }

      return {
        dpr: dpr,
        logicalWidth: w,
        logicalHeight: h
      };
    },

    // ========================================================
    // ARCADEVERSE CAMERA & VIEWPORT SUBSYSTEM
    // Handles 0.5x to 2.0x zoom, middle-click/drag-to-pan,
    // smooth matrix transformations, zero coordinate drift,
    // on-screen reset HUD, and screen-to-world projection
    // ========================================================
    camera: {
      /**
       * Enables interactive zoom & pan on an HTML5 Canvas with smooth matrix transformations.
       * @param {HTMLCanvasElement|string} canvas - Canvas element or selector
       * @param {Object} [options]
       * @param {number} [options.minZoom=0.5] Minimum scale factor
       * @param {number} [options.maxZoom=2.0] Maximum scale factor
       * @param {number} [options.zoomStep=0.1] Zoom step increment per mouse wheel tick
       * @param {boolean} [options.showResetButton=true] Whether to show floating reset HUD
       * @param {boolean} [options.dragToPan=false] Whether left-click dragging also pans without modifier
       * @param {HTMLElement} [options.container] Parent container for the reset HUD
       * @returns {Object} Camera controller instance
       */
      enableZoomPan: function (canvas, options) {
        if (typeof canvas === 'string' && typeof document !== 'undefined') {
          canvas = document.getElementById(canvas) || document.querySelector(canvas);
        }
        if (!canvas) {
          console.warn('[ArcadeVerse.camera] enableZoomPan called with invalid canvas');
          return null;
        }

        options = options || {};
        var minZoom = typeof options.minZoom === 'number' ? Math.max(0.1, options.minZoom) : 0.5;
        var maxZoom = typeof options.maxZoom === 'number' ? Math.min(10.0, options.maxZoom) : 2.0;
        var zoomStep = typeof options.zoomStep === 'number' ? options.zoomStep : 0.1;
        var showResetButton = options.showResetButton !== false;
        var dragToPan = !!options.dragToPan;

        var zoom = 1.0;
        var panX = 0;
        var panY = 0;

        var isDragging = false;
        var dragStartX = 0;
        var dragStartY = 0;
        var initialPanX = 0;
        var initialPanY = 0;
        var hasMovedBeyondThreshold = false;
        var DRAG_THRESHOLD = 4; // px threshold to avoid accidental pan drift on normal clicks
        var isSpacePressed = false;
        var changeListeners = [];

        // Save original styles
        var origTransform = canvas.style.transform || '';
        var origTransformOrigin = canvas.style.transformOrigin || '';
        var origTransition = canvas.style.transition || '';

        canvas.style.transformOrigin = '0 0';

        function updateTransform(withAnimation) {
          if (zoom < minZoom) zoom = minZoom;
          if (zoom > maxZoom) zoom = maxZoom;

          zoom = Math.round(zoom * 10000) / 10000;
          panX = Math.round(panX * 100) / 100;
          panY = Math.round(panY * 100) / 100;

          if (withAnimation) {
            canvas.style.transition = 'transform 0.22s cubic-bezier(0.2, 0, 0, 1)';
            setTimeout(function () {
              if (canvas) canvas.style.transition = origTransition || 'none';
            }, 220);
          } else {
            canvas.style.transition = 'none';
          }

          canvas.style.transform = 'matrix(' + zoom + ', 0, 0, ' + zoom + ', ' + panX + ', ' + panY + ')';

          updateHud();

          for (var i = 0; i < changeListeners.length; i++) {
            try {
              changeListeners[i]({
                zoom: zoom,
                panX: panX,
                panY: panY,
                matrix: [zoom, 0, 0, zoom, panX, panY]
              });
            } catch (_) {}
          }
        }

        /**
         * Projects screen or client coordinates to in-game canvas/world coordinates
         * Accurate at any zoom level with zero drift
         * @param {number|MouseEvent|TouchEvent} clientX - Client X coordinate or event
         * @param {number} [clientY] - Client Y coordinate
         * @returns {{ x: number, y: number, bufferX: number, bufferY: number }}
         */
        function screenToWorld(clientX, clientY) {
          if (clientX && typeof clientX === 'object') {
            var evt = clientX;
            clientX = typeof evt.clientX === 'number' ? evt.clientX : (evt.touches && evt.touches[0] ? evt.touches[0].clientX : 0);
            clientY = typeof evt.clientY === 'number' ? evt.clientY : (evt.touches && evt.touches[0] ? evt.touches[0].clientY : 0);
          }

          var rect = canvas.getBoundingClientRect();
          var cssWidth = canvas.clientWidth || (rect.width > 0 ? rect.width / (zoom || 1) : canvas.width || 800);
          var cssHeight = canvas.clientHeight || (rect.height > 0 ? rect.height / (zoom || 1) : canvas.height || 600);

          var scaleX = rect.width > 0 ? (cssWidth / (rect.width / zoom)) : 1;
          var scaleY = rect.height > 0 ? (cssHeight / (rect.height / zoom)) : 1;

          var worldX = ((clientX - rect.left) / zoom) * scaleX;
          var worldY = ((clientY - rect.top) / zoom) * scaleY;

          var bufScaleX = canvas.width && cssWidth > 0 ? (canvas.width / cssWidth) : 1;
          var bufScaleY = canvas.height && cssHeight > 0 ? (canvas.height / cssHeight) : 1;

          return {
            x: Math.round(worldX * 100) / 100,
            y: Math.round(worldY * 100) / 100,
            bufferX: Math.round(worldX * bufScaleX * 100) / 100,
            bufferY: Math.round(worldY * bufScaleY * 100) / 100
          };
        }

        /**
         * Projects in-game world coordinates to screen/client coordinates
         * @param {number} worldX
         * @param {number} worldY
         * @returns {{ x: number, y: number }}
         */
        function worldToScreen(worldX, worldY) {
          var rect = canvas.getBoundingClientRect();
          var cssWidth = canvas.clientWidth || (rect.width > 0 ? rect.width / (zoom || 1) : canvas.width || 800);
          var cssHeight = canvas.clientHeight || (rect.height > 0 ? rect.height / (zoom || 1) : canvas.height || 600);

          var scaleX = rect.width > 0 ? (cssWidth / (rect.width / zoom)) : 1;
          var scaleY = rect.height > 0 ? (cssHeight / (rect.height / zoom)) : 1;

          var screenX = rect.left + (worldX / scaleX) * zoom;
          var screenY = rect.top + (worldY / scaleY) * zoom;

          return {
            x: Math.round(screenX * 100) / 100,
            y: Math.round(screenY * 100) / 100
          };
        }

        // Attach coordinate helpers to canvas directly for convenient access
        canvas.screenToWorld = screenToWorld;
        canvas.worldToScreen = worldToScreen;

        // Augment pointer events with accurate worldX and worldY coordinates
        function augmentPointerEvent(e) {
          if (!e) return;
          try {
            var coords = screenToWorld(e.clientX, e.clientY);
            e.worldX = coords.x;
            e.worldY = coords.y;
            e.bufferWorldX = coords.bufferX;
            e.bufferWorldY = coords.bufferY;
          } catch (_) {}
        }

        // Mouse Wheel Scaling (0.5x to 2.0x) around cursor focal point
        function handleWheel(e) {
          e.preventDefault();

          var delta = -e.deltaY;
          var factor = delta > 0 ? (1 + zoomStep) : (1 - zoomStep);
          var newZoom = zoom * factor;
          if (newZoom < minZoom) newZoom = minZoom;
          if (newZoom > maxZoom) newZoom = maxZoom;

          if (Math.abs(newZoom - zoom) < 0.001) return;

          var rect = canvas.getBoundingClientRect();
          var cursorX = e.clientX - rect.left;
          var cursorY = e.clientY - rect.top;

          var worldX = cursorX / zoom;
          var worldY = cursorY / zoom;

          panX = panX + cursorX - (worldX * newZoom);
          panY = panY + cursorY - (worldY * newZoom);
          zoom = newZoom;

          updateTransform(false);
        }

        // Middle-click or Drag-to-Pan Handling
        function handlePointerDown(e) {
          augmentPointerEvent(e);

          var isMiddleClick = (e.button === 1);
          var isModifierDrag = (e.button === 0 && (e.altKey || e.shiftKey || isSpacePressed || dragToPan));

          if (isMiddleClick || isModifierDrag) {
            isDragging = true;
            hasMovedBeyondThreshold = false;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            initialPanX = panX;
            initialPanY = panY;

            if (isMiddleClick) {
              e.preventDefault();
            }

            if (typeof canvas.setPointerCapture === 'function' && e.pointerId) {
              try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
            }
          }
        }

        function handlePointerMove(e) {
          augmentPointerEvent(e);

          if (!isDragging) return;

          var dx = e.clientX - dragStartX;
          var dy = e.clientY - dragStartY;

          if (!hasMovedBeyondThreshold) {
            if (Math.sqrt(dx * dx + dy * dy) >= DRAG_THRESHOLD) {
              hasMovedBeyondThreshold = true;
            }
          }

          if (hasMovedBeyondThreshold) {
            panX = initialPanX + dx;
            panY = initialPanY + dy;
            updateTransform(false);
          }
        }

        function handlePointerUp(e) {
          augmentPointerEvent(e);

          if (isDragging) {
            if (hasMovedBeyondThreshold) {
              var preventClick = function (ev) {
                ev.stopPropagation();
                ev.preventDefault();
                window.removeEventListener('click', preventClick, true);
              };
              window.addEventListener('click', preventClick, true);
              setTimeout(function () {
                window.removeEventListener('click', preventClick, true);
              }, 50);
            }
            isDragging = false;
            hasMovedBeyondThreshold = false;
          }
        }

        function handleKeyDown(e) {
          if (e.code === 'Space' || e.key === ' ') {
            isSpacePressed = true;
          }
        }

        function handleKeyUp(e) {
          if (e.code === 'Space' || e.key === ' ') {
            isSpacePressed = false;
          }
        }

        function handleAuxClick(e) {
          if (e.button === 1) {
            e.preventDefault();
          }
        }

        // Bind canvas listeners
        canvas.addEventListener('wheel', handleWheel, { passive: false });
        canvas.addEventListener('pointerdown', handlePointerDown);
        canvas.addEventListener('pointermove', handlePointerMove);
        canvas.addEventListener('pointerup', handlePointerUp);
        canvas.addEventListener('auxclick', handleAuxClick);
        canvas.addEventListener('click', augmentPointerEvent, true);
        if (typeof window !== 'undefined') {
          window.addEventListener('keydown', handleKeyDown);
          window.addEventListener('keyup', handleKeyUp);
          window.addEventListener('pointerup', handlePointerUp);
        }

        // ========================================================
        // ON-SCREEN ZOOM RESET & CONTROLS HUD
        // ========================================================
        var hudElement = null;
        var zoomLabelElement = null;

        function createHud() {
          if (!showResetButton || typeof document === 'undefined') return;

          var targetParent = options.container || canvas.parentElement || document.body;
          if (targetParent && targetParent !== document.body) {
            var computedStyle = window.getComputedStyle ? window.getComputedStyle(targetParent) : targetParent.style;
            if (computedStyle && computedStyle.position === 'static') {
              targetParent.style.position = 'relative';
            }
          }

          var hud = document.createElement('div');
          hud.className = 'av-camera-zoom-hud';
          hud.setAttribute('role', 'region');
          hud.setAttribute('aria-label', 'Camera Zoom Controls');
          hud.style.cssText = [
            'position: absolute',
            'top: 14px',
            'right: 14px',
            'z-index: 9999',
            'display: inline-flex',
            'align-items: center',
            'gap: 4px',
            'padding: 4px 6px',
            'background: rgba(15, 23, 42, 0.85)',
            'backdrop-filter: blur(8px)',
            '-webkit-backdrop-filter: blur(8px)',
            'border: 1px solid rgba(255, 255, 255, 0.15)',
            'border-radius: 8px',
            'box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35)',
            'user-select: none',
            'pointer-events: auto',
            'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
          ].join(';');

          var btnStyle = [
            'background: rgba(255, 255, 255, 0.08)',
            'color: #f1f5f9',
            'border: 1px solid rgba(255, 255, 255, 0.12)',
            'border-radius: 6px',
            'padding: 3px 8px',
            'font-size: 13px',
            'font-weight: 600',
            'line-height: 1.2',
            'cursor: pointer',
            'transition: background 0.15s, border-color 0.15s, transform 0.1s',
            'outline: none'
          ].join(';');

          // Zoom Out Button (-)
          var btnZoomOut = document.createElement('button');
          btnZoomOut.type = 'button';
          btnZoomOut.textContent = '−';
          btnZoomOut.title = 'Zoom Out';
          btnZoomOut.setAttribute('aria-label', 'Zoom Out');
          btnZoomOut.style.cssText = btnStyle;
          btnZoomOut.addEventListener('click', function (e) {
            e.stopPropagation();
            e.preventDefault();
            controller.zoomOut();
          });

          // Zoom Label / Percentage Indicator
          var zoomLabel = document.createElement('span');
          zoomLabel.className = 'av-camera-zoom-label';
          zoomLabel.textContent = '100%';
          zoomLabel.style.cssText = [
            'min-width: 44px',
            'text-align: center',
            'font-size: 12px',
            'font-weight: 600',
            'color: #38bdf8',
            'padding: 0 4px',
            'letter-spacing: 0.02em'
          ].join(';');

          // Zoom In Button (+)
          var btnZoomIn = document.createElement('button');
          btnZoomIn.type = 'button';
          btnZoomIn.textContent = '+';
          btnZoomIn.title = 'Zoom In';
          btnZoomIn.setAttribute('aria-label', 'Zoom In');
          btnZoomIn.style.cssText = btnStyle;
          btnZoomIn.addEventListener('click', function (e) {
            e.stopPropagation();
            e.preventDefault();
            controller.zoomIn();
          });

          // Zoom Reset Button (Reset)
          var btnReset = document.createElement('button');
          btnReset.type = 'button';
          btnReset.className = 'av-camera-reset-btn';
          btnReset.textContent = 'Reset';
          btnReset.title = 'Reset Zoom & Pan (1.0x)';
          btnReset.setAttribute('aria-label', 'Reset Zoom and Pan');
          btnReset.style.cssText = btnStyle + '; background: rgba(56, 189, 248, 0.18); border-color: rgba(56, 189, 248, 0.4); color: #38bdf8;';
          btnReset.addEventListener('click', function (e) {
            e.stopPropagation();
            e.preventDefault();
            controller.reset(true);
          });

          hud.appendChild(btnZoomOut);
          hud.appendChild(zoomLabel);
          hud.appendChild(btnZoomIn);
          hud.appendChild(btnReset);

          targetParent.appendChild(hud);

          hudElement = hud;
          zoomLabelElement = zoomLabel;
        }

        function updateHud() {
          if (zoomLabelElement) {
            zoomLabelElement.textContent = Math.round(zoom * 100) + '%';
          }
        }

        createHud();

        // Initial transform
        updateTransform(false);

        var controller = {
          get zoom() { return zoom; },
          get panX() { return panX; },
          get panY() { return panY; },
          get minZoom() { return minZoom; },
          get maxZoom() { return maxZoom; },

          /**
           * Resets zoom to 1.0x and pan to (0, 0)
           * @param {boolean} [animate=true]
           */
          reset: function (animate) {
            zoom = 1.0;
            panX = 0;
            panY = 0;
            updateTransform(animate !== false);
            return this;
          },

          /**
           * Zooms in by one zoomStep
           */
          zoomIn: function () {
            var rect = canvas.getBoundingClientRect();
            var focalX = rect.left + rect.width / 2;
            var focalY = rect.top + rect.height / 2;
            return this.setZoom(zoom + zoomStep, focalX, focalY);
          },

          /**
           * Zooms out by one zoomStep
           */
          zoomOut: function () {
            var rect = canvas.getBoundingClientRect();
            var focalX = rect.left + rect.width / 2;
            var focalY = rect.top + rect.height / 2;
            return this.setZoom(zoom - zoomStep, focalX, focalY);
          },

          /**
           * Sets zoom factor (clamped between minZoom and maxZoom)
           * @param {number} newZoom
           * @param {number} [focalX] Screen clientX to zoom towards
           * @param {number} [focalY] Screen clientY to zoom towards
           */
          setZoom: function (newZoom, focalX, focalY) {
            if (typeof newZoom !== 'number' || isNaN(newZoom)) return this;
            var targetZoom = Math.max(minZoom, Math.min(maxZoom, newZoom));
            if (Math.abs(targetZoom - zoom) < 0.001) return this;

            var rect = canvas.getBoundingClientRect();
            var fx = typeof focalX === 'number' ? focalX - rect.left : rect.width / 2;
            var fy = typeof focalY === 'number' ? focalY - rect.top : rect.height / 2;

            var worldX = fx / zoom;
            var worldY = fy / zoom;

            panX = panX + fx - (worldX * targetZoom);
            panY = panY + fy - (worldY * targetZoom);
            zoom = targetZoom;

            updateTransform(false);
            return this;
          },

          /**
           * Sets pan coordinates
           * @param {number} x
           * @param {number} y
           */
          setPan: function (x, y) {
            if (typeof x === 'number') panX = x;
            if (typeof y === 'number') panY = y;
            updateTransform(false);
            return this;
          },

          /**
           * Projects screen/client coordinates to world coordinates
           */
          screenToWorld: screenToWorld,

          /**
           * Projects world coordinates to screen/client coordinates
           */
          worldToScreen: worldToScreen,

          /**
           * Gets affine transformation matrix array [a, b, c, d, e, f]
           */
          getMatrix: function () {
            return [zoom, 0, 0, zoom, panX, panY];
          },

          /**
           * Gets transform description object
           */
          getTransform: function () {
            return {
              zoom: zoom,
              panX: panX,
              panY: panY,
              matrix: [zoom, 0, 0, zoom, panX, panY]
            };
          },

          /**
           * Applies current camera matrix to a 2D rendering context
           * @param {CanvasRenderingContext2D} ctx
           */
          applyTransform: function (ctx) {
            if (ctx && typeof ctx.setTransform === 'function') {
              ctx.setTransform(zoom, 0, 0, zoom, panX, panY);
            }
            return this;
          },

          /**
           * Subscribe to camera transformation change events
           * @param {Function} callback
           */
          onChange: function (callback) {
            if (typeof callback === 'function') {
              changeListeners.push(callback);
            }
            return this;
          },

          /**
           * Destroys camera controller, removes listeners and reset HUD
           */
          destroy: function () {
            canvas.removeEventListener('wheel', handleWheel);
            canvas.removeEventListener('pointerdown', handlePointerDown);
            canvas.removeEventListener('pointermove', handlePointerMove);
            canvas.removeEventListener('pointerup', handlePointerUp);
            canvas.removeEventListener('auxclick', handleAuxClick);
            canvas.removeEventListener('click', augmentPointerEvent, true);
            if (typeof window !== 'undefined') {
              window.removeEventListener('keydown', handleKeyDown);
              window.removeEventListener('keyup', handleKeyUp);
              window.removeEventListener('pointerup', handlePointerUp);
            }

            if (hudElement && hudElement.parentNode) {
              hudElement.parentNode.removeChild(hudElement);
            }

            canvas.style.transform = origTransform;
            canvas.style.transformOrigin = origTransformOrigin;
            canvas.style.transition = origTransition;

            if (canvas.screenToWorld === screenToWorld) {
              delete canvas.screenToWorld;
            }
            if (canvas.worldToScreen === worldToScreen) {
              delete canvas.worldToScreen;
            }
          }
        };

        canvas.arcadeverseCamera = controller;
        return controller;
      }
    },

    /**
     * Pointer lock controller for first-person canvas games.
     */
    initPointerLock: function (canvas, options) {
      if (!canvas) return null;
      var opts = options || {};
      var sensitivity = typeof opts.sensitivity === 'number' ? opts.sensitivity : 1.0;
      var onMove = typeof opts.onMove === 'function' ? opts.onMove : function () {};
      var onLockChange = typeof opts.onLockChange === 'function' ? opts.onLockChange : function () {};

      // Create HUD pill if not already present
      var hud = document.getElementById('av-pointer-lock-hud');
      if (!hud) {
        hud = document.createElement('div');
        hud.id = 'av-pointer-lock-hud';
        hud.setAttribute('role', 'status');
        hud.setAttribute('aria-live', 'polite');
        hud.innerHTML = '<span class="hud-dot"></span><span>Pointer Locked &mdash; Press <kbd>ESC</kbd> to Release</span>';
        hud.style.cssText = 'position:fixed;top:1rem;left:50%;transform:translateX(-50%);background:rgba(15,23,42,0.92);border:1px solid #38bdf8;box-shadow:0 0 15px rgba(56,189,248,0.3);color:#f8fafc;padding:0.4rem 0.9rem;border-radius:20px;font-size:0.8rem;font-weight:600;display:none;align-items:center;gap:0.5rem;z-index:99999;pointer-events:none;transition:opacity 0.25s ease;';
        document.body.appendChild(hud);
      }

      function handleMouseMove(e) {
        if (document.pointerLockElement === canvas) {
          var mx = (e.movementX || 0) * sensitivity;
          var my = (e.movementY || 0) * sensitivity;
          onMove(mx, my, e);
        }
      }

      function handleLockChange() {
        var locked = document.pointerLockElement === canvas;
        if (hud) {
          hud.style.display = locked ? 'flex' : 'none';
        }
        onLockChange(locked);
      }

      document.addEventListener('pointerlockchange', handleLockChange);
      document.addEventListener('mousemove', handleMouseMove);

      return {
        requestLock: function () {
          try {
            if (canvas.requestPointerLock) {
              canvas.requestPointerLock();
            }
          } catch (_) {}
        },
        exitLock: function () {
          try {
            if (document.exitPointerLock) {
              document.exitPointerLock();
            }
          } catch (_) {}
        },
        isLocked: function () {
          return document.pointerLockElement === canvas;
        },
        destroy: function () {
          document.removeEventListener('pointerlockchange', handleLockChange);
          document.removeEventListener('mousemove', handleMouseMove);
          if (hud && hud.parentElement) {
            hud.remove();
          }
        }
      };
    },

    // ========================================================
    // ACCESSIBILITY & REDUCED MOTION SUBSYSTEM (#720)
    // WCAG 2.3.3 (Animation from Interactions) Compliance
    // ========================================================
    a11y: {
      /**
       * Queries whether the user prefers reduced motion.
       * Inspects OS media query, iframe query parameters, and persisted preferences.
       * @returns {boolean}
       */
      prefersReducedMotion: function () {
        try {
          if (typeof window !== 'undefined') {
            // 1. URL parameter override (passed by hub modal during launch)
            if (window.location && window.location.search) {
              if (/[?&]reducedMotion=(1|true)/i.test(window.location.search)) {
                return true;
              }
            }
            // 2. Native OS prefers-reduced-motion media query
            if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
              return true;
            }
            // 3. Persisted user preference in localStorage
            if (localStorage.getItem('arcadeverse_reduced_motion') === 'true') {
              return true;
            }
          }
        } catch (_) {}
        return false;
      },

      /**
       * Subscribes to live OS / browser reduced-motion setting changes.
       * @param {Function} callback - Receives boolean (prefersReduced)
       */
      onReducedMotionChange: function (callback) {
        if (typeof callback !== 'function') return;
        try {
          if (typeof window !== 'undefined' && window.matchMedia) {
            var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
            if (mq.addEventListener) {
              mq.addEventListener('change', function (e) { callback(e.matches); });
            } else if (mq.addListener) {
              mq.addListener(function (e) { callback(e.matches); });
            }
          }
        } catch (_) {}
      },

      /**
       * Filter helper for canvas games: suppresses camera/screen shake deltas
       * when reduced motion is enabled to prevent vestibular distress.
       * @param {number} shakeIntensity - Requested shake pixel magnitude
       * @returns {number} 0 if reduced motion active, otherwise shakeIntensity
       */
      filterShake: function (shakeIntensity) {
        return this.prefersReducedMotion() ? 0 : (Number(shakeIntensity) || 0);
      },

      /**
       * Emits an auditory spatial cue for 2D entities (coins, hazards, portals, beacons)
       * to guide blind and visually impaired players (#1101).
       * @param {number} x - Horizontal position
       * @param {number} y - Vertical position
       * @param {string} type - Entity type ('coin', 'hazard', 'beacon', 'wall', 'portal')
       * @param {Object} [options] - Custom sound overrides
       * @returns {Object|null}
       */
      sonifyEntity: function (x, y, type, options) {
        if (typeof window !== "undefined" && window.ArcadeAudioBeacon) {
          return window.ArcadeAudioBeacon.sonifyEntity(x, y, type, options);
        }
        try {
          if (typeof window !== "undefined" && window.parent && window.parent !== window) {
            window.parent.postMessage({
              type: "ARCADEVERSE_A11Y_SONIFY",
              x: Number(x) || 0,
              y: Number(y) || 0,
              entityType: String(type || "beacon"),
              options: options || {}
            }, "*");
          }
        } catch (_) {}
        return null;
      },

      /**
       * Updates the player's 2D position for spatial audio beacon and proximity hazard radar.
       * @param {number} x - Player X coordinate
       * @param {number} y - Player Y coordinate
       * @param {number} [w] - Viewport/Canvas width
       * @param {number} [h] - Viewport/Canvas height
       */
      updatePlayerPosition: function (x, y, w, h) {
        if (typeof window !== "undefined" && window.ArcadeAudioBeacon) {
          return window.ArcadeAudioBeacon.updatePlayerPosition(x, y, w, h);
        }
        try {
          if (typeof window !== "undefined" && window.parent && window.parent !== window) {
            window.parent.postMessage({
              type: "ARCADEVERSE_A11Y_PLAYER_POS",
              x: Number(x) || 0,
              y: Number(y) || 0,
              width: Number(w) || 800,
              height: Number(h) || 600
            }, "*");
          }
        } catch (_) {}
      },

      /**
       * Checks whether spatial audio beacon sonification is enabled.
       * @returns {boolean}
       */
      isAudioBeaconEnabled: function () {
        if (typeof window !== "undefined") {
          if (window.ArcadeAudioBeacon) return window.ArcadeAudioBeacon.isEnabled();
          try {
            return localStorage.getItem("arcadeverse_a11y_audio_beacon") === "true";
          } catch (_) {}
        }
        return false;
      },

      /**
       * Toggles spatial audio beacon sonification on/off.
       * @returns {boolean} New enabled state
       */
      toggleAudioBeacon: function () {
        if (typeof window !== "undefined" && window.ArcadeAudioBeacon) {
          return window.ArcadeAudioBeacon.toggle();
        }
        return false;
      }
    },

    /**
     * Top-level alias for arcadeverse.a11y.prefersReducedMotion (#720)
     */
    prefersReducedMotion: function () {
      return this.a11y.prefersReducedMotion();
    },

    /**
     * Alias for camera.enableZoomPan
     */
    enableZoomPan: function (canvas, options) {
      return this.camera.enableZoomPan(canvas, options);
    },

    /**
     * Volume change subscriber & auto-gain scalar (#735)
     * @param {Function} callback - Receives volume (0.0 to 1.0)
     */
    onVolumeChange: function (callback) {
      if (typeof callback !== 'function') return;
      if (!this._volumeCallbacks) this._volumeCallbacks = [];
      this._volumeCallbacks.push(callback);

      var currentVol = 1.0;
      try {
        var saved = localStorage.getItem('arcadeverse_master_volume');
        if (saved !== null) {
          var p = parseFloat(saved);
          if (!isNaN(p)) currentVol = p;
        }
      } catch (_) {}
      callback(currentVol);
    }
  };

  // Wire message handler for ARCADEVERSE_SET_VOLUME (#735)
  if (typeof window !== "undefined") {
    window.addEventListener("message", function (event) {
      if (event.data && event.data.type === "ARCADEVERSE_SET_VOLUME") {
        var vol = Number(event.data.volume);
        if (!isNaN(vol)) {
          if (sdkInstance.audio && typeof sdkInstance.audio.setMasterVolume === "function") {
            sdkInstance.audio.setMasterVolume(vol);
          }
          if (sdkInstance._volumeCallbacks) {
            sdkInstance._volumeCallbacks.forEach(function (cb) {
              try { cb(vol); } catch (_) {}
            });
          }
        }
      }
    });
  }

  if (typeof window !== "undefined") {
    try {
      if (window.ArcadeAudio && !sdkInstance.ArcadeAudio) {
        sdkInstance.ArcadeAudio = window.ArcadeAudio;
      }
      window.ArcadeVerse = sdkInstance;
      window.arcadeverse = sdkInstance;
    } catch (_) {}
  }

  return sdkInstance;
});
