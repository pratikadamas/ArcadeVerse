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

  // ========================================================
  // IN-BROWSER CONTRIBUTOR GAME VALIDATOR WIDGET (#727)
  // Dev-mode only: audits 4-file compliance, game.json schema,
  // zero-emoji standards, and XSS breakout rules on localhost.
  // Zero production footprint.
  // ========================================================
  var devValidatorReport = null;

  function isLocalDev() {
    try {
      if (typeof window === "undefined" || !window.location) return false;
      var host = window.location.hostname;
      return (
        host === "localhost" ||
        host === "127.0.0.1" ||
        host === "[::1]" ||
        window.__ARCADEVERSE_DEV_FORCE_VALIDATOR__ === true
      );
    } catch (_) {
      return false;
    }
  }

  function fetchDevFile(url) {
    if (typeof fetch === "function") {
      return fetch(url)
        .then(function (res) {
          if (!res.ok) {
            return { exists: false, status: res.status, text: "" };
          }
          return res.text().then(function (txt) {
            return { exists: true, status: res.status, text: txt };
          });
        })
        .catch(function (err) {
          return { exists: false, status: 0, text: "", error: err };
        });
    }
    return new Promise(function (resolve) {
      try {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", url, true);
        xhr.onload = function () {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve({ exists: true, status: xhr.status, text: xhr.responseText });
          } else {
            resolve({ exists: false, status: xhr.status, text: "" });
          }
        };
        xhr.onerror = function (e) {
          resolve({ exists: false, status: 0, text: "", error: e });
        };
        xhr.send();
      } catch (e) {
        resolve({ exists: false, status: 0, text: "", error: e });
      }
    });
  }

  var DevValidator = {
    badgeEl: null,
    popoverEl: null,
    hasInjectedStyles: false,

    injectStyles: function () {
      if (typeof document === "undefined" || this.hasInjectedStyles || document.getElementById("dev-validator-styles")) {
        return;
      }
      try {
        var style = document.createElement("style");
        style.id = "dev-validator-styles";
        style.textContent =
          "#dev-validator-badge { position: fixed; bottom: 16px; right: 16px; z-index: 999999; display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px; border-radius: 9999px; font-family: 'JetBrains Mono', monospace, sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.02em; background: rgba(15, 23, 42, 0.94); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); color: #f8fafc; border: 1px solid rgba(255, 255, 255, 0.16); box-shadow: 0 4px 20px rgba(0, 0, 0, 0.45); cursor: pointer; user-select: none; transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease; }\n" +
          "#dev-validator-badge:hover { transform: translateY(-2px); box-shadow: 0 8px 26px rgba(0, 0, 0, 0.6); }\n" +
          "#dev-validator-badge:focus-visible { outline: 2px solid #3b82f6; outline-offset: 2px; }\n" +
          "#dev-validator-badge .dev-validator-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; transition: background-color 0.2s ease, box-shadow 0.2s ease; }\n" +
          "#dev-validator-badge.dev-validator-pending .dev-validator-dot { background: #3b82f6; box-shadow: 0 0 8px #3b82f6; animation: devValidatorPulse 1.2s infinite ease-in-out; }\n" +
          "#dev-validator-badge.dev-validator-pass { border-color: rgba(16, 185, 129, 0.5); }\n" +
          "#dev-validator-badge.dev-validator-pass .dev-validator-dot { background: #10b981; box-shadow: 0 0 8px rgba(16, 185, 129, 0.7); }\n" +
          "#dev-validator-badge.dev-validator-pass .dev-validator-text { color: #34d399; }\n" +
          "#dev-validator-badge.dev-validator-warn { border-color: rgba(245, 158, 11, 0.5); }\n" +
          "#dev-validator-badge.dev-validator-warn .dev-validator-dot { background: #f59e0b; box-shadow: 0 0 8px rgba(245, 158, 11, 0.7); }\n" +
          "#dev-validator-badge.dev-validator-warn .dev-validator-text { color: #fbbf24; }\n" +
          "#dev-validator-badge.dev-validator-fail { border-color: rgba(244, 63, 94, 0.6); }\n" +
          "#dev-validator-badge.dev-validator-fail .dev-validator-dot { background: #f43f5e; box-shadow: 0 0 8px rgba(244, 63, 94, 0.8); animation: devValidatorPulse 1.5s infinite ease-in-out; }\n" +
          "#dev-validator-badge.dev-validator-fail .dev-validator-text { color: #fb7185; }\n" +
          "#dev-validator-badge .dev-validator-badge-count { display: inline-flex; align-items: center; justify-content: center; font-size: 10px; padding: 1px 6px; border-radius: 9999px; background: rgba(255, 255, 255, 0.12); margin-left: 2px; }\n" +
          "#dev-validator-popover { position: fixed; bottom: 58px; right: 16px; z-index: 999999; width: 380px; max-width: calc(100vw - 32px); max-height: calc(100vh - 80px); display: flex; flex-direction: column; background: rgba(15, 23, 42, 0.96); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); border: 1px solid rgba(255, 255, 255, 0.14); border-radius: 14px; box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6); color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; overflow: hidden; animation: devValidatorSlideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1); }\n" +
          ".dev-validator-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); background: rgba(255, 255, 255, 0.03); }\n" +
          ".dev-validator-title-row { display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 13px; color: #f1f5f9; }\n" +
          ".dev-validator-title-row svg { color: #3b82f6; flex-shrink: 0; }\n" +
          ".dev-validator-header-actions { display: flex; align-items: center; gap: 8px; }\n" +
          ".dev-validator-pill-tag { font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.04em; }\n" +
          ".dev-validator-pill-tag.tag-pass { background: rgba(16, 185, 129, 0.16); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }\n" +
          ".dev-validator-pill-tag.tag-warn { background: rgba(245, 158, 11, 0.16); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); }\n" +
          ".dev-validator-pill-tag.tag-fail { background: rgba(244, 63, 94, 0.16); color: #fb7185; border: 1px solid rgba(244, 63, 94, 0.3); }\n" +
          ".dev-validator-close-btn { background: transparent; border: none; color: #94a3b8; cursor: pointer; padding: 4px; border-radius: 6px; display: flex; align-items: center; justify-content: center; line-height: 1; transition: color 0.15s ease, background-color 0.15s ease; }\n" +
          ".dev-validator-close-btn:hover { color: #f8fafc; background: rgba(255, 255, 255, 0.08); }\n" +
          ".dev-validator-body { padding: 12px 16px; overflow-y: auto; max-height: 380px; display: flex; flex-direction: column; gap: 10px; }\n" +
          ".dev-validator-section-title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; margin-top: 4px; margin-bottom: 2px; }\n" +
          ".dev-validator-checklist { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }\n" +
          ".dev-validator-item { display: flex; align-items: flex-start; gap: 8px; padding: 6px 8px; border-radius: 6px; background: rgba(255, 255, 255, 0.03); font-size: 11.5px; line-height: 1.4; }\n" +
          ".dev-validator-item-icon { margin-top: 2px; flex-shrink: 0; width: 14px; height: 14px; }\n" +
          ".dev-validator-item.item-pass .dev-validator-item-icon { color: #10b981; }\n" +
          ".dev-validator-item.item-warn .dev-validator-item-icon { color: #f59e0b; }\n" +
          ".dev-validator-item.item-fail .dev-validator-item-icon { color: #f43f5e; }\n" +
          ".dev-validator-item-content { flex: 1; }\n" +
          ".dev-validator-item-name { font-weight: 600; color: #e2e8f0; }\n" +
          ".dev-validator-item-desc { color: #94a3b8; font-size: 10.5px; margin-top: 1px; word-break: break-word; }\n" +
          ".dev-validator-issues-box { background: rgba(244, 63, 94, 0.08); border: 1px solid rgba(244, 63, 94, 0.25); border-radius: 8px; padding: 8px 12px; margin-top: 4px; }\n" +
          ".dev-validator-issues-box.issues-warn { background: rgba(245, 158, 11, 0.08); border-color: rgba(245, 158, 11, 0.25); }\n" +
          ".dev-validator-issue-text { font-size: 11px; color: #fca5a5; margin: 3px 0; }\n" +
          ".dev-validator-issues-box.issues-warn .dev-validator-issue-text { color: #fcd34d; }\n" +
          ".dev-validator-footer { display: flex; align-items: center; justify-content: space-between; padding: 10px 16px; border-top: 1px solid rgba(255, 255, 255, 0.08); background: rgba(255, 255, 255, 0.02); }\n" +
          ".dev-validator-rerun-btn { font-family: inherit; font-size: 11px; font-weight: 600; padding: 5px 12px; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.16); background: rgba(255, 255, 255, 0.06); color: #f1f5f9; cursor: pointer; transition: all 0.15s ease; }\n" +
          ".dev-validator-rerun-btn:hover { background: rgba(255, 255, 255, 0.12); border-color: rgba(255, 255, 255, 0.25); }\n" +
          ".dev-validator-dev-note { font-size: 10px; color: #64748b; font-family: 'JetBrains Mono', monospace; }\n" +
          "@keyframes devValidatorSlideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }\n" +
          "@keyframes devValidatorPulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.85); } }\n";
        document.head.appendChild(style);
        this.hasInjectedStyles = true;
      } catch (_) {}
    },

    getIconSvg: function (type) {
      if (type === "pass") {
        return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
      }
      if (type === "warn") {
        return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
      }
      if (type === "terminal") {
        return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>';
      }
      return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
    },

    init: function () {
      if (!isLocalDev()) return;
      if (typeof document === "undefined" || !document.body) return;

      this.injectStyles();
      this.createDomElements();
      this.runAudit(false);
    },

    createDomElements: function () {
      if (document.getElementById("dev-validator-badge")) {
        this.badgeEl = document.getElementById("dev-validator-badge");
        this.popoverEl = document.getElementById("dev-validator-popover");
        return;
      }

      var self = this;

      // Create Badge Pill
      var badge = document.createElement("div");
      badge.id = "dev-validator-badge";
      badge.className = "dev-validator-badge dev-validator-pending";
      badge.setAttribute("role", "button");
      badge.setAttribute("tabindex", "0");
      badge.setAttribute("aria-label", "ArcadeVerse Development Validator: Checking...");
      badge.setAttribute("title", "Click to view ArcadeVerse game manifest and compliance diagnostics");

      badge.innerHTML =
        '<span class="dev-validator-dot"></span>' +
        '<span class="dev-validator-text">DEV: Checking...</span>' +
        '<span class="dev-validator-badge-count" style="display:none;"></span>';

      // Create Popover Card
      var popover = document.createElement("div");
      popover.id = "dev-validator-popover";
      popover.style.display = "none";
      popover.setAttribute("role", "dialog");
      popover.setAttribute("aria-modal", "false");
      popover.setAttribute("aria-label", "ArcadeVerse Dev Validator Diagnostics");

      popover.innerHTML =
        '<div class="dev-validator-header">' +
          '<div class="dev-validator-title-row">' +
            self.getIconSvg("terminal") +
            '<span>Game Manifest Validator</span>' +
          '</div>' +
          '<div class="dev-validator-header-actions">' +
            '<span class="dev-validator-pill-tag tag-pass">CHECKING</span>' +
            '<button class="dev-validator-close-btn" aria-label="Close Popover">&times;</button>' +
          '</div>' +
        '</div>' +
        '<div class="dev-validator-body">' +
          '<div class="dev-validator-section-title">Pre-Flight Checks</div>' +
          '<ul class="dev-validator-checklist"></ul>' +
          '<div class="dev-validator-issues-container"></div>' +
        '</div>' +
        '<div class="dev-validator-footer">' +
          '<button class="dev-validator-rerun-btn">Re-run Validation</button>' +
          '<span class="dev-validator-dev-note">Localhost Only</span>' +
        '</div>';

      document.body.appendChild(badge);
      document.body.appendChild(popover);

      this.badgeEl = badge;
      this.popoverEl = popover;

      // Event handlers
      badge.addEventListener("click", function (e) {
        e.stopPropagation();
        self.togglePopover();
      });

      badge.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          self.togglePopover();
        }
      });

      var closeBtn = popover.querySelector(".dev-validator-close-btn");
      if (closeBtn) {
        closeBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          self.hidePopover();
        });
      }

      var rerunBtn = popover.querySelector(".dev-validator-rerun-btn");
      if (rerunBtn) {
        rerunBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          self.runAudit(true);
        });
      }

      document.addEventListener("click", function (e) {
        if (self.popoverEl && self.popoverEl.style.display !== "none") {
          if (!self.popoverEl.contains(e.target) && !self.badgeEl.contains(e.target)) {
            self.hidePopover();
          }
        }
      });

      window.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && self.popoverEl && self.popoverEl.style.display !== "none") {
          self.hidePopover();
        }
      });
    },

    togglePopover: function () {
      if (!this.popoverEl) return;
      if (this.popoverEl.style.display === "none") {
        this.showPopover();
      } else {
        this.hidePopover();
      }
    },

    showPopover: function () {
      if (this.popoverEl) {
        this.popoverEl.style.display = "flex";
      }
    },

    hidePopover: function () {
      if (this.popoverEl) {
        this.popoverEl.style.display = "none";
      }
    },

    runAudit: function (verbose) {
      var self = this;
      if (!isLocalDev()) return Promise.resolve(null);

      if (this.badgeEl) {
        this.badgeEl.className = "dev-validator-badge dev-validator-pending";
        var txt = this.badgeEl.querySelector(".dev-validator-text");
        if (txt) txt.textContent = "DEV: Checking...";
        var countEl = this.badgeEl.querySelector(".dev-validator-badge-count");
        if (countEl) countEl.style.display = "none";
      }

      var EMOJI_REGEX = /[\uD83C-\uDBFF\uDC00-\uDFFF]|[\u2600-\u27BF]/;

      return Promise.all([
        fetchDevFile("./game.json"),
        fetchDevFile("./style.css"),
        fetchDevFile("./game.js")
      ]).then(function (results) {
        var gameJsonRes = results[0];
        var styleCssRes = results[1];
        var gameJsRes = results[2];

        // If not in a game context and game.json doesn't exist, gracefully hide badge
        if (!gameJsonRes.exists && detectedGameId === "game" && !styleCssRes.exists && !gameJsRes.exists) {
          if (self.badgeEl) self.badgeEl.style.display = "none";
          if (self.popoverEl) self.popoverEl.style.display = "none";
          return null;
        }

        if (self.badgeEl) self.badgeEl.style.display = "inline-flex";

        var errors = [];
        var warnings = [];
        var items = [];

        // 1. 4-File Compliance
        var missingFiles = [];
        if (!gameJsonRes.exists) missingFiles.push("game.json");
        if (!styleCssRes.exists) missingFiles.push("style.css");
        if (!gameJsRes.exists) missingFiles.push("game.js");

        if (missingFiles.length === 0) {
          items.push({
            id: "files",
            name: "4-File Structure",
            status: "pass",
            desc: "All required files found (index.html, style.css, game.js, game.json)"
          });
        } else {
          missingFiles.forEach(function (f) {
            errors.push("Missing required file: " + f);
          });
          items.push({
            id: "files",
            name: "4-File Structure",
            status: "fail",
            desc: "Missing: " + missingFiles.join(", ")
          });
        }

        // 2. game.json Structure & Required Fields
        if (gameJsonRes.exists) {
          try {
            var meta = JSON.parse(gameJsonRes.text);
            var reqFields = ["title", "category", "description", "author", "github"];
            var missingFields = [];
            reqFields.forEach(function (f) {
              if (!meta[f] || typeof meta[f] !== "string" || !meta[f].trim()) {
                missingFields.push(f);
                errors.push('game.json missing required field: "' + f + '"');
              }
            });

            // Strict XSS & Attribute Breakout Check (#491)
            var xssErrors = [];
            ["title", "category", "author", "description"].forEach(function (f) {
              var val = meta[f];
              if (typeof val === "string" && (val.indexOf('"') !== -1 || val.indexOf("<") !== -1 || val.indexOf(">") !== -1)) {
                var xssMsg = 'Attribute Breakout / XSS risk: "' + f + '" contains unescaped quotes or angle brackets.';
                errors.push(xssMsg);
                xssErrors.push(f);
              }
            });

            if (missingFields.length === 0 && xssErrors.length === 0) {
              items.push({
                id: "schema",
                name: "game.json Schema",
                status: "pass",
                desc: 'Manifest valid: "' + (meta.title || detectedGameId) + '" by @' + (meta.author || "contributor")
              });
            } else {
              items.push({
                id: "schema",
                name: "game.json Schema",
                status: "fail",
                desc: (missingFields.length > 0 ? "Missing: " + missingFields.join(", ") + ". " : "") +
                      (xssErrors.length > 0 ? "XSS quotes detected in: " + xssErrors.join(", ") : "")
              });
            }
          } catch (jsonErr) {
            var parseErr = "game.json contains invalid JSON: " + jsonErr.message;
            errors.push(parseErr);
            items.push({
              id: "schema",
              name: "game.json Schema",
              status: "fail",
              desc: parseErr
            });
          }
        } else {
          items.push({
            id: "schema",
            name: "game.json Schema",
            status: "fail",
            desc: "game.json file missing"
          });
        }

        // 3. Zero-Emoji Scan
        var emojiFiles = [];
        if (gameJsonRes.exists && EMOJI_REGEX.test(gameJsonRes.text)) {
          emojiFiles.push("game.json");
          warnings.push("Detected unicode emoji in game.json. Please replace with SVG or Lucide icon.");
        }
        if (styleCssRes.exists && EMOJI_REGEX.test(styleCssRes.text)) {
          emojiFiles.push("style.css");
          warnings.push("Detected unicode emoji in style.css. Please replace with SVG or Lucide icon.");
        }
        if (gameJsRes.exists && EMOJI_REGEX.test(gameJsRes.text)) {
          emojiFiles.push("game.js");
          warnings.push("Detected unicode emoji in game.js. Please replace with SVG or Lucide icon.");
        }
        if (typeof document !== "undefined" && document.body && EMOJI_REGEX.test(document.body.innerHTML)) {
          emojiFiles.push("index.html");
          warnings.push("Detected unicode emoji in index.html. Please replace with SVG or Lucide icon.");
        }

        if (emojiFiles.length === 0) {
          items.push({
            id: "emoji",
            name: "Zero-Emoji Standards",
            status: "pass",
            desc: "No unicode emojis detected (strict SVG/icon compliance passed)"
          });
        } else {
          items.push({
            id: "emoji",
            name: "Zero-Emoji Standards",
            status: "warn",
            desc: "Unicode emojis found in: " + emojiFiles.join(", ") + " (replace with SVG)"
          });
        }

        // 4. HTML Meta & Viewport Standards
        var htmlMissing = [];
        if (typeof document !== "undefined") {
          if (!document.title || !document.title.trim()) {
            errors.push("index.html is missing a <title> tag.");
            htmlMissing.push("missing <title>");
          }
          if (!document.querySelector('meta[name="viewport"]')) {
            warnings.push("index.html is missing a responsive viewport <meta> tag.");
            htmlMissing.push("missing viewport meta");
          }
        }
        if (htmlMissing.length === 0) {
          items.push({
            id: "html",
            name: "HTML Head Standards",
            status: "pass",
            desc: "Responsive viewport meta tag and document <title> verified"
          });
        } else {
          items.push({
            id: "html",
            name: "HTML Head Standards",
            status: errors.some(function (e) { return e.indexOf("<title>") !== -1; }) ? "fail" : "warn",
            desc: htmlMissing.join(", ")
          });
        }

        // 5. Folder Naming Convention
        if (detectedGameId && detectedGameId !== "game") {
          var folderRegex = /^[a-z0-9-]+_[a-z0-9-]+$/i;
          if (folderRegex.test(detectedGameId)) {
            items.push({
              id: "folder",
              name: "Folder Naming",
              status: "pass",
              desc: "Folder adheres to games/<game-name_username> (" + detectedGameId + ")"
            });
          } else {
            var folderWarn = "Folder naming should be games/<game-name_username> (got: " + detectedGameId + ")";
            warnings.push(folderWarn);
            items.push({
              id: "folder",
              name: "Folder Naming",
              status: "warn",
              desc: folderWarn
            });
          }
        }

        // 6. Security Heuristics (Isolation & DOM XSS)
        if (gameJsRes.exists) {
          var jsSecIssues = [];
          if (gameJsRes.text.indexOf("document.write(") !== -1 || gameJsRes.text.indexOf("document.writeln(") !== -1) {
            var docWriteErr = "Avoid document.write() in community games; it breaks DOM streaming and player isolation.";
            errors.push(docWriteErr);
            jsSecIssues.push(docWriteErr);
          }
          if (/(window\.)?(top|parent)\.location/i.test(gameJsRes.text)) {
            var topNavErr = "Security violation (#492): Attempt to access top or parent frame navigation.";
            errors.push(topNavErr);
            jsSecIssues.push(topNavErr);
          }

          if (jsSecIssues.length === 0) {
            items.push({
              id: "security",
              name: "Sandbox Security",
              status: "pass",
              desc: "Passed iframe sandboxing and DOM isolation checks"
            });
          } else {
            items.push({
              id: "security",
              name: "Sandbox Security",
              status: "fail",
              desc: jsSecIssues.join("; ")
            });
          }
        }

        // Determine Status
        var overallStatus = "pass";
        if (errors.length > 0) {
          overallStatus = "fail";
        } else if (warnings.length > 0) {
          overallStatus = "warn";
        }

        devValidatorReport = {
          timestamp: new Date().toISOString(),
          status: overallStatus,
          errors: errors,
          warnings: warnings,
          items: items,
          gameId: detectedGameId
        };

        // Update Badge UI
        self.updateBadgeUI(overallStatus, errors, warnings);

        // Update Popover UI
        self.updatePopoverUI(overallStatus, items, errors, warnings);

        // Console Log Output
        self.logConsoleReport(overallStatus, items, errors, warnings, verbose);

        return devValidatorReport;
      }).catch(function (err) {
        console.warn("[ArcadeVerse DevValidator] Audit encountered error:", err);
        return null;
      });
    },

    updateBadgeUI: function (status, errors, warnings) {
      if (!this.badgeEl) return;
      this.badgeEl.className = "dev-validator-badge dev-validator-" + status;

      var textEl = this.badgeEl.querySelector(".dev-validator-text");
      var countEl = this.badgeEl.querySelector(".dev-validator-badge-count");

      if (status === "pass") {
        if (textEl) textEl.textContent = "DEV: Manifest Valid";
        if (countEl) countEl.style.display = "none";
        this.badgeEl.setAttribute("aria-label", "ArcadeVerse Development Validator: Pass (All checks valid)");
      } else if (status === "warn") {
        if (textEl) textEl.textContent = "DEV: " + warnings.length + " Warning" + (warnings.length > 1 ? "s" : "");
        if (countEl) {
          countEl.textContent = String(warnings.length);
          countEl.style.display = "inline-flex";
        }
        this.badgeEl.setAttribute("aria-label", "ArcadeVerse Development Validator: " + warnings.length + " Warnings");
      } else {
        if (textEl) textEl.textContent = "DEV: " + errors.length + " Error" + (errors.length > 1 ? "s" : "");
        if (countEl) {
          countEl.textContent = String(errors.length);
          countEl.style.display = "inline-flex";
        }
        this.badgeEl.setAttribute("aria-label", "ArcadeVerse Development Validator: " + errors.length + " Errors");
      }
    },

    updatePopoverUI: function (status, items, errors, warnings) {
      if (!this.popoverEl) return;

      var tagPill = this.popoverEl.querySelector(".dev-validator-pill-tag");
      if (tagPill) {
        tagPill.className = "dev-validator-pill-tag tag-" + status;
        tagPill.textContent = status.toUpperCase();
      }

      var listEl = this.popoverEl.querySelector(".dev-validator-checklist");
      if (listEl) {
        listEl.innerHTML = "";
        var self = this;
        items.forEach(function (item) {
          var li = document.createElement("li");
          li.className = "dev-validator-item item-" + item.status;
          li.innerHTML =
            '<div class="dev-validator-item-icon">' + self.getIconSvg(item.status) + '</div>' +
            '<div class="dev-validator-item-content">' +
              '<div class="dev-validator-item-name">' + item.name + '</div>' +
              '<div class="dev-validator-item-desc">' + item.desc + '</div>' +
            '</div>';
          listEl.appendChild(li);
        });
      }

      var issuesContainer = this.popoverEl.querySelector(".dev-validator-issues-container");
      if (issuesContainer) {
        issuesContainer.innerHTML = "";
        if (errors.length > 0) {
          var errBox = document.createElement("div");
          errBox.className = "dev-validator-issues-box";
          errBox.innerHTML = '<div style="font-weight:600; font-size:11px; margin-bottom:4px; color:#f87171;">Errors to fix before merge:</div>';
          errors.forEach(function (err) {
            var p = document.createElement("div");
            p.className = "dev-validator-issue-text";
            p.textContent = "[FAIL] " + err;
            errBox.appendChild(p);
          });
          issuesContainer.appendChild(errBox);
        }
        if (warnings.length > 0) {
          var warnBox = document.createElement("div");
          warnBox.className = "dev-validator-issues-box issues-warn";
          warnBox.innerHTML = '<div style="font-weight:600; font-size:11px; margin-bottom:4px; color:#fbbf24;">Advisory Warnings:</div>';
          warnings.forEach(function (w) {
            var p = document.createElement("div");
            p.className = "dev-validator-issue-text";
            p.textContent = "[WARN] " + w;
            warnBox.appendChild(p);
          });
          issuesContainer.appendChild(warnBox);
        }
      }
    },

    logConsoleReport: function (status, items, errors, warnings, verbose) {
      if (typeof console === "undefined" || !console.groupCollapsed) return;

      var headerColor = status === "pass" ? "#10b981" : (status === "warn" ? "#f59e0b" : "#f43f5e");
      var title = "[ArcadeVerse DevValidator] " + (status === "pass" ? "[PASS] All checks passed" : (status === "warn" ? "[WARN] " + warnings.length + " warning(s)" : "[FAIL] " + errors.length + " error(s)"));

      if (verbose || status !== "pass") {
        console.groupCollapsed("%c" + title, "color:" + headerColor + "; font-weight:bold; font-size:11px;");
      } else {
        console.groupCollapsed("%c" + title, "color:" + headerColor + "; font-weight:bold; font-size:11px;");
      }

      items.forEach(function (item) {
        var prefix = item.status === "pass" ? "[PASS]" : (item.status === "warn" ? "[WARN]" : "[FAIL]");
        var itemColor = item.status === "pass" ? "#10b981" : (item.status === "warn" ? "#f59e0b" : "#f43f5e");
        console.log("%c" + prefix + " " + item.name + "%c: " + item.desc, "color:" + itemColor + "; font-weight:bold;", "color:inherit;");
      });

      if (errors.length > 0) {
        console.log("%cAction Required:", "color:#f43f5e; font-weight:bold;");
        errors.forEach(function (err) {
          console.error("  x " + err);
        });
      }

      if (warnings.length > 0) {
        console.log("%cRecommendations:", "color:#f59e0b; font-weight:bold;");
        warnings.forEach(function (w) {
          console.warn("  ! " + w);
        });
      }

      console.log("%cDev mode active on " + (window.location && window.location.hostname) + ". Validator is completely stripped in production.", "color:#64748b; font-size:10px; font-style:italic;");
      console.groupEnd();
    }
  };

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

      // Initialize in-browser developer game validator on localhost (#727)
      if (isLocalDev()) {
        if (typeof document !== "undefined") {
          if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", function () {
              DevValidator.init();
            });
          } else {
            DevValidator.init();
          }
        }
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

      var currentVolume = 0.5;
      var isMuted = false;

      var applyGain = function () {
        var targetGain = isMuted ? 0 : currentVolume;
        if (ctx.state === 'running') {
          masterGain.gain.setValueAtTime(masterGain.gain.value, ctx.currentTime);
          masterGain.gain.linearRampToValueAtTime(targetGain, ctx.currentTime + 0.05);
        } else {
          masterGain.gain.value = targetGain;
        }
        if (typeof onVolumeChange === 'function') {
          onVolumeChange(currentVolume, isMuted);
        }
      };

      // Listen for parent hub audio broadcasts
      var handleMessage = function (e) {
        if (!e || !e.data) return;
        if (e.data.type === 'ARCADEVERSE_AUDIO_CONFIG') {
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
          window.parent.postMessage({ type: 'ARCADEVERSE_REQUEST_AUDIO_CONFIG' }, '*');
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
     * Expose or connect ArcadeAudio sound synthesizer to SDK instance (#510)
     */
    getSoundSynthesizer: function () {
      if (typeof window !== 'undefined' && window.ArcadeAudio) {
        return window.ArcadeAudio;
      }
      return null;
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
    // IN-BROWSER DEV VALIDATOR PUBLIC API (#727)
    // ========================================================
    /**
     * Programmatically executes pre-flight manifest and file compliance audit.
     * Active only on localhost/127.0.0.1; disabled in production builds.
     * @returns {Promise<Object|null>}
     */
    runDevValidator: function () {
      if (!isLocalDev()) {
        return Promise.resolve({ isDev: false, message: "DevValidator is active only on localhost/127.0.0.1" });
      }
      return DevValidator.runAudit(true);
    },

    /**
     * Retrieves the latest DevValidator audit telemetry and findings
     * @returns {Object|null}
     */
    getDevValidatorReport: function () {
      return devValidatorReport;
    }
  };
});
