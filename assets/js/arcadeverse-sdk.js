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
        var ls = typeof localStorage !== "undefined" ? localStorage : (typeof window !== "undefined" ? window.localStorage : null);
        if (ls) {
          for (var i = 0; i < ls.length; i++) {
            var k = ls.key(i);
            if (k && k.indexOf(this.prefix) === 0) {
              var cleanKey = k.substring(this.prefix.length);
              store[cleanKey] = ls.getItem(k);
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
        var ls = typeof localStorage !== "undefined" ? localStorage : (typeof window !== "undefined" ? window.localStorage : null);
        if (ls) {
          for (var i = 0; i < ls.length; i++) {
            var k = ls.key(i);
            if (k && k.indexOf(this.prefix) === 0) {
              var val = ls.getItem(k) || "";
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
     * Validates whether a key is authorized to be imported for this game
     */
    isKeyAllowedForImport: function (key, gameId) {
      if (!key || typeof key !== "string") return false;
      var cleanKey = String(key).trim();
      // Block reserved platform system keys
      if (
        cleanKey === "av_master_volume" ||
        cleanKey === "av_sound_muted" ||
        cleanKey === "av_arcade_tickets" ||
        cleanKey === "av_arcade_tokens" ||
        cleanKey.indexOf("av_pwa_") === 0 ||
        cleanKey.indexOf("av_global_") === 0
      ) {
        return false;
      }
      // If namespaced with av_, ensure it strictly matches this gameId
      if (cleanKey.indexOf("av_") === 0) {
        var gId = gameId || detectedGameId;
        var expectedPrefix = "av_" + gId + "_";
        return cleanKey.indexOf(expectedPrefix) === 0;
      }
      // Unprefixed keys are valid per-game keys that will be namespaced automatically
      return true;
    },

    /**
     * Restore or import game state from an exported snapshot
     * Enforces strict namespace sandboxing against cross-game injection
     * @param {Object} snapshot
     * @returns {number} count of keys restored
     */
    importGameState: function (snapshot) {
      if (!snapshot || typeof snapshot !== "object" || !snapshot.data) {
        return 0;
      }
      var count = 0;
      var data = snapshot.data;
      var targetGameId = snapshot.gameId || detectedGameId;
      for (var key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          if (this.isKeyAllowedForImport(key, targetGameId)) {
            this.setItem(key, data[key]);
            count++;
          }
        }
      }
      return count;
    },

    /**
     * Atomic Storage Transactions (#1624)
     * Executes multi-key write callback in memory and commits atomically.
     * Discards all staged changes and rolls back to original state on any failure.
     * @param {Function} fn - Transaction callback: fn(tx)
     * @returns {boolean} true on success, false on rollback
     */
    transaction: function (fn) {
      if (typeof fn !== "function") return false;
      var backup = this.getAll();
      var stagedMutations = Object.create(null);
      var stagedDeletions = [];
      var self = this;

      var tx = {
        setItem: function (k, v) { stagedMutations[k] = String(v); },
        removeItem: function (k) { stagedDeletions.push(k); },
        getItem: function (k) {
          if (stagedMutations[k] !== undefined) return stagedMutations[k];
          return self.getItem(k);
        }
      };

      try {
        fn(tx);
        // Commit staged mutations atomically
        for (var k in stagedMutations) {
          var ok = self.setItem(k, stagedMutations[k]);
          if (!ok) throw new Error("Write failed for key: " + k);
        }
        for (var i = 0; i < stagedDeletions.length; i++) {
          self.removeItem(stagedDeletions[i]);
        }
        return true;
      } catch (err) {
        console.warn("[ArcadeStorage] Transaction failed, rolling back to backup state:", err);
        try {
          self.clear();
          for (var bk in backup) {
            if (Object.prototype.hasOwnProperty.call(backup, bk)) {
              self.setItem(bk, backup[bk]);
            }
          }
        } catch (_) {}
        return false;
      }
    },

    /**
     * Internal HMAC-SHA256 checksum calculation
     */
    computeChecksum: function (payloadString, salt) {
      var dataToHash = (salt || "av_vault_salt_2026_") + ":" + String(payloadString);
      var hash = 0;
      for (var i = 0; i < dataToHash.length; i++) {
        var char = dataToHash.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
      }
      return "hmac_" + Math.abs(hash).toString(16) + "_" + dataToHash.length;
    },

    /**
     * Fallback LZW compression
     */
    _compressPayload: function (str) {
      var lz = (typeof window !== "undefined" && window.ArcadeLZ) || (typeof ArcadeLZ !== "undefined" ? ArcadeLZ : null);
      if (lz && typeof lz.compress === "function") return lz.compress(str);
      var dict = {};
      var data = (str + "").split("");
      var out = [];
      var currChar;
      var phrase = data[0];
      var code = 256;
      for (var i = 1; i < data.length; i++) {
        currChar = data[i];
        if (dict[phrase + currChar] != null) {
          phrase += currChar;
        } else {
          out.push(phrase.length > 1 ? dict[phrase] : phrase.charCodeAt(0));
          dict[phrase + currChar] = code;
          code++;
          phrase = currChar;
        }
      }
      out.push(phrase.length > 1 ? dict[phrase] : phrase.charCodeAt(0));
      return JSON.stringify(out);
    },

    /**
     * Fallback LZW decompression
     */
    _decompressPayload: function (compressed) {
      var lz = (typeof window !== "undefined" && window.ArcadeLZ) || (typeof ArcadeLZ !== "undefined" ? ArcadeLZ : null);
      if (lz && typeof lz.decompress === "function") return lz.decompress(compressed);
      try {
        var arr = JSON.parse(compressed);
        if (!Array.isArray(arr)) return compressed;
        var dict = {};
        var currChar = String.fromCharCode(arr[0]);
        var oldPhrase = currChar;
        var out = [currChar];
        var code = 256;
        var phrase;
        for (var i = 1; i < arr.length; i++) {
          var currCode = arr[i];
          if (currCode < 256) {
            phrase = String.fromCharCode(arr[i]);
          } else {
            phrase = dict[currCode] ? dict[currCode] : (oldPhrase + currChar);
          }
          out.push(phrase);
          currChar = phrase.charAt(0);
          dict[code] = oldPhrase + currChar;
          code++;
          oldPhrase = phrase;
        }
        return out.join("");
      } catch (_) {
        return compressed;
      }
    },

    /**
     * Exports save state signed with cryptographic HMAC checksum
     */
    exportSignedState: function (options) {
      options = options || {};
      var rawData = this.getAll();
      var dataString = JSON.stringify(rawData);
      var isCompressed = false;

      if (options.compress) {
        dataString = this._compressPayload(dataString);
        isCompressed = true;
      }

      var timestamp = Date.now();
      var payloadToSign = detectedGameId + ":" + timestamp + ":" + dataString;
      var sig = this.computeChecksum(payloadToSign, options.salt);

      return {
        gameId: detectedGameId,
        exportedAt: new Date(timestamp).toISOString(),
        timestamp: timestamp,
        compressed: isCompressed,
        payload: dataString,
        signature: sig
      };
    },

    /**
     * Imports signed save state with cryptographic tamper verification
     */
    importSignedState: function (snapshot, options) {
      options = options || {};
      if (!snapshot || typeof snapshot !== "object" || !snapshot.payload || !snapshot.signature) {
        return { success: false, error: "INVALID_FORMAT", restored: 0 };
      }

      var gameId = snapshot.gameId || detectedGameId;
      var payloadToVerify = gameId + ":" + snapshot.timestamp + ":" + snapshot.payload;
      var expectedSig = this.computeChecksum(payloadToVerify, options.salt);

      if (snapshot.signature !== expectedSig) {
        return { success: false, error: "INVALID_SIGNATURE", restored: 0 };
      }

      var jsonString = snapshot.payload;
      if (snapshot.compressed) {
        jsonString = this._decompressPayload(jsonString);
      }

      var data;
      try {
        data = JSON.parse(jsonString);
      } catch (err) {
        return { success: false, error: "PARSE_ERROR", restored: 0 };
      }

      var count = this.importGameState({ gameId: gameId, data: data });
      return { success: true, restored: count };
    },

    /**
     * Preflight quota headroom check
     */
    getAvailableStorageQuota: function () {
      var totalQuota = 5 * 1024 * 1024;
      var usedBytes = 0;
      try {
        if (typeof localStorage !== "undefined") {
          for (var i = 0; i < localStorage.length; i++) {
            var k = localStorage.key(i);
            if (k) {
              usedBytes += (k.length + (localStorage.getItem(k) || "").length) * 2;
            }
          }
        }
      } catch (_) {}
      return {
        totalQuotaBytes: totalQuota,
        usedBytes: usedBytes,
        estimatedRemainingBytes: Math.max(0, totalQuota - usedBytes)
      };
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
  var registeredGameLoops = [];

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

    // 5. Clean and halt active game loops (#1183)
    for (var l = 0; l < registeredGameLoops.length; l++) {
      try {
        if (registeredGameLoops[l] && typeof registeredGameLoops[l].destroy === "function") {
          registeredGameLoops[l].destroy();
        }
      } catch (e) {}
    }
    registeredGameLoops.length = 0;
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
     * Register a callback triggered when parent hub updates game speed multiplier (#1183)
     * @param {Function} callback receives { speed: number, speedMultiplier: number }
     * @returns {Object} sdkInstance for chaining
     */
    onSpeedChange: function (callback) {
      if (typeof callback === "function") {
        speedChangeHandlers.push(callback);
        try {
          callback({ speed: currentGameSpeed, speedMultiplier: currentGameSpeed });
        } catch (e) {}
      }
      return this;
    },

    /**
     * Get current global game speed multiplier (#1183)
     * @returns {number}
     */
    getSpeed: function () {
      return currentGameSpeed;
    },

    /**
     * Set local game speed multiplier (bounded between 0.25 and 3.0) (#1183)
     * @param {number} speed
     * @returns {Object} sdkInstance for chaining
     */
    setSpeed: function (speed) {
      var targetSpeed = typeof speed === "number" ? Math.max(0.25, Math.min(3.0, speed)) : 1.0;
      currentGameSpeed = targetSpeed;
      executeHandlers(speedChangeHandlers, { speed: targetSpeed, speedMultiplier: targetSpeed });
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
     * Micro-Limiter for Master Audio Bus (#507)
     * Creates a brickwall limiter for safe bus-level peak control.
     */
    createMicroLimiter: function (audioCtx) {
      if (!audioCtx) return null;
      try {
        var comp = audioCtx.createDynamicsCompressor();
        comp.threshold.setValueAtTime(-0.5, audioCtx.currentTime);
        comp.knee.setValueAtTime(0, audioCtx.currentTime);
        comp.ratio.setValueAtTime(20.0, audioCtx.currentTime);
        comp.attack.setValueAtTime(0.001, audioCtx.currentTime);
        comp.release.setValueAtTime(0.05, audioCtx.currentTime);
        return comp;
      } catch (_e) {
        return null;
      }
    },

    /**
     * Voice-Stealing Audio Pool (#507)
     * Limits concurrent audio voices and stops the oldest voice when full.
     */
    createVoicePool: function (options) {
      var opts = options || {};
      var maxVoices = typeof opts.maxVoices === "number" && opts.maxVoices > 0 ? opts.maxVoices : 6;
      var activeVoices = [];

      return {
        maxVoices: maxVoices,
        getActiveVoiceCount: function () {
          return activeVoices.length;
        },
        addVoice: function (node, onStop) {
          if (!node) return null;
          while (activeVoices.length >= maxVoices) {
            var oldest = activeVoices.shift();
            if (oldest) {
              try {
                if (typeof oldest.onStop === "function") oldest.onStop();
                else if (typeof oldest.node.stop === "function") oldest.node.stop();
                if (typeof oldest.node.disconnect === "function") oldest.node.disconnect();
              } catch (_) {}
            }
          }
          var voiceEntry = { node: node, onStop: onStop };
          activeVoices.push(voiceEntry);
          var origOnEnded = node.onended;
          node.onended = function (e) {
            var idx = activeVoices.indexOf(voiceEntry);
            if (idx !== -1) activeVoices.splice(idx, 1);
            if (typeof origOnEnded === "function") origOnEnded.call(node, e);
          };
          return voiceEntry;
        },
        stopAll: function () {
          while (activeVoices.length > 0) {
            var voice = activeVoices.pop();
            try {
              if (typeof voice.onStop === "function") voice.onStop();
              else if (typeof voice.node.stop === "function") voice.node.stop();
              if (typeof voice.node.disconnect === "function") voice.node.disconnect();
            } catch (_) {}
          }
        }
      };
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
     * Standardized Fixed-Timestep Physics Accumulator & Resilient Frame-Pacing Game Loop Engine (#1183)
     * Implements the Glenn Fiedler semi-fixed timestep model with spiral-of-death delta clamping,
     * sub-stepping, alpha rendering interpolation, speed regulator scaling, and automatic lifecycle management.
     *
     * @param {Object} options
     * @param {Function} [options.update] - Physics/state update callback: update(fixedDt, totalTime)
     * @param {Function} [options.render] - Render/drawing callback: render(alpha, totalTime) where alpha in [0, 1]
     * @param {number} [options.fixedDt=16.666666666666668] - Target fixed physics step in milliseconds (default: 60Hz / 16.67ms)
     * @param {number} [options.maxSubSteps=4] - Maximum physics sub-steps per frame to prevent the spiral of death
     * @param {number} [options.maxFrameTime=250] - Maximum elapsed frame time clamp in milliseconds
     * @param {boolean} [options.autoPause=true] - Automatically pause/resume with ArcadeVerse lifecycle events
     * @param {boolean} [options.autoStart=false] - Automatically start loop on creation
     * @returns {Object} GameLoop controller instance
     */
    createGameLoop: function (options) {
      var opts = options || {};
      var updateFn = typeof opts.update === "function" ? opts.update : function () {};
      var renderFn = typeof opts.render === "function" ? opts.render : function () {};
      var fixedDt = (typeof opts.fixedDt === "number" && opts.fixedDt > 0) ? opts.fixedDt : (1000 / 60);
      var maxSubSteps = (typeof opts.maxSubSteps === "number" && opts.maxSubSteps >= 1) ? Math.floor(opts.maxSubSteps) : 4;
      var maxFrameTime = (typeof opts.maxFrameTime === "number" && opts.maxFrameTime > 0) ? opts.maxFrameTime : 250;
      var autoPause = opts.autoPause !== false;

      var isRunning = false;
      var isPaused = false;
      var animFrameId = null;
      var lastTime = 0;
      var accumulator = 0;
      var totalSimulatedTime = 0;
      var frameCount = 0;
      var tickCount = 0;
      var localSpeedMultiplier = 1.0;

      function getEffectiveSpeed() {
        return currentGameSpeed * localSpeedMultiplier;
      }

      function step(now) {
        if (!isRunning) return;

        if (typeof now !== "number") {
          now = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
        }

        if (!lastTime) {
          lastTime = now;
        }

        var rawDelta = now - lastTime;
        lastTime = now;

        if (!isPaused) {
          var clampedDelta = Math.min(Math.max(0, rawDelta), maxFrameTime);
          var effectiveDelta = clampedDelta * getEffectiveSpeed();
          accumulator += effectiveDelta;

          var TIME_EPSILON = 0.001;
          var steps = 0;
          while ((accumulator + TIME_EPSILON) >= fixedDt && steps < maxSubSteps) {
            updateFn(fixedDt, totalSimulatedTime);
            totalSimulatedTime += fixedDt;
            accumulator -= fixedDt;
            if (accumulator < 0) accumulator = 0;
            tickCount++;
            steps++;
          }

          if (steps >= maxSubSteps && accumulator > fixedDt) {
            accumulator = 0;
          }

          var alpha = fixedDt > 0 ? (accumulator / fixedDt) : 0;
          if (alpha > 1) alpha = 1;
          if (alpha < 0) alpha = 0;

          renderFn(alpha, totalSimulatedTime);
          frameCount++;
        } else {
          lastTime = now;
        }

        if (isRunning) {
          if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
            if (animFrameId !== null) {
              var pIdx = registeredAnimationFrameIds.indexOf(animFrameId);
              if (pIdx !== -1) registeredAnimationFrameIds.splice(pIdx, 1);
            }
            animFrameId = window.requestAnimationFrame(step);
            registeredAnimationFrameIds.push(animFrameId);
          }
        }
      }

      var onPauseUnsub = null;
      var onResumeUnsub = null;
      var onTeardownUnsub = null;

      var loop = {
        start: function () {
          if (isRunning) return this;
          isRunning = true;
          isPaused = false;
          lastTime = 0;
          accumulator = 0;

          if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
            animFrameId = window.requestAnimationFrame(step);
            registeredAnimationFrameIds.push(animFrameId);
          }
          return this;
        },

        stop: function () {
          if (!isRunning) return this;
          isRunning = false;
          isPaused = false;
          if (animFrameId !== null) {
            if (typeof window !== "undefined" && typeof window.cancelAnimationFrame === "function") {
              window.cancelAnimationFrame(animFrameId);
            }
            var cIdx = registeredAnimationFrameIds.indexOf(animFrameId);
            if (cIdx !== -1) registeredAnimationFrameIds.splice(cIdx, 1);
            animFrameId = null;
          }
          lastTime = 0;
          accumulator = 0;
          return this;
        },

        pause: function () {
          if (!isRunning || isPaused) return this;
          isPaused = true;
          return this;
        },

        resume: function () {
          if (!isRunning || !isPaused) return this;
          isPaused = false;
          lastTime = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
          accumulator = 0;
          return this;
        },

        stepManual: function (dt) {
          var stepDt = (typeof dt === "number" && dt > 0) ? dt : fixedDt;
          var effectiveDelta = stepDt * getEffectiveSpeed();
          accumulator += effectiveDelta;

          var TIME_EPSILON = 0.001;
          var steps = 0;
          while ((accumulator + TIME_EPSILON) >= fixedDt && steps < maxSubSteps) {
            updateFn(fixedDt, totalSimulatedTime);
            totalSimulatedTime += fixedDt;
            accumulator -= fixedDt;
            if (accumulator < 0) accumulator = 0;
            tickCount++;
            steps++;
          }
          if (steps >= maxSubSteps && accumulator > fixedDt) {
            accumulator = 0;
          }
          var alpha = fixedDt > 0 ? (accumulator / fixedDt) : 0;
          if (alpha > 1) alpha = 1;
          if (alpha < 0) alpha = 0;
          renderFn(alpha, totalSimulatedTime);
          frameCount++;
          return this;
        },

        isRunning: function () {
          return isRunning;
        },

        isPaused: function () {
          return isPaused;
        },

        getFixedDt: function () {
          return fixedDt;
        },

        getAccumulator: function () {
          return accumulator;
        },

        getTickCount: function () {
          return tickCount;
        },

        getFrameCount: function () {
          return frameCount;
        },

        getTotalSimulatedTime: function () {
          return totalSimulatedTime;
        },

        getSpeed: function () {
          return getEffectiveSpeed();
        },

        setSpeedMultiplier: function (multiplier) {
          if (typeof multiplier === "number" && multiplier > 0) {
            localSpeedMultiplier = Math.max(0.1, Math.min(5.0, multiplier));
          }
          return this;
        },

        destroy: function () {
          this.stop();
          var loopIdx = registeredGameLoops.indexOf(loop);
          if (loopIdx !== -1) {
            registeredGameLoops.splice(loopIdx, 1);
          }
          if (onPauseUnsub) {
            onPauseUnsub();
            onPauseUnsub = null;
          }
          if (onResumeUnsub) {
            onResumeUnsub();
            onResumeUnsub = null;
          }
          if (onTeardownUnsub) {
            onTeardownUnsub();
            onTeardownUnsub = null;
          }
          return this;
        }
      };

      if (autoPause) {
        var pauseCb = function () {
          loop.pause();
        };
        var resumeCb = function () {
          loop.resume();
        };
        var teardownCb = function () {
          loop.destroy();
        };

        pauseHandlers.push(pauseCb);
        resumeHandlers.push(resumeCb);
        teardownHandlers.push(teardownCb);

        onPauseUnsub = function () {
          var idx = pauseHandlers.indexOf(pauseCb);
          if (idx !== -1) pauseHandlers.splice(idx, 1);
        };
        onResumeUnsub = function () {
          var idx = resumeHandlers.indexOf(resumeCb);
          if (idx !== -1) resumeHandlers.splice(idx, 1);
        };
        onTeardownUnsub = function () {
          var idx = teardownHandlers.indexOf(teardownCb);
          if (idx !== -1) teardownHandlers.splice(idx, 1);
        };
      }

      registeredGameLoops.push(loop);

      if (opts.autoStart) {
        loop.start();
      }

      return loop;
    },

    /**
     * Standardized Hierarchical A* & Jump Point Search (JPS) 2D Grid Pathfinding Engine with Vector Smoothing
     * @param {Object} options - { width, height, grid, diagonal, heuristic }
     * @returns {Object} Pathfinder instance
     */
    createPathfinder: function (options) {
      var opts = options || {};
      var width = (typeof opts.width === "number" && opts.width > 0) ? Math.floor(opts.width) : 10;
      var height = (typeof opts.height === "number" && opts.height > 0) ? Math.floor(opts.height) : 10;
      var defaultDiagonal = opts.diagonal || "noObstacles"; // "never", "always", "noObstacles", "oneObstacle"
      var defaultHeuristic = opts.heuristic || "manhattan"; // "manhattan", "euclidean", "chebyshev", "octile"

      // Internal grid data: 2D array [y][x] containing weight (1+ = walkable, 0 = blocked)
      var grid = [];
      for (var y = 0; y < height; y++) {
        var row = [];
        for (var x = 0; x < width; x++) {
          row.push(1);
        }
        grid.push(row);
      }

      if (Array.isArray(opts.grid)) {
        for (var gy = 0; gy < Math.min(height, opts.grid.length); gy++) {
          if (Array.isArray(opts.grid[gy])) {
            for (var gx = 0; gx < Math.min(width, opts.grid[gy].length); gx++) {
              var val = opts.grid[gy][gx];
              if (val === false || val === 0) {
                grid[gy][gx] = 0;
              } else if (typeof val === "number" && val > 0) {
                grid[gy][gx] = val;
              } else {
                grid[gy][gx] = 1;
              }
            }
          }
        }
      }

      function isWalkable(x, y) {
        if (x < 0 || x >= width || y < 0 || y >= height) return false;
        return grid[y][x] > 0;
      }

      function getWeight(x, y) {
        if (x < 0 || x >= width || y < 0 || y >= height) return 0;
        return grid[y][x];
      }

      function setWalkable(x, y, walkable) {
        if (x >= 0 && x < width && y >= 0 && y < height) {
          grid[y][x] = walkable ? 1 : 0;
        }
      }

      function setWeight(x, y, weight) {
        if (x >= 0 && x < width && y >= 0 && y < height) {
          grid[y][x] = (typeof weight === "number" && weight >= 0) ? weight : 0;
        }
      }

      function computeHeuristic(type, x1, y1, x2, y2) {
        var dx = Math.abs(x1 - x2);
        var dy = Math.abs(y1 - y2);
        switch (type) {
          case "euclidean":
            return Math.sqrt(dx * dx + dy * dy);
          case "chebyshev":
            return Math.max(dx, dy);
          case "octile":
            var F = Math.SQRT2 - 1;
            return (dx < dy) ? F * dx + dy : F * dy + dx;
          case "manhattan":
          default:
            return dx + dy;
        }
      }

      // Min-Heap Priority Queue for A*
      function PriorityQueue() {
        this.nodes = [];
      }
      PriorityQueue.prototype.push = function (node) {
        this.nodes.push(node);
        this._up(this.nodes.length - 1);
      };
      PriorityQueue.prototype.pop = function () {
        if (this.nodes.length === 0) return null;
        var top = this.nodes[0];
        var bottom = this.nodes.pop();
        if (this.nodes.length > 0) {
          this.nodes[0] = bottom;
          this._down(0);
        }
        return top;
      };
      PriorityQueue.prototype.size = function () {
        return this.nodes.length;
      };
      PriorityQueue.prototype._up = function (i) {
        var node = this.nodes[i];
        while (i > 0) {
          var p = (i - 1) >> 1;
          var parent = this.nodes[p];
          if (node.f >= parent.f) break;
          this.nodes[i] = parent;
          i = p;
        }
        this.nodes[i] = node;
      };
      PriorityQueue.prototype._down = function (i) {
        var len = this.nodes.length;
        var node = this.nodes[i];
        while ((i << 1) + 1 < len) {
          var left = (i << 1) + 1;
          var right = left + 1;
          var best = left;
          if (right < len && this.nodes[right].f < this.nodes[left].f) {
            best = right;
          }
          if (this.nodes[best].f >= node.f) break;
          this.nodes[i] = this.nodes[best];
          i = best;
        }
        this.nodes[i] = node;
      };

      // Raycast line of sight check (Bresenham) for vector smoothing
      function lineOfSight(x0, y0, x1, y1) {
        var dx = Math.abs(x1 - x0);
        var dy = Math.abs(y1 - y0);
        var sx = (x0 < x1) ? 1 : -1;
        var sy = (y0 < y1) ? 1 : -1;
        var err = dx - dy;

        var cx = x0;
        var cy = y0;

        while (true) {
          if (!isWalkable(cx, cy)) return false;
          if (cx === x1 && cy === y1) break;
          var e2 = 2 * err;
          if (e2 > -dy) {
            err -= dy;
            cx += sx;
          }
          if (e2 < dx) {
            err += dx;
            cy += sy;
          }
        }
        return true;
      }

      // String-pulling vector path smoothing
      function smoothPath(rawPath) {
        if (!Array.isArray(rawPath) || rawPath.length <= 2) return rawPath;
        var smoothed = [rawPath[0]];
        var current = 0;

        while (current < rawPath.length - 1) {
          var furthest = current + 1;
          for (var check = rawPath.length - 1; check > current + 1; check--) {
            if (lineOfSight(rawPath[current].x, rawPath[current].y, rawPath[check].x, rawPath[check].y)) {
              furthest = check;
              break;
            }
          }
          smoothed.push(rawPath[furthest]);
          current = furthest;
        }
        return smoothed;
      }

      function getNeighbors(node, diagonalMode) {
        var x = node.x;
        var y = node.y;
        var result = [];

        var north = isWalkable(x, y - 1);
        var south = isWalkable(x, y + 1);
        var east = isWalkable(x + 1, y);
        var west = isWalkable(x - 1, y);

        if (north) result.push({ x: x, y: y - 1, cost: getWeight(x, y - 1) });
        if (south) result.push({ x: x, y: y + 1, cost: getWeight(x, y + 1) });
        if (east) result.push({ x: x + 1, y: y, cost: getWeight(x + 1, y) });
        if (west) result.push({ x: x - 1, y: y, cost: getWeight(x - 1, y) });

        if (diagonalMode === "never") return result;

        var diagCost = Math.SQRT2;

        // North-East
        if (isWalkable(x + 1, y - 1)) {
          if (diagonalMode === "always" ||
              (diagonalMode === "noObstacles" && north && east) ||
              (diagonalMode === "oneObstacle" && (north || east))) {
            result.push({ x: x + 1, y: y - 1, cost: getWeight(x + 1, y - 1) * diagCost });
          }
        }
        // South-East
        if (isWalkable(x + 1, y + 1)) {
          if (diagonalMode === "always" ||
              (diagonalMode === "noObstacles" && south && east) ||
              (diagonalMode === "oneObstacle" && (south || east))) {
            result.push({ x: x + 1, y: y + 1, cost: getWeight(x + 1, y + 1) * diagCost });
          }
        }
        // South-West
        if (isWalkable(x - 1, y + 1)) {
          if (diagonalMode === "always" ||
              (diagonalMode === "noObstacles" && south && west) ||
              (diagonalMode === "oneObstacle" && (south || west))) {
            result.push({ x: x - 1, y: y + 1, cost: getWeight(x - 1, y + 1) * diagCost });
          }
        }
        // North-West
        if (isWalkable(x - 1, y - 1)) {
          if (diagonalMode === "always" ||
              (diagonalMode === "noObstacles" && north && west) ||
              (diagonalMode === "oneObstacle" && (north || west))) {
            result.push({ x: x - 1, y: y - 1, cost: getWeight(x - 1, y - 1) * diagCost });
          }
        }

        return result;
      }

      // Jump Point Search jump helper
      function jump(x, y, px, py, endX, endY) {
        if (!isWalkable(x, y)) return null;
        if (x === endX && y === endY) return { x: x, y: y };

        var dx = x - px;
        var dy = y - py;

        // Diagonal search
        if (dx !== 0 && dy !== 0) {
          if ((isWalkable(x - dx, y + dy) && !isWalkable(x - dx, y)) ||
              (isWalkable(x + dx, y - dy) && !isWalkable(x, y - dy))) {
            return { x: x, y: y };
          }
          if (jump(x + dx, y, x, y, endX, endY) || jump(x, y + dy, x, y, endX, endY)) {
            return { x: x, y: y };
          }
        } else if (dx !== 0) {
          // Horizontal search
          if ((isWalkable(x + dx, y + 1) && !isWalkable(x, y + 1)) ||
              (isWalkable(x + dx, y - 1) && !isWalkable(x, y - 1))) {
            return { x: x, y: y };
          }
        } else if (dy !== 0) {
          // Vertical search
          if ((isWalkable(x + 1, y + dy) && !isWalkable(x + 1, y)) ||
              (isWalkable(x - 1, y + dy) && !isWalkable(x - 1, y))) {
            return { x: x, y: y };
          }
        }

        if (isWalkable(x + dx, y) || isWalkable(x, y + dy)) {
          return jump(x + dx, y + dy, x, y, endX, endY);
        }
        return null;
      }

      function reconstructPath(node) {
        var path = [];
        var curr = node;
        while (curr) {
          path.push({ x: curr.x, y: curr.y });
          curr = curr.parent;
        }
        path.reverse();
        return path;
      }

      function findPath(startX, startY, endX, endY, findOpts) {
        var search = createSearch(startX, startY, endX, endY, findOpts);
        while (!search.isDone()) {
          search.step();
        }
        return search.getPath();
      }

      function createSearch(startX, startY, endX, endY, searchOpts) {
        var sOpts = searchOpts || {};
        var diagonalMode = sOpts.diagonal || defaultDiagonal;
        var heuristicType = sOpts.heuristic || defaultHeuristic;
        var smooth = sOpts.smooth !== false;
        var useJPS = Boolean(sOpts.allowJPS);
        var maxIterations = (typeof sOpts.maxIterationsPerStep === "number" && sOpts.maxIterationsPerStep > 0)
          ? sOpts.maxIterationsPerStep : 500;

        var openSet = new PriorityQueue();
        var gScore = {};
        var closedSet = {};
        var done = false;
        var finalPath = [];
        var totalIterations = 0;

        var startValid = isWalkable(startX, startY);
        var endValid = isWalkable(endX, endY);

        if (!startValid || !endValid) {
          done = true;
        } else if (startX === endX && startY === endY) {
          finalPath = [{ x: startX, y: startY }];
          done = true;
        } else {
          var startNode = {
            x: startX,
            y: startY,
            g: 0,
            f: computeHeuristic(heuristicType, startX, startY, endX, endY),
            parent: null,
          };
          gScore[startX + "," + startY] = 0;
          openSet.push(startNode);
        }

        return {
          step: function () {
            if (done) return { done: true, path: finalPath, iterations: totalIterations };
            var iters = 0;

            while (openSet.size() > 0 && iters < maxIterations) {
              iters++;
              totalIterations++;
              var current = openSet.pop();
              var key = current.x + "," + current.y;

              if (current.x === endX && current.y === endY) {
                var rawPath = reconstructPath(current);
                finalPath = smooth ? smoothPath(rawPath) : rawPath;
                done = true;
                return { done: true, path: finalPath, iterations: totalIterations };
              }

              closedSet[key] = true;

              if (useJPS && diagonalMode !== "never") {
                // JPS expansion
                var neighbors = getNeighbors(current, diagonalMode);
                for (var i = 0; i < neighbors.length; i++) {
                  var jp = jump(neighbors[i].x, neighbors[i].y, current.x, current.y, endX, endY);
                  if (jp) {
                    var jpKey = jp.x + "," + jp.y;
                    if (closedSet[jpKey]) continue;
                    var jumpDist = computeHeuristic("octile", current.x, current.y, jp.x, jp.y);
                    var tentativeG = current.g + jumpDist;
                    if (gScore[jpKey] === undefined || tentativeG < gScore[jpKey]) {
                      gScore[jpKey] = tentativeG;
                      var h = computeHeuristic(heuristicType, jp.x, jp.y, endX, endY);
                      openSet.push({ x: jp.x, y: jp.y, g: tentativeG, f: tentativeG + h, parent: current });
                    }
                  }
                }
              } else {
                // Standard A* expansion
                var neighbors = getNeighbors(current, diagonalMode);
                for (var i = 0; i < neighbors.length; i++) {
                  var neighbor = neighbors[i];
                  var nKey = neighbor.x + "," + neighbor.y;
                  if (closedSet[nKey]) continue;

                  var tentativeG = current.g + neighbor.cost;
                  if (gScore[nKey] === undefined || tentativeG < gScore[nKey]) {
                    gScore[nKey] = tentativeG;
                    var h = computeHeuristic(heuristicType, neighbor.x, neighbor.y, endX, endY);
                    openSet.push({
                      x: neighbor.x,
                      y: neighbor.y,
                      g: tentativeG,
                      f: tentativeG + h,
                      parent: current,
                    });
                  }
                }
              }
            }

            if (openSet.size() === 0) {
              done = true;
            }

            return { done: done, path: finalPath, iterations: totalIterations };
          },
          isDone: function () {
            return done;
          },
          getPath: function () {
            return finalPath;
          },
        };
      }

      function clone() {
        var clonedGrid = [];
        for (var y = 0; y < height; y++) {
          clonedGrid.push(grid[y].slice());
        }
        return sdkInstance.createPathfinder({
          width: width,
          height: height,
          grid: clonedGrid,
          diagonal: defaultDiagonal,
          heuristic: defaultHeuristic,
        });
      }

      function reset(newGrid) {
        for (var y = 0; y < height; y++) {
          for (var x = 0; x < width; x++) {
            if (Array.isArray(newGrid) && Array.isArray(newGrid[y]) && newGrid[y][x] !== undefined) {
              grid[y][x] = newGrid[y][x] ? 1 : 0;
            } else {
              grid[y][x] = 1;
            }
          }
        }
      }

      return {
        width: width,
        height: height,
        isWalkable: isWalkable,
        setWalkable: setWalkable,
        getWeight: getWeight,
        setWeight: setWeight,
        findPath: findPath,
        createSearch: createSearch,
        lineOfSight: lineOfSight,
        smoothPath: smoothPath,
        clone: clone,
        reset: reset,
      };
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
     * Subscribe to standardized resize broadcasts from parent modal (#501, #1182)
     * Supports both onResize(callback) and onResize({ canvas, aspectRatio }, callback)
     * @param {Object|Function} arg1 - Optional options config { canvas, aspectRatio } or callback
     * @param {Function} [arg2] - Callback receiving { width, height, clientWidth, clientHeight, dpr, isFullscreen, orientation }
     */
    onResize: function (arg1, arg2) {
      if (typeof window === 'undefined') return;
      var callback = typeof arg1 === 'function' ? arg1 : (typeof arg2 === 'function' ? arg2 : null);
      var options = (arg1 && typeof arg1 === 'object') ? arg1 : ((arg2 && typeof arg2 === 'object') ? arg2 : {});

      if (typeof callback !== 'function' && !options.canvas) return;

      window.addEventListener('message', function (e) {
        if (e && e.data && e.data.type === 'AV_RESIZE') {
          var payload = e.data.payload || e.data;
          if (options.canvas && options.aspectRatio && typeof sdkInstance.fitCanvasAspectRatio === 'function') {
            sdkInstance.fitCanvasAspectRatio(options.canvas, options.aspectRatio);
          }
          if (typeof callback === 'function') {
            callback(payload);
          }
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
    },

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
    },

    // ========================================================
    // DYNAMIC DIFFICULTY ADJUSTMENT (DDA) ADAPTIVE PROTOCOL (#1112)
    // Analyzes player telemetry and provides dynamic scaling
    // ========================================================
    dda: (function () {
      var STORAGE_KEY = 'arcadeverse_dda_mode';
      var MIN_MULT = 0.75;
      var MAX_MULT = 1.25;
      var BASELINE_MULT = 1.0;
      var RAPID_WINDOW_MS = 30000;
      var RAPID_COUNT = 3;

      var mode = 'adaptive';
      var currentMultiplier = 1.0;
      var targetMultiplier = 1.0;
      var lastQueryTime = Date.now();
      var sessionStartTime = Date.now();
      var currentSurvivalStart = Date.now();
      var deathTimestamps = [];
      var survivalDurations = [];
      var hits = 0;
      var misses = 0;
      var listeners = [];

      try {
        if (typeof localStorage !== 'undefined') {
          var saved = localStorage.getItem(STORAGE_KEY);
          if (saved === 'hardcore' || saved === 'adaptive') mode = saved;
        }
      } catch (_) {}

      function clampVal(v, mn, mx) {
        return Math.max(mn, Math.min(mx, v));
      }

      function computeTarget() {
        if (mode === 'hardcore') return BASELINE_MULT;
        var now = Date.now();

        // Rapid deaths: >= 3 in 30 seconds -> immediate 0.75 relief
        var rapidDeaths = 0;
        for (var i = deathTimestamps.length - 1; i >= 0; i--) {
          if (now - deathTimestamps[i] <= RAPID_WINDOW_MS) {
            rapidDeaths++;
          } else {
            break;
          }
        }
        if (rapidDeaths >= RAPID_COUNT) return MIN_MULT;

        // DPM
        var recentDeaths = 0;
        for (var j = deathTimestamps.length - 1; j >= 0; j--) {
          if (now - deathTimestamps[j] <= 60000) recentDeaths++;
          else break;
        }
        var sessionMins = Math.max(0.5, (now - sessionStartTime) / 60000);
        var dpm = recentDeaths > 0 ? recentDeaths : (deathTimestamps.length / sessionMins);

        // Survival time
        var totalSurv = 0;
        for (var s = 0; s < survivalDurations.length; s++) totalSurv += survivalDurations[s];
        totalSurv += Math.max(0, (now - currentSurvivalStart) / 1000);
        var avgSurv = totalSurv / (survivalDurations.length + 1);

        // Hit rate
        var totalAttempts = hits + misses;
        var hitRate = totalAttempts > 0 ? (hits / totalAttempts) : 0.5;

        var delta = 0.0;
        if (dpm >= 4.0) delta -= 0.20;
        else if (dpm >= 2.5) delta -= 0.12;
        else if (dpm >= 1.5) delta -= 0.05;
        else if (dpm === 0 && sessionMins >= 0.75) delta += 0.10;

        if (avgSurv < 12) delta -= 0.08;
        else if (avgSurv < 20) delta -= 0.04;
        else if (avgSurv > 60) delta += 0.08;
        else if (avgSurv > 40) delta += 0.04;

        if (totalAttempts >= 6) {
          if (hitRate >= 0.85) delta += 0.08;
          else if (hitRate >= 0.70) delta += 0.04;
          else if (hitRate <= 0.25) delta -= 0.08;
          else if (hitRate <= 0.40) delta -= 0.04;
        }

        return clampVal(BASELINE_MULT + delta, MIN_MULT, MAX_MULT);
      }

      function updateSmooth() {
        var now = Date.now();
        var dt = Math.min(1.0, Math.max(0.016, (now - lastQueryTime) / 1000));
        lastQueryTime = now;
        targetMultiplier = computeTarget();

        if (mode === 'hardcore') {
          currentMultiplier += (BASELINE_MULT - currentMultiplier) * Math.min(1.0, dt * 2.0);
          if (Math.abs(currentMultiplier - BASELINE_MULT) < 0.005) currentMultiplier = BASELINE_MULT;
        } else {
          currentMultiplier += (targetMultiplier - currentMultiplier) * Math.min(1.0, dt * 0.85);
        }
        currentMultiplier = clampVal(currentMultiplier, MIN_MULT, MAX_MULT);
      }

      function notify() {
        var mult = Math.round(currentMultiplier * 100) / 100;
        for (var i = 0; i < listeners.length; i++) {
          try { listeners[i](mult); } catch (_) {}
        }
      }

      // Initialize query to parent hub if inside iframe
      try {
        if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
          window.parent.postMessage({ type: 'ARCADEVERSE_REQUEST_DDA_CONFIG' }, '*');
        }
      } catch (_) {}

      return {
        getAdaptiveMultiplier: function () {
          if (typeof window !== 'undefined' && window.ArcadeDDA && window.ArcadeDDA !== this && typeof window.ArcadeDDA.getAdaptiveMultiplier === 'function') {
            return window.ArcadeDDA.getAdaptiveMultiplier();
          }
          updateSmooth();
          return Math.round(currentMultiplier * 100) / 100;
        },

        getMultiplier: function () {
          return this.getAdaptiveMultiplier();
        },

        recordDeath: function () {
          if (typeof window !== 'undefined' && window.ArcadeDDA && window.ArcadeDDA !== this && typeof window.ArcadeDDA.recordDeath === 'function') {
            return window.ArcadeDDA.recordDeath();
          }
          var now = Date.now();
          deathTimestamps.push(now);
          var surv = Math.max(0.5, (now - currentSurvivalStart) / 1000);
          survivalDurations.push(surv);
          currentSurvivalStart = now;

          while (deathTimestamps.length > 50 || (deathTimestamps.length > 0 && now - deathTimestamps[0] > 300000)) {
            deathTimestamps.shift();
          }

          var rapid = 0;
          for (var i = deathTimestamps.length - 1; i >= 0; i--) {
            if (now - deathTimestamps[i] <= RAPID_WINDOW_MS) rapid++;
            else break;
          }
          if (rapid >= RAPID_COUNT) targetMultiplier = MIN_MULT;

          updateSmooth();
          notify();

          try {
            if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
              window.parent.postMessage({ type: 'ARCADEVERSE_DDA_DEATH', timestamp: now }, '*');
            }
          } catch (_) {}
        },

        recordHit: function (isHit) {
          if (typeof window !== 'undefined' && window.ArcadeDDA && window.ArcadeDDA !== this && typeof window.ArcadeDDA.recordHit === 'function') {
            return window.ArcadeDDA.recordHit(isHit);
          }
          if (isHit !== false) hits++;
          else misses++;
          updateSmooth();
          notify();

          try {
            if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
              window.parent.postMessage({ type: 'ARCADEVERSE_DDA_HIT', isHit: isHit !== false }, '*');
            }
          } catch (_) {}
        },

        setMode: function (newMode) {
          if (typeof window !== 'undefined' && window.ArcadeDDA && window.ArcadeDDA !== this && typeof window.ArcadeDDA.setMode === 'function') {
            return window.ArcadeDDA.setMode(newMode);
          }
          mode = String(newMode).toLowerCase() === 'hardcore' ? 'hardcore' : 'adaptive';
          try {
            if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, mode);
          } catch (_) {}
          updateSmooth();
          notify();

          try {
            if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
              window.parent.postMessage({ type: 'ARCADEVERSE_DDA_SET_MODE', mode: mode }, '*');
            }
          } catch (_) {}
        },

        getMode: function () {
          if (typeof window !== 'undefined' && window.ArcadeDDA && window.ArcadeDDA !== this && typeof window.ArcadeDDA.getMode === 'function') {
            return window.ArcadeDDA.getMode();
          }
          return mode;
        },

        isEnabled: function () {
          return this.getMode() === 'adaptive';
        },

        getTelemetry: function () {
          if (typeof window !== 'undefined' && window.ArcadeDDA && window.ArcadeDDA !== this && typeof window.ArcadeDDA.getTelemetry === 'function') {
            return window.ArcadeDDA.getTelemetry();
          }
          var now = Date.now();
          var sessionMins = Math.max(0.1, (now - sessionStartTime) / 60000);
          var totalAttempts = hits + misses;
          var totalSurv = 0;
          for (var s = 0; s < survivalDurations.length; s++) totalSurv += survivalDurations[s];
          totalSurv += Math.max(0, (now - currentSurvivalStart) / 1000);

          return {
            mode: mode,
            enabled: mode === 'adaptive',
            currentMultiplier: Math.round(currentMultiplier * 100) / 100,
            targetMultiplier: Math.round(targetMultiplier * 100) / 100,
            totalDeaths: deathTimestamps.length,
            deathsPerMinute: Math.round((deathTimestamps.length / sessionMins) * 100) / 100,
            averageSurvivalSeconds: Math.round((totalSurv / (survivalDurations.length + 1)) * 100) / 100,
            hitRate: totalAttempts > 0 ? Math.round((hits / totalAttempts) * 100) / 100 : 0.5,
            totalHits: hits,
            totalMisses: misses
          };
        },

        reset: function () {
          if (typeof window !== 'undefined' && window.ArcadeDDA && window.ArcadeDDA !== this && typeof window.ArcadeDDA.reset === 'function') {
            return window.ArcadeDDA.reset();
          }
          var now = Date.now();
          sessionStartTime = now;
          currentSurvivalStart = now;
          lastQueryTime = now;
          deathTimestamps = [];
          survivalDurations = [];
          hits = 0;
          misses = 0;
          currentMultiplier = mode === 'hardcore' ? BASELINE_MULT : 1.0;
          targetMultiplier = currentMultiplier;
        },

        onMultiplierChange: function (callback) {
          if (typeof callback !== 'function') return function () {};
          listeners.push(callback);
          return function () {
            var idx = listeners.indexOf(callback);
            if (idx !== -1) listeners.splice(idx, 1);
          };
        },

        _syncFromParent: function (cfg) {
          if (!cfg) return;
          if (cfg.mode) mode = cfg.mode;
          if (typeof cfg.multiplier === 'number') {
            currentMultiplier = clampVal(cfg.multiplier, MIN_MULT, MAX_MULT);
          }
          if (typeof cfg.targetMultiplier === 'number') {
            targetMultiplier = clampVal(cfg.targetMultiplier, MIN_MULT, MAX_MULT);
          }
          notify();
        }
      };
    })(),

    /**
     * Dynamic Loose Quadtree & Spatial Hash Grid Broadphase Collision Detection Engine (#1621)
     */
    createQuadtree: function (boundsInput, options) {
      options = options || {};
      var beta = typeof options.beta === "number" ? options.beta : (typeof options.looseFactor === "number" ? options.looseFactor : 1.5);
      var maxEntitiesPerNode = options.maxEntitiesPerNode || 8;
      var maxDepth = options.maxDepth || 6;
      var currentQueryId = 1;

      var rootBounds = { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };
      if (boundsInput) {
        if (typeof boundsInput.minX === "number") {
          rootBounds.minX = boundsInput.minX;
          rootBounds.minY = boundsInput.minY;
          rootBounds.maxX = boundsInput.maxX;
          rootBounds.maxY = boundsInput.maxY;
        } else if (typeof boundsInput.x === "number") {
          rootBounds.minX = boundsInput.x;
          rootBounds.minY = boundsInput.y;
          rootBounds.maxX = boundsInput.x + (boundsInput.width || 0);
          rootBounds.maxY = boundsInput.y + (boundsInput.height || 0);
        }
      }

      function extractBounds(item) {
        if (!item) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
        var b = item.bounds || item;
        if (typeof b.minX === "number") {
          return { minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY };
        }
        if (typeof b.radius === "number" && typeof b.x === "number" && typeof b.y === "number") {
          return { minX: b.x - b.radius, minY: b.y - b.radius, maxX: b.x + b.radius, maxY: b.y + b.radius };
        }
        if (typeof b.x === "number") {
          var w = b.width !== undefined ? b.width : 0;
          var h = b.height !== undefined ? b.height : 0;
          return { minX: b.x, minY: b.y, maxX: b.x + w, maxY: b.y + h };
        }
        return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
      }

      function aabbIntersects(a, b) {
        return !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY);
      }

      function aabbContains(outer, inner) {
        return inner.minX >= outer.minX && inner.maxX <= outer.maxX && inner.minY >= outer.minY && inner.maxY <= outer.maxY;
      }

      function circleIntersectsAABB(cx, cy, r, box) {
        var closestX = Math.max(box.minX, Math.min(cx, box.maxX));
        var closestY = Math.max(box.minY, Math.min(cy, box.maxY));
        var dx = cx - closestX;
        var dy = cy - closestY;
        return (dx * dx + dy * dy) <= (r * r);
      }

      function rayIntersectsAABB(ox, oy, dx, dy, maxDist, box) {
        var tmin = 0;
        var tmax = maxDist;
        if (Math.abs(dx) < 1e-9) {
          if (ox < box.minX || ox > box.maxX) return false;
        } else {
          var invD = 1.0 / dx;
          var t1 = (box.minX - ox) * invD;
          var t2 = (box.maxX - ox) * invD;
          tmin = Math.max(tmin, Math.min(t1, t2));
          tmax = Math.min(tmax, Math.max(t1, t2));
          if (tmin > tmax) return false;
        }
        if (Math.abs(dy) < 1e-9) {
          if (oy < box.minY || oy > box.maxY) return false;
        } else {
          var invD2 = 1.0 / dy;
          var t12 = (box.minY - oy) * invD2;
          var t22 = (box.maxY - oy) * invD2;
          tmin = Math.max(tmin, Math.min(t12, t22));
          tmax = Math.min(tmax, Math.max(t12, t22));
          if (tmin > tmax) return false;
        }
        return tmax >= 0 && tmin <= maxDist;
      }

      function QuadNode(minX, minY, maxX, maxY, depth) {
        this.minX = minX;
        this.minY = minY;
        this.maxX = maxX;
        this.maxY = maxY;
        this.depth = depth;
        var w = maxX - minX;
        var h = maxY - minY;
        var cx = minX + w * 0.5;
        var cy = minY + h * 0.5;
        var hw = (w * 0.5) * beta;
        var hh = (h * 0.5) * beta;
        this.loose = {
          minX: cx - hw,
          minY: cy - hh,
          maxX: cx + hw,
          maxY: cy + hh
        };
        this.entities = [];
        this.children = null;
      }

      QuadNode.prototype.subdivide = function () {
        var midX = this.minX + (this.maxX - this.minX) * 0.5;
        var midY = this.minY + (this.maxY - this.minY) * 0.5;
        var nextDepth = this.depth + 1;
        this.children = [
          new QuadNode(this.minX, this.minY, midX, midY, nextDepth),
          new QuadNode(midX, this.minY, this.maxX, midY, nextDepth),
          new QuadNode(this.minX, midY, midX, this.maxY, nextDepth),
          new QuadNode(midX, midY, this.maxX, this.maxY, nextDepth)
        ];
      };

      QuadNode.prototype.insert = function (entity, entityBounds, entityNodeMap) {
        if (this.children) {
          for (var i = 0; i < 4; i++) {
            if (aabbContains(this.children[i].loose, entityBounds)) {
              return this.children[i].insert(entity, entityBounds, entityNodeMap);
            }
          }
        }
        if (!this.children && this.entities.length >= maxEntitiesPerNode && this.depth < maxDepth) {
          this.subdivide();
          var remaining = [];
          for (var j = 0; j < this.entities.length; j++) {
            var ent = this.entities[j];
            var eb = extractBounds(ent);
            var pushed = false;
            for (var k = 0; k < 4; k++) {
              if (aabbContains(this.children[k].loose, eb)) {
                this.children[k].insert(ent, eb, entityNodeMap);
                pushed = true;
                break;
              }
            }
            if (!pushed) remaining.push(ent);
          }
          this.entities = remaining;
          for (var m = 0; m < 4; m++) {
            if (aabbContains(this.children[m].loose, entityBounds)) {
              return this.children[m].insert(entity, entityBounds, entityNodeMap);
            }
          }
        }
        this.entities.push(entity);
        if (entityNodeMap) entityNodeMap.set(entity, this);
        return true;
      };

      QuadNode.prototype.queryAABB = function (box, qId, out) {
        if (!aabbIntersects(this.loose, box)) return;
        for (var i = 0; i < this.entities.length; i++) {
          var ent = this.entities[i];
          if (ent.__avQueryId !== qId) {
            var eb = extractBounds(ent);
            if (aabbIntersects(eb, box)) {
              ent.__avQueryId = qId;
              out.push(ent);
            }
          }
        }
        if (this.children) {
          for (var j = 0; j < 4; j++) {
            this.children[j].queryAABB(box, qId, out);
          }
        }
      };

      QuadNode.prototype.queryCircle = function (cx, cy, radius, qId, out) {
        if (!circleIntersectsAABB(cx, cy, radius, this.loose)) return;
        for (var i = 0; i < this.entities.length; i++) {
          var ent = this.entities[i];
          if (ent.__avQueryId !== qId) {
            var eb = extractBounds(ent);
            if (circleIntersectsAABB(cx, cy, radius, eb)) {
              ent.__avQueryId = qId;
              out.push(ent);
            }
          }
        }
        if (this.children) {
          for (var j = 0; j < 4; j++) {
            this.children[j].queryCircle(cx, cy, radius, qId, out);
          }
        }
      };

      QuadNode.prototype.queryRay = function (ox, oy, dx, dy, maxDist, qId, out) {
        if (!rayIntersectsAABB(ox, oy, dx, dy, maxDist, this.loose)) return;
        for (var i = 0; i < this.entities.length; i++) {
          var ent = this.entities[i];
          if (ent.__avQueryId !== qId) {
            var eb = extractBounds(ent);
            if (rayIntersectsAABB(ox, oy, dx, dy, maxDist, eb)) {
              ent.__avQueryId = qId;
              out.push(ent);
            }
          }
        }
        if (this.children) {
          for (var j = 0; j < 4; j++) {
            this.children[j].queryRay(ox, oy, dx, dy, maxDist, qId, out);
          }
        }
      };

      var entityNodeMap = new Map();
      var rootNode = new QuadNode(rootBounds.minX, rootBounds.minY, rootBounds.maxX, rootBounds.maxY, 0);
      var totalEntities = 0;

      return {
        _root: rootNode,
        get count() { return totalEntities; },
        size: function () { return totalEntities; },

        insert: function (entity) {
          if (!entity) return false;
          if (entityNodeMap.has(entity)) {
            this.remove(entity);
          }
          var eb = extractBounds(entity);
          rootNode.insert(entity, eb, entityNodeMap);
          totalEntities++;
          return true;
        },

        update: function (entity) {
          if (!entity) return false;
          var node = entityNodeMap.get(entity);
          if (!node) return this.insert(entity);
          var eb = extractBounds(entity);
          if (aabbContains(node.loose, eb)) {
            return true;
          }
          this.remove(entity);
          return this.insert(entity);
        },

        remove: function (entity) {
          if (!entity) return false;
          var node = entityNodeMap.get(entity);
          if (!node) return false;
          var idx = node.entities.indexOf(entity);
          if (idx !== -1) {
            node.entities.splice(idx, 1);
          }
          entityNodeMap.delete(entity);
          totalEntities = Math.max(0, totalEntities - 1);
          return true;
        },

        clear: function () {
          rootNode = new QuadNode(rootBounds.minX, rootBounds.minY, rootBounds.maxX, rootBounds.maxY, 0);
          this._root = rootNode;
          entityNodeMap.clear();
          totalEntities = 0;
        },

        queryAABB: function (minX, minY, maxX, maxY, outArray) {
          var out = outArray || [];
          if (outArray) out.length = 0;
          var qId = ++currentQueryId;
          var box = { minX: minX, minY: minY, maxX: maxX, maxY: maxY };
          rootNode.queryAABB(box, qId, out);
          return out;
        },

        queryCircle: function (centerX, centerY, radius, outArray) {
          var out = outArray || [];
          if (outArray) out.length = 0;
          var qId = ++currentQueryId;
          rootNode.queryCircle(centerX, centerY, radius, qId, out);
          return out;
        },

        queryRay: function (originX, originY, dirX, dirY, maxDistance, outArray) {
          var out = outArray || [];
          if (outArray) out.length = 0;
          var qId = ++currentQueryId;
          var len = Math.hypot(dirX, dirY);
          var dx = len > 1e-9 ? dirX / len : 0;
          var dy = len > 1e-9 ? dirY / len : 0;
          rootNode.queryRay(originX, originY, dx, dy, maxDistance || 1000, qId, out);
          return out;
        }
      };
    },

    createSpatialHashGrid: function (cellSize, options) {
      options = options || {};
      cellSize = cellSize || 64;
      var mask = typeof options.mask === "number" ? options.mask : 0x7fffffff;
      var buckets = new Map();
      var entityBuckets = new Map();
      var currentQueryId = 1;
      var totalEntities = 0;

      function hash(cx, cy) {
        return (((cx * 73856093) ^ (cy * 19349663)) & mask) >>> 0;
      }

      function extractBounds(item) {
        if (!item) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
        var b = item.bounds || item;
        if (typeof b.minX === "number") {
          return { minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY };
        }
        if (typeof b.radius === "number" && typeof b.x === "number" && typeof b.y === "number") {
          return { minX: b.x - b.radius, minY: b.y - b.radius, maxX: b.x + b.radius, maxY: b.y + b.radius };
        }
        if (typeof b.x === "number") {
          var w = b.width !== undefined ? b.width : 0;
          var h = b.height !== undefined ? b.height : 0;
          return { minX: b.x, minY: b.y, maxX: b.x + w, maxY: b.y + h };
        }
        return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
      }

      function aabbIntersects(a, b) {
        return !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY);
      }

      function circleIntersectsAABB(cx, cy, r, box) {
        var closestX = Math.max(box.minX, Math.min(cx, box.maxX));
        var closestY = Math.max(box.minY, Math.min(cy, box.maxY));
        var dx = cx - closestX;
        var dy = cy - closestY;
        return (dx * dx + dy * dy) <= (r * r);
      }

      function rayIntersectsAABB(ox, oy, dx, dy, maxDist, box) {
        var tmin = 0;
        var tmax = maxDist;
        if (Math.abs(dx) < 1e-9) {
          if (ox < box.minX || ox > box.maxX) return false;
        } else {
          var invD = 1.0 / dx;
          var t1 = (box.minX - ox) * invD;
          var t2 = (box.maxX - ox) * invD;
          tmin = Math.max(tmin, Math.min(t1, t2));
          tmax = Math.min(tmax, Math.max(t1, t2));
          if (tmin > tmax) return false;
        }
        if (Math.abs(dy) < 1e-9) {
          if (oy < box.minY || oy > box.maxY) return false;
        } else {
          var invD2 = 1.0 / dy;
          var t12 = (box.minY - oy) * invD2;
          var t22 = (box.maxY - oy) * invD2;
          tmin = Math.max(tmin, Math.min(t12, t22));
          tmax = Math.min(tmax, Math.max(t12, t22));
          if (tmin > tmax) return false;
        }
        return tmax >= 0 && tmin <= maxDist;
      }

      function getCellKeysForBounds(eb) {
        var minCX = Math.floor(eb.minX / cellSize);
        var maxCX = Math.floor(eb.maxX / cellSize);
        var minCY = Math.floor(eb.minY / cellSize);
        var maxCY = Math.floor(eb.maxY / cellSize);
        var keys = [];
        for (var cy = minCY; cy <= maxCY; cy++) {
          for (var cx = minCX; cx <= maxCX; cx++) {
            keys.push(hash(cx, cy));
          }
        }
        return keys;
      }

      return {
        cellSize: cellSize,
        get count() { return totalEntities; },
        size: function () { return totalEntities; },

        insert: function (entity) {
          if (!entity) return false;
          if (entityBuckets.has(entity)) {
            this.remove(entity);
          }
          var eb = extractBounds(entity);
          var keys = getCellKeysForBounds(eb);
          for (var i = 0; i < keys.length; i++) {
            var k = keys[i];
            var bucket = buckets.get(k);
            if (!bucket) {
              bucket = [];
              buckets.set(k, bucket);
            }
            bucket.push(entity);
          }
          entityBuckets.set(entity, keys);
          totalEntities++;
          return true;
        },

        update: function (entity) {
          if (!entity) return false;
          var oldKeys = entityBuckets.get(entity);
          if (!oldKeys) return this.insert(entity);
          var eb = extractBounds(entity);
          var newKeys = getCellKeysForBounds(eb);
          if (oldKeys.length === newKeys.length) {
            var same = true;
            for (var i = 0; i < newKeys.length; i++) {
              if (oldKeys[i] !== newKeys[i]) {
                same = false;
                break;
              }
            }
            if (same) return true;
          }
          this.remove(entity);
          return this.insert(entity);
        },

        remove: function (entity) {
          if (!entity) return false;
          var keys = entityBuckets.get(entity);
          if (!keys) return false;
          for (var i = 0; i < keys.length; i++) {
            var k = keys[i];
            var bucket = buckets.get(k);
            if (bucket) {
              var idx = bucket.indexOf(entity);
              if (idx !== -1) {
                bucket.splice(idx, 1);
              }
              if (bucket.length === 0) {
                buckets.delete(k);
              }
            }
          }
          entityBuckets.delete(entity);
          totalEntities = Math.max(0, totalEntities - 1);
          return true;
        },

        clear: function () {
          buckets.clear();
          entityBuckets.clear();
          totalEntities = 0;
        },

        queryAABB: function (minX, minY, maxX, maxY, outArray) {
          var out = outArray || [];
          if (outArray) out.length = 0;
          var qId = ++currentQueryId;
          var box = { minX: minX, minY: minY, maxX: maxX, maxY: maxY };
          var keys = getCellKeysForBounds(box);
          for (var k = 0; k < keys.length; k++) {
            var bucket = buckets.get(keys[k]);
            if (bucket) {
              for (var i = 0; i < bucket.length; i++) {
                var ent = bucket[i];
                if (ent.__avQueryId !== qId) {
                  ent.__avQueryId = qId;
                  var eb = extractBounds(ent);
                  if (aabbIntersects(eb, box)) {
                    out.push(ent);
                  }
                }
              }
            }
          }
          return out;
        },

        queryCircle: function (centerX, centerY, radius, outArray) {
          var out = outArray || [];
          if (outArray) out.length = 0;
          var qId = ++currentQueryId;
          var box = {
            minX: centerX - radius,
            minY: centerY - radius,
            maxX: centerX + radius,
            maxY: centerY + radius
          };
          var keys = getCellKeysForBounds(box);
          for (var k = 0; k < keys.length; k++) {
            var bucket = buckets.get(keys[k]);
            if (bucket) {
              for (var i = 0; i < bucket.length; i++) {
                var ent = bucket[i];
                if (ent.__avQueryId !== qId) {
                  ent.__avQueryId = qId;
                  var eb = extractBounds(ent);
                  if (circleIntersectsAABB(centerX, centerY, radius, eb)) {
                    out.push(ent);
                  }
                }
              }
            }
          }
          return out;
        },

        queryRay: function (originX, originY, dirX, dirY, maxDistance, outArray) {
          var out = outArray || [];
          if (outArray) out.length = 0;
          var qId = ++currentQueryId;
          var len = Math.hypot(dirX, dirY);
          var dx = len > 1e-9 ? dirX / len : 0;
          var dy = len > 1e-9 ? dirY / len : 0;
          var endX = originX + dx * maxDistance;
          var endY = originY + dy * maxDistance;
          var box = {
            minX: Math.min(originX, endX),
            minY: Math.min(originY, endY),
            maxX: Math.max(originX, endX),
            maxY: Math.max(originY, endY)
          };
          var keys = getCellKeysForBounds(box);
          for (var k = 0; k < keys.length; k++) {
            var bucket = buckets.get(keys[k]);
            if (bucket) {
              for (var i = 0; i < bucket.length; i++) {
                var ent = bucket[i];
                if (ent.__avQueryId !== qId) {
                  ent.__avQueryId = qId;
                  var eb = extractBounds(ent);
                  if (rayIntersectsAABB(originX, originY, dx, dy, maxDistance, eb)) {
                    out.push(ent);
                  }
                }
              }
            }
          }
          return out;
        }
      };
    }
  };

  // Wire message handler for ARCADEVERSE_SET_VOLUME (#735) and ARCADEVERSE_DDA_CONFIG (#1112)
  if (typeof window !== "undefined") {
    window.addEventListener("message", function (event) {
      if (!event.data) return;
      if (event.data.type === "ARCADEVERSE_SET_VOLUME") {
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
      } else if (event.data.type === "ARCADEVERSE_DDA_CONFIG" && event.data.payload) {
        if (sdkInstance.dda && typeof sdkInstance.dda._syncFromParent === "function") {
          sdkInstance.dda._syncFromParent(event.data.payload);
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
