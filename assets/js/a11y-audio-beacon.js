/**
 * ArcadeVerse - Universal Spatial Audio Beacon & Stereo Sonification Engine
 * Architectural Implementation for Issue #1101
 *
 * Provides real-time 3D binaural spatial sound guidance for blind and visually
 * impaired players across 2D arcade games:
 * - StereoPannerNode & BiquadFilterNode spatial acoustic localization.
 * - Horizontal stereo pan mapping (-1.0 Hard Left to +1.0 Hard Right).
 * - Vertical pitch modulation (200Hz bottom of screen to 1200Hz top of screen).
 * - Proximity Hazard Radar with accelerating pulse tempo near screen edges/obstacles.
 * - Entity sonification signatures for coins, hazards, beacons, walls, and goals.
 * - Accessible keyboard shortcut (Alt + B) with screen reader confirmation.
 * - Pure Vanilla JS Web Audio API; zero external audio samples or libraries.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ArcadeAudioBeacon = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var STORAGE_KEY = 'arcadeverse_a11y_audio_beacon';
  var VOLUME_KEY = 'arcadeverse_a11y_audio_beacon_volume';

  var isEnabled = false;
  var masterVolume = 0.12; // Calibrated volume to prevent auditory fatigue
  var radarEnabled = true;
  var audioCtx = null;
  var masterGainNode = null;

  var lastPlayerPos = { x: 0.5, y: 0.5 };
  var activeViewport = { width: 800, height: 600 };
  var trackedHazards = [];
  var radarTimerId = null;
  var isRadarRunning = false;

  // Initialize persistence from localStorage
  try {
    if (typeof localStorage !== 'undefined') {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved !== null) {
        isEnabled = saved === 'true';
      }
      var savedVol = parseFloat(localStorage.getItem(VOLUME_KEY));
      if (!isNaN(savedVol) && savedVol >= 0 && savedVol <= 1) {
        masterVolume = savedVol;
      }
    }
  } catch (_) {}

  /**
   * Lazily initializes or returns the shared AudioContext instance.
   */
  function getAudioContext() {
    if (audioCtx) {
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(function () {});
      }
      return audioCtx;
    }

    if (typeof window !== 'undefined') {
      var AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        try {
          audioCtx = new AudioContextClass();
          masterGainNode = audioCtx.createGain();
          masterGainNode.gain.setValueAtTime(masterVolume, audioCtx.currentTime);
          masterGainNode.connect(audioCtx.destination);
        } catch (e) {
          audioCtx = null;
        }
      }
    }
    return audioCtx;
  }

  /**
   * Normalizes arbitrary coordinates into a [0.0, 1.0] range.
   *
   * @param {number} x - Horizontal position
   * @param {number} y - Vertical position
   * @param {Object} [bounds] - Optional dimension boundaries { width, height }
   * @returns {{ normX: number, normY: number }}
   */
  function normalizeCoordinates(x, y, bounds) {
    var w = (bounds && bounds.width) || activeViewport.width || 800;
    var h = (bounds && bounds.height) || activeViewport.height || 600;

    var numX = Number(x);
    var numY = Number(y);

    if (isNaN(numX)) numX = 0.5;
    if (isNaN(numY)) numY = 0.5;

    // If coordinates are already normalized between 0 and 1
    var normX = numX;
    var normY = numY;

    if (numX > 1.0 || (bounds && numX > 1.0)) {
      normX = numX / Math.max(1, w);
    }
    if (numY > 1.0 || (bounds && numY > 1.0)) {
      normY = numY / Math.max(1, h);
    }

    normX = Math.max(0.0, Math.min(1.0, normX));
    normY = Math.max(0.0, Math.min(1.0, normY));

    return {
      normX: normX,
      normY: normY
    };
  }

  /**
   * Calculates stereo pan value (-1.0 to +1.0) from normalized X coordinate.
   * 0.0 -> -1.0 (Hard Left)
   * 0.5 ->  0.0 (Center)
   * 1.0 -> +1.0 (Hard Right)
   *
   * @param {number} normX - Normalized horizontal position [0.0, 1.0]
   * @returns {number} Pan parameter clamped in [-1.0, +1.0]
   */
  function computePan(normX) {
    var numX = Number(normX);
    if (isNaN(numX)) numX = 0.5;
    var clampedX = Math.max(0.0, Math.min(1.0, numX));
    var pan = (clampedX * 2.0) - 1.0;
    return Math.round(pan * 1000) / 1000;
  }

  /**
   * Calculates pitch frequency (200Hz to 1200Hz) from normalized Y coordinate.
   * Top of screen (normY = 0.0) -> 1200Hz
   * Bottom of screen (normY = 1.0) -> 200Hz
   *
   * @param {number} normY - Normalized vertical position [0.0, 1.0]
   * @returns {number} Frequency in Hertz clamped in [200, 1200]
   */
  function computePitch(normY) {
    var numY = Number(normY);
    if (isNaN(numY)) numY = 0.5;
    var clampedY = Math.max(0.0, Math.min(1.0, numY));
    // 200Hz at bottom (normY = 1), 1200Hz at top (normY = 0)
    var freq = 200.0 + ((1.0 - clampedY) * 1000.0);
    return Math.round(freq * 10) / 10;
  }

  /**
   * Calculates proximity distance to nearest boundary or incoming hazard.
   *
   * @param {number} normX - Normalized horizontal player coordinate
   * @param {number} normY - Normalized vertical player coordinate
   * @param {Array} [hazards] - Optional array of active hazards [{x, y}]
   * @returns {{ distance: number, closestSide: string, hazardNear: boolean }}
   */
  function computeProximity(normX, normY, hazards) {
    var dLeft = normX;
    var dRight = 1.0 - normX;
    var dTop = normY;
    var dBottom = 1.0 - normY;

    var minBoundary = Math.min(dLeft, dRight, dTop, dBottom);
    var closestSide = 'center';
    if (minBoundary === dLeft) closestSide = 'left';
    else if (minBoundary === dRight) closestSide = 'right';
    else if (minBoundary === dTop) closestSide = 'top';
    else if (minBoundary === dBottom) closestSide = 'bottom';

    var minHazardDist = 1.0;
    var hazardList = hazards || trackedHazards || [];
    for (var i = 0; i < hazardList.length; i++) {
      var h = hazardList[i];
      if (h) {
        var hNorm = normalizeCoordinates(h.x, h.y, activeViewport);
        var dist = Math.sqrt(Math.pow(normX - hNorm.normX, 2) + Math.pow(normY - hNorm.normY, 2));
        if (dist < minHazardDist) {
          minHazardDist = dist;
        }
      }
    }

    var effectiveDist = Math.min(minBoundary, minHazardDist);
    return {
      distance: Math.max(0.0, Math.min(1.0, effectiveDist)),
      closestSide: closestSide,
      hazardNear: minHazardDist < minBoundary
    };
  }

  /**
   * Translates proximity distance into radar pulse interval (tempo).
   * Distance near 0.0 (danger) -> ~100ms rapid pulse tempo.
   * Distance >= 0.35 (safe center) -> ~900ms-1000ms calm cadence.
   *
   * @param {number} distance - Distance between 0.0 and 0.5
   * @returns {number} Interval in milliseconds
   */
  function computeRadarInterval(distance) {
    var d = Math.max(0.0, Math.min(0.5, distance));
    // Linear interpolation from 100ms at edge (0.0) to 1000ms at center (0.5)
    var interval = 100.0 + (d * 1800.0);
    return Math.round(Math.max(100, Math.min(1000, interval)));
  }

  /**
   * Synthesizes a spatial tone with stereo panning, biquad filtering, and gain envelope.
   *
   * @param {Object} params - Synthesis parameters
   * @param {number} params.frequency - Base frequency in Hz
   * @param {number} params.pan - Stereo pan value (-1.0 to 1.0)
   * @param {number} [params.duration=0.08] - Tone duration in seconds
   * @param {string} [params.wave='sine'] - Oscillator waveform
   * @param {number} [params.gain=0.15] - Voice gain scale
   * @param {number} [params.filterFreq=2000] - Biquad filter cutoff frequency
   * @param {string} [params.filterType='lowpass'] - Biquad filter type
   * @returns {boolean} True if tone was played successfully
   */
  function playSpatialTone(params) {
    if (!isEnabled) return false;

    var ctx = getAudioContext();
    if (!ctx) return false;

    try {
      var freq = Number(params.frequency) || 440;
      var panVal = Math.max(-1.0, Math.min(1.0, Number(params.pan) || 0.0));
      var duration = Math.max(0.01, Number(params.duration) || 0.08);
      var waveType = params.wave || 'sine';
      var voiceGain = Math.max(0.001, Math.min(1.0, Number(params.gain) || 0.15));
      var filterFreq = Number(params.filterFreq) || 2500;
      var filterType = params.filterType || 'lowpass';

      var now = ctx.currentTime;
      var osc = ctx.createOscillator();
      var gainNode = ctx.createGain();
      var filter = ctx.createBiquadFilter();

      osc.type = waveType;
      osc.frequency.setValueAtTime(freq, now);

      if (params.freqRamp) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, params.freqRamp), now + duration);
      }

      filter.type = filterType;
      filter.frequency.setValueAtTime(filterFreq, now);

      // Attack & Exponential Decay envelope
      gainNode.gain.setValueAtTime(0.0001, now);
      gainNode.gain.linearRampToValueAtTime(voiceGain, now + Math.min(0.015, duration * 0.2));
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(filter);
      filter.connect(gainNode);

      // Stereo Panner routing
      if (typeof ctx.createStereoPanner === 'function') {
        var panner = ctx.createStereoPanner();
        panner.pan.setValueAtTime(panVal, now);
        gainNode.connect(panner);
        panner.connect(masterGainNode || ctx.destination);
      } else {
        // Fallback directly to master
        gainNode.connect(masterGainNode || ctx.destination);
      }

      osc.start(now);
      osc.stop(now + duration + 0.02);

      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Produces an auditory spatial cue for specific 2D arcade entities.
   *
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {string} type - Entity type ('coin', 'hazard', 'beacon', 'wall', 'portal', 'powerup')
   * @param {Object} [options] - Custom override options
   * @returns {Object} Acoustic diagnostic report
   */
  function sonifyEntity(x, y, type, options) {
    options = options || {};
    var coords = normalizeCoordinates(x, y, options.bounds || activeViewport);
    var pan = computePan(coords.normX);
    var pitch = computePitch(coords.normY);
    var entityType = String(type || 'beacon').toLowerCase();

    var toneParams = {
      pan: pan,
      frequency: pitch,
      duration: 0.08,
      wave: 'sine',
      gain: 0.12,
      filterFreq: 2400
    };

    switch (entityType) {
      case 'coin':
      case 'collectible':
        // Bright pleasing chime
        toneParams.frequency = Math.max(600, pitch * 1.15);
        toneParams.freqRamp = toneParams.frequency * 1.4;
        toneParams.wave = 'triangle';
        toneParams.duration = 0.11;
        toneParams.gain = 0.14;
        toneParams.filterFreq = 3800;
        break;

      case 'hazard':
      case 'enemy':
        // Low buzzy warning tone
        toneParams.frequency = Math.min(320, Math.max(110, pitch * 0.4));
        toneParams.freqRamp = toneParams.frequency * 0.75;
        toneParams.wave = 'sawtooth';
        toneParams.duration = 0.14;
        toneParams.gain = 0.12;
        toneParams.filterFreq = 750;
        break;

      case 'wall':
      case 'boundary':
        // Percussive knock/thud
        toneParams.frequency = 140;
        toneParams.wave = 'square';
        toneParams.duration = 0.05;
        toneParams.gain = 0.10;
        toneParams.filterFreq = 500;
        break;

      case 'portal':
      case 'goal':
        // Shimmering vibrato arrival cue
        toneParams.frequency = Math.max(480, pitch * 0.9);
        toneParams.freqRamp = toneParams.frequency * 1.25;
        toneParams.wave = 'sine';
        toneParams.duration = 0.18;
        toneParams.gain = 0.15;
        toneParams.filterFreq = 3000;
        break;

      case 'powerup':
        // Bright energetic rising cue
        toneParams.frequency = 523.25;
        toneParams.freqRamp = 1046.5;
        toneParams.wave = 'triangle';
        toneParams.duration = 0.16;
        toneParams.gain = 0.15;
        toneParams.filterFreq = 4200;
        break;

      case 'beacon':
      case 'player':
      default:
        // Pure spatial locator beacon
        toneParams.frequency = pitch;
        toneParams.wave = 'sine';
        toneParams.duration = 0.07;
        toneParams.gain = 0.10;
        toneParams.filterFreq = 2200;
        break;
    }

    // Apply any explicit overrides
    if (options.frequency) toneParams.frequency = options.frequency;
    if (options.gain) toneParams.gain = options.gain;
    if (options.duration) toneParams.duration = options.duration;
    if (options.wave) toneParams.wave = options.wave;

    var played = playSpatialTone(toneParams);

    return {
      entityType: entityType,
      normX: coords.normX,
      normY: coords.normY,
      pan: pan,
      pitch: pitch,
      played: played
    };
  }

  /**
   * Updates player position and evaluates boundary/hazard radar.
   *
   * @param {number} x - Player X coordinate
   * @param {number} y - Player Y coordinate
   * @param {number} [w] - Viewport width
   * @param {number} [h] - Viewport height
   */
  function updatePlayerPosition(x, y, w, h) {
    if (w && h) {
      activeViewport.width = Number(w) || activeViewport.width;
      activeViewport.height = Number(h) || activeViewport.height;
    }

    var coords = normalizeCoordinates(x, y, activeViewport);
    lastPlayerPos.x = coords.normX;
    lastPlayerPos.y = coords.normY;

    if (isEnabled && radarEnabled && !isRadarRunning) {
      scheduleNextRadarPulse();
    }
  }

  /**
   * Schedules next proximity pulse according to current distance from hazards.
   */
  function scheduleNextRadarPulse() {
    if (!isEnabled || !radarEnabled) {
      isRadarRunning = false;
      return;
    }

    isRadarRunning = true;
    var proximity = computeProximity(lastPlayerPos.x, lastPlayerPos.y, trackedHazards);
    var interval = computeRadarInterval(proximity.distance);

    if (radarTimerId) {
      clearTimeout(radarTimerId);
    }

    radarTimerId = setTimeout(function () {
      if (!isEnabled || !radarEnabled) {
        isRadarRunning = false;
        return;
      }

      // Determine pan of the nearest boundary / obstacle
      var pulsePan = computePan(lastPlayerPos.x);
      if (proximity.closestSide === 'left') pulsePan = -0.85;
      else if (proximity.closestSide === 'right') pulsePan = 0.85;

      // Pulse frequency shifts higher when in close collision danger
      var pulsePitch = proximity.distance < 0.1 ? 660 : 380;
      var pulseGain = proximity.distance < 0.1 ? 0.08 : 0.035;

      playSpatialTone({
        frequency: pulsePitch,
        pan: pulsePan,
        duration: 0.045,
        wave: 'triangle',
        gain: pulseGain,
        filterFreq: 1800
      });

      scheduleNextRadarPulse();
    }, interval);
  }

  /**
   * Plays a distinct earcon confirming spatial audio beacon state change.
   * Rising tones on enable, falling tones on disable.
   *
   * @param {boolean} active - New enabled state
   */
  function playConfirmationEarcon(active) {
    var ctx = getAudioContext();
    if (!ctx) return;

    try {
      var now = ctx.currentTime;
      var osc1 = ctx.createOscillator();
      var osc2 = ctx.createOscillator();
      var g = ctx.createGain();

      osc1.type = 'triangle';
      osc2.type = 'sine';

      if (active) {
        // Rising chime
        osc1.frequency.setValueAtTime(440, now);
        osc1.frequency.exponentialRampToValueAtTime(880, now + 0.1);
        osc2.frequency.setValueAtTime(659, now + 0.08);
      } else {
        // Descending chime
        osc1.frequency.setValueAtTime(880, now);
        osc1.frequency.exponentialRampToValueAtTime(330, now + 0.12);
        osc2.frequency.setValueAtTime(440, now);
      }

      g.gain.setValueAtTime(0.01, now);
      g.gain.linearRampToValueAtTime(0.12, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

      osc1.connect(g);
      osc2.connect(g);
      g.connect(masterGainNode || ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.2);
      osc2.start(now);
      osc2.stop(now + 0.2);
    } catch (_) {}
  }

  /**
   * Sets the enabled state of the spatial audio sonification engine.
   *
   * @param {boolean} state - Desired enabled state
   * @param {boolean} [silent] - Omit speech announcement and earcon
   */
  function setEnabled(state, silent) {
    var target = Boolean(state);
    if (isEnabled === target && !silent) return;

    isEnabled = target;

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, isEnabled ? 'true' : 'false');
      }
    } catch (_) {}

    if (isEnabled) {
      getAudioContext();
      scheduleNextRadarPulse();
    } else {
      if (radarTimerId) {
        clearTimeout(radarTimerId);
        radarTimerId = null;
      }
      isRadarRunning = false;
    }

    if (!silent) {
      playConfirmationEarcon(isEnabled);

      var announcement = isEnabled
        ? 'Spatial audio beacon enabled. Stereo sonification and proximity radar active.'
        : 'Spatial audio beacon disabled.';

      // Verbal screen-reader announcement
      if (typeof window !== 'undefined') {
        if (typeof window.announceToScreenReader === 'function') {
          window.announceToScreenReader(announcement, 'assertive');
        } else if (window.ArcadeAnnouncer && typeof window.ArcadeAnnouncer.announce === 'function') {
          window.ArcadeAnnouncer.announce(isEnabled ? 'Spatial Audio Active' : 'Spatial Audio Off');
        }
      }
    }

    // Sync with accessibility drawer toggle switch if present
    if (typeof document !== 'undefined') {
      var checkbox = document.getElementById('a11y-opt-beacon') || document.getElementById('a11y-opt-audio-beacon');
      if (checkbox) checkbox.checked = isEnabled;

      var triggerBadge = document.getElementById('a11y-beacon-status-badge');
      if (triggerBadge) {
        triggerBadge.classList.toggle('active', isEnabled);
      }
    }

    // Dispatch global event for external reactive subscribers
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('arcadeverse:a11y-audio-beacon-changed', {
        detail: { enabled: isEnabled }
      }));
    }
  }

  /**
   * Toggles the audio sonification engine on/off.
   */
  function toggle() {
    setEnabled(!isEnabled);
    return isEnabled;
  }

  /**
   * Sets master audio beacon volume.
   *
   * @param {number} vol - Volume between 0.0 and 1.0
   */
  function setMasterVolume(vol) {
    var v = Math.max(0.0, Math.min(1.0, Number(vol) || 0.12));
    masterVolume = v;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(VOLUME_KEY, v.toString());
      }
    } catch (_) {}

    if (masterGainNode && audioCtx) {
      masterGainNode.gain.setValueAtTime(v, audioCtx.currentTime);
    }
  }

  /**
   * Updates the tracked hazards list for real-time proximity radar calculation.
   *
   * @param {Array<{x: number, y: number}>} hazards - Array of active hazard coordinates
   */
  function setHazards(hazards) {
    if (Array.isArray(hazards)) {
      trackedHazards = hazards;
    }
  }

  /**
   * Stops active proximity hazard radar pulse timers and clears hazards.
   */
  function stopRadar() {
    if (radarTimerId) {
      clearTimeout(radarTimerId);
      radarTimerId = null;
    }
    isRadarRunning = false;
    trackedHazards = [];
  }

  /**
   * Global keyboard shortcut listener for Alt + B.
   */
  function bindKeyboardShortcut() {
    if (typeof window === 'undefined') return;

    window.addEventListener('keydown', function (e) {
      // Alt + B (Option + B on macOS)
      if (e.altKey && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        toggle();
      }
    });

    // Handle cross-iframe bridge messages from child games
    window.addEventListener('message', function (e) {
      if (!e.data || typeof e.data !== 'object') return;

      if (e.data.type === 'ARCADEVERSE_A11Y_SONIFY') {
        sonifyEntity(e.data.x, e.data.y, e.data.entityType, e.data.options);
      } else if (e.data.type === 'ARCADEVERSE_A11Y_PLAYER_POS') {
        updatePlayerPosition(e.data.x, e.data.y, e.data.width, e.data.height);
      } else if (e.data.type === 'ARCADEVERSE_A11Y_SET_HAZARDS') {
        setHazards(e.data.hazards);
      }
    });

    // Pause radar when browser tab is inactive to preserve resources
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) {
          if (radarTimerId) {
            clearTimeout(radarTimerId);
            radarTimerId = null;
          }
          isRadarRunning = false;
        } else if (isEnabled && radarEnabled) {
          var modal = document.getElementById('game-modal');
          if (modal && (modal.classList.contains('active') || modal.classList.contains('open') || modal.style.display !== 'none')) {
            scheduleNextRadarPulse();
          }
        }
      });
    }
  }

  // Auto-bind shortcut on load if in browser
  if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bindKeyboardShortcut);
    } else {
      bindKeyboardShortcut();
    }
  }

  return {
    normalizeCoordinates: normalizeCoordinates,
    computePan: computePan,
    computePitch: computePitch,
    computeProximity: computeProximity,
    computeRadarInterval: computeRadarInterval,
    playSpatialTone: playSpatialTone,
    sonifyEntity: sonifyEntity,
    updatePlayerPosition: updatePlayerPosition,
    setHazards: setHazards,
    stopRadar: stopRadar,
    reset: stopRadar,
    setEnabled: setEnabled,
    isEnabled: function () { return isEnabled; },
    toggle: toggle,
    setMasterVolume: setMasterVolume,
    getMasterVolume: function () { return masterVolume; }
  };
});
