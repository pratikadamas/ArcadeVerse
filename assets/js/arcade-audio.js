/**
 * ArcadeVerse Zero-Dependency Retro Chiptune Synthesizer Engine (#510)
 * Lightweight procedural 8-bit sound effects utility using native Web Audio API
 * Generates classic arcade SFX (jump, laser, hit, explosion, coin, powerup) without external MP3/WAV assets
 * Author: Babin Bid (@Babin123456)
 * Open Source for ArcadeVerse - NSOC Winter Edition 2026
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ArcadeAudio = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var audioCtx = null;
  var masterGain = null;
  var isMuted = false;
  var volume = 0.3;

  function getContext() {
    if (!audioCtx) {
      var AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      audioCtx = new AudioContextClass();
      masterGain = audioCtx.createGain();
      masterGain.gain.setValueAtTime(isMuted ? 0 : volume, audioCtx.currentTime);
      masterGain.connect(audioCtx.destination);
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(function () {});
    }
    return audioCtx;
  }

  /**
   * Procedural Multi-Curve Noise Buffer Synthesizer (#701, #724)
   * Produces White, Pink (1/f), and Brownian (1/f^2) noise buffers without external audio assets.
   * Supports polymorphic signatures: (type, duration, customCtx) or (ctx, duration, type).
   * @param {string|AudioContext} type - Noise curve name ('white', 'pink', 'brownian') or AudioContext
   * @param {number|string} [duration=0.25] - Duration in seconds or noise type
   * @param {AudioContext|string} [customCtx] - AudioContext or noise type
   * @returns {AudioBuffer|null}
   */
  function createNoiseBuffer(type, duration, customCtx) {
    var ctx;
    var noiseType = 'white';
    var dur = 0.25;

    // Polymorphic signature handling:
    // Signature A: createNoiseBuffer(ctx, duration, type)
    if (type && typeof type === 'object' && typeof type.createBuffer === 'function') {
      ctx = type;
      if (typeof duration === 'string') {
        noiseType = duration.toLowerCase();
        dur = Number(customCtx) || 0.25;
      } else {
        dur = Number(duration) || 0.25;
        noiseType = typeof customCtx === 'string' ? customCtx.toLowerCase() : 'white';
      }
    } else {
      // Signature B: createNoiseBuffer(type, duration, customCtx)
      if (typeof type === 'string') {
        noiseType = type.toLowerCase();
      }
      dur = Number(duration) || 0.25;
      ctx = customCtx || getContext();
    }

    if (!ctx) return null;

    var sampleRate = ctx.sampleRate || 44100;
    var bufferSize = Math.max(1, Math.floor(sampleRate * dur));
    var buffer = ctx.createBuffer(1, bufferSize, sampleRate);
    var output = buffer.getChannelData(0);

    if (noiseType === 'pink') {
      // Paul Kellet's refined 7-pole 1/f Pink Noise algorithm
      var b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (var i = 0; i < bufferSize; i++) {
        var white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }
    } else if (noiseType === 'brown' || noiseType === 'brownian' || noiseType === 'red') {
      // Brownian / Red Noise (1/f^2) algorithm with leaky integrator
      var lastOut = 0.0;
      for (var j = 0; j < bufferSize; j++) {
        var w = Math.random() * 2 - 1;
        output[j] = (lastOut + (0.02 * w)) / 1.02;
        lastOut = output[j];
        output[j] *= 3.5; // Compensate for integration roll-off
      }
    } else {
      // White Noise (uniform flat distribution)
      for (var k = 0; k < bufferSize; k++) {
        output[k] = Math.random() * 2 - 1;
      }
    }

    return buffer;
  }

  var ArcadeAudio = {
    /**
     * Initializes or assigns a shared AudioContext instance
     * @param {AudioContext} [customCtx]
     */
    init: function (customCtx) {
      if (customCtx) {
        audioCtx = customCtx;
        masterGain = audioCtx.createGain();
        masterGain.gain.setValueAtTime(isMuted ? 0 : volume, audioCtx.currentTime);
        masterGain.connect(audioCtx.destination);
      } else {
        getContext();
      }
      return this;
    },

    setVolume: function (vol) {
      volume = Math.max(0, Math.min(1, Number(vol) || 0));
      if (masterGain && audioCtx) {
        masterGain.gain.setValueAtTime(isMuted ? 0 : volume, audioCtx.currentTime);
      }
    },

    setMuted: function (muted) {
      isMuted = !!muted;
      if (masterGain && audioCtx) {
        masterGain.gain.setValueAtTime(isMuted ? 0 : volume, audioCtx.currentTime);
      }
    },

    /**
     * Classic 8-bit Mario/Sonic jump sound: Fast frequency upward ramp
     */
    playJump: function () {
      var ctx = getContext();
      if (!ctx || isMuted) return;

      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      var now = ctx.currentTime;

      osc.type = 'square';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(620, now + 0.14);

      gain.gain.setValueAtTime(0.24, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.14);

      osc.connect(gain);
      gain.connect(masterGain || ctx.destination);

      osc.start(now);
      osc.stop(now + 0.14);
    },

    /**
     * High-speed sci-fi laser shot: Rapid descending pitch sweep
     */
    playLaser: function () {
      var ctx = getContext();
      if (!ctx || isMuted) return;

      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      var now = ctx.currentTime;

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.12);

      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(masterGain || ctx.destination);

      osc.start(now);
      osc.stop(now + 0.12);
    },

    /**
     * Retro collision or damage hit: Low frequency crunch
     */
    playHit: function () {
      var ctx = getContext();
      if (!ctx || isMuted) return;

      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      var now = ctx.currentTime;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.1);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.1);

      osc.connect(gain);
      gain.connect(masterGain || ctx.destination);

      osc.start(now);
      osc.stop(now + 0.1);
    },

    /**
     * Crisp two-tone coin or collectible pickup chime
     */
    playCoin: function () {
      var ctx = getContext();
      if (!ctx || isMuted) return;

      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      var now = ctx.currentTime;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(987.77, now); // B5 note
      osc.frequency.setValueAtTime(1318.51, now + 0.08); // E6 note

      gain.gain.setValueAtTime(0.26, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

      osc.connect(gain);
      gain.connect(masterGain || ctx.destination);

      osc.start(now);
      osc.stop(now + 0.32);
    },

    /**
     * Deep arcade explosion: Filtered brownian/pink noise buffer with resonant lowpass sweep
     * @param {Object} [options] - Configuration { type, duration, volume, startFreq, endFreq, Q }
     * @returns {AudioBufferSourceNode|undefined}
     */
    playExplosion: function (options) {
      var ctx = getContext();
      if (!ctx || isMuted) return;

      options = options || {};
      var now = ctx.currentTime;
      var duration = options.duration || 0.5;
      var noiseType = options.type || 'brownian';
      var noiseBuffer = createNoiseBuffer(noiseType, duration, ctx);
      if (!noiseBuffer) return;

      var noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;

      if (typeof this.requestVoice === 'function' && !this.requestVoice('critical', noiseSource)) {
        return;
      }

      var filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      var startFreq = options.startFreq || 850;
      var endFreq = options.endFreq || 35;
      filter.frequency.setValueAtTime(startFreq, now);
      filter.frequency.exponentialRampToValueAtTime(endFreq, now + duration);
      filter.Q.setValueAtTime(options.Q !== undefined ? options.Q : 3.5, now);

      var gain = ctx.createGain();
      var vol = options.volume !== undefined ? options.volume : 0.35;
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      noiseSource.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain || ctx.destination);

      // Memory cleanup on sound node termination (#701, #724)
      noiseSource.onended = function () {
        try {
          noiseSource.disconnect();
          filter.disconnect();
          gain.disconnect();
        } catch (_) {}
      };

      noiseSource.start(now);
      noiseSource.stop(now + duration);
      return noiseSource;
    },

    /**
     * Punchy retro blast / energy shockwave impact using pink noise
     * @param {Object} [options] - Configuration { type, duration, volume }
     * @returns {AudioBufferSourceNode|undefined}
     */
    playBlast: function (options) {
      var ctx = getContext();
      if (!ctx || isMuted) return;

      options = options || {};
      var now = ctx.currentTime;
      var duration = options.duration || 0.35;
      var noiseType = options.type || 'pink';
      var noiseBuffer = createNoiseBuffer(noiseType, duration, ctx);
      if (!noiseBuffer) return;

      var noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;

      if (typeof this.requestVoice === 'function' && !this.requestVoice('medium', noiseSource)) {
        return;
      }

      var filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, now);
      filter.frequency.exponentialRampToValueAtTime(70, now + duration);
      filter.Q.setValueAtTime(2.5, now);

      var gain = ctx.createGain();
      var vol = options.volume !== undefined ? options.volume : 0.3;
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      noiseSource.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain || ctx.destination);

      // Memory cleanup on sound node termination (#701, #724)
      noiseSource.onended = function () {
        try {
          noiseSource.disconnect();
          filter.disconnect();
          gain.disconnect();
        } catch (_) {}
      };

      noiseSource.start(now);
      noiseSource.stop(now + duration);
      return noiseSource;
    },

    /**
     * Procedural retro engine drone / thruster hum using filtered brownian noise
     * @param {number} [duration=1.0] - Duration in seconds, or 0 / Infinity for sustained loop
     * @param {Object} [options] - Configuration { type, cutoff, volume, loop, Q }
     * @returns {Object|null} Sound controller with stop() method
     */
    playEngineHum: function (duration, options) {
      var ctx = getContext();
      if (!ctx || isMuted) return null;

      if (typeof duration === 'object') {
        options = duration;
        duration = 1.0;
      }
      options = options || {};
      var dur = duration !== undefined ? duration : 1.0;
      var isLoop = dur === 0 || dur === Infinity || options.loop === true;
      var bufferDur = isLoop ? 2.0 : Math.max(0.2, dur);
      var now = ctx.currentTime;

      var noiseType = options.type || 'brownian';
      var noiseBuffer = createNoiseBuffer(noiseType, bufferDur, ctx);
      if (!noiseBuffer) return null;

      var noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      noiseSource.loop = isLoop;

      if (typeof this.requestVoice === 'function' && !this.requestVoice('low', noiseSource)) {
        return null;
      }

      // Resonant Lowpass filter to sculpt deep engine rumble
      var filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      var cutoff = options.cutoff || 150;
      filter.frequency.setValueAtTime(cutoff, now);
      filter.Q.setValueAtTime(options.Q !== undefined ? options.Q : 3.0, now);

      var gain = ctx.createGain();
      var targetVol = options.volume !== undefined ? options.volume : 0.25;
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(targetVol, now + 0.08);

      if (!isLoop) {
        gain.gain.setValueAtTime(targetVol, now + dur - 0.1);
        gain.gain.linearRampToValueAtTime(0.001, now + dur);
      }

      noiseSource.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain || ctx.destination);

      function cleanup() {
        try {
          noiseSource.disconnect();
          filter.disconnect();
          gain.disconnect();
        } catch (_) {}
      }

      noiseSource.onended = cleanup;

      noiseSource.start(now);
      if (!isLoop) {
        noiseSource.stop(now + dur);
      }

      return {
        source: noiseSource,
        filter: filter,
        gain: gain,
        stop: function (fadeMs) {
          var fadeTime = (fadeMs || 80) / 1000;
          var stopNow = ctx.currentTime;
          try {
            gain.gain.cancelScheduledValues(stopNow);
            gain.gain.setValueAtTime(gain.gain.value, stopNow);
            gain.gain.linearRampToValueAtTime(0.001, stopNow + fadeTime);
            setTimeout(function () {
              try { noiseSource.stop(); } catch (_) {}
              cleanup();
            }, (fadeTime * 1000) + 20);
          } catch (_) {
            cleanup();
          }
        }
      };
    },

    /**
     * Atmospheric ambient wind / thruster airflow using swept bandpass pink noise
     * @param {number} [duration=1.2] - Duration in seconds
     * @param {Object} [options] - Configuration { type, volume, minFreq, maxFreq }
     * @returns {Object|null} Sound controller with stop() method
     */
    playWind: function (duration, options) {
      var ctx = getContext();
      if (!ctx || isMuted) return null;

      if (typeof duration === 'object') {
        options = duration;
        duration = 1.2;
      }
      options = options || {};
      var dur = duration || 1.2;
      var now = ctx.currentTime;
      var noiseType = options.type || 'pink';
      var noiseBuffer = createNoiseBuffer(noiseType, dur, ctx);
      if (!noiseBuffer) return null;

      var noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;

      if (typeof this.requestVoice === 'function' && !this.requestVoice('low', noiseSource)) {
        return null;
      }

      var filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      var minFreq = options.minFreq || 350;
      var maxFreq = options.maxFreq || 750;
      filter.frequency.setValueAtTime(minFreq, now);
      filter.frequency.exponentialRampToValueAtTime(maxFreq, now + dur * 0.5);
      filter.frequency.exponentialRampToValueAtTime(minFreq, now + dur);
      filter.Q.setValueAtTime(1.8, now);

      var gain = ctx.createGain();
      var targetVol = options.volume !== undefined ? options.volume : 0.2;
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(targetVol, now + dur * 0.3);
      gain.gain.linearRampToValueAtTime(0.001, now + dur);

      noiseSource.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain || ctx.destination);

      function cleanup() {
        try {
          noiseSource.disconnect();
          filter.disconnect();
          gain.disconnect();
        } catch (_) {}
      }

      noiseSource.onended = cleanup;

      noiseSource.start(now);
      noiseSource.stop(now + dur);

      return {
        source: noiseSource,
        filter: filter,
        gain: gain,
        stop: function () {
          try { noiseSource.stop(); } catch (_) {}
          cleanup();
        }
      };
    },

    /**
     * Harmonious multi-step powerup arpeggio
     */
    playPowerup: function () {
      var ctx = getContext();
      if (!ctx || isMuted) return;

      var notes = [330, 392, 494, 659]; // E4, G4, B4, E5
      var now = ctx.currentTime;

      notes.forEach(function (freq, index) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        var startTime = now + (index * 0.06);

        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.18, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.15);

        osc.connect(gain);
        gain.connect(masterGain || ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.15);
      });
    },

    /**
     * Retro Game Over defeat jingle
     */
    playGameOver: function () {
      var ctx = getContext();
      if (!ctx || isMuted) return;

      var notes = [440, 415.3, 392, 349.2]; // A4, G#4, G4, F4
      var now = ctx.currentTime;

      notes.forEach(function (freq, index) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        var startTime = now + (index * 0.12);

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.2, startTime);
        gain.gain.linearRampToValueAtTime(0.01, startTime + 0.18);

        osc.connect(gain);
        gain.connect(masterGain || ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.18);
      });
    },

    /**
     * Victory fanfare chord
     */
    playVictory: function () {
      var ctx = getContext();
      if (!ctx || isMuted) return;

      var chords = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      var now = ctx.currentTime;

      chords.forEach(function (freq) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

        osc.connect(gain);
        gain.connect(masterGain || ctx.destination);

        osc.start(now);
        osc.stop(now + 0.6);
      });
    },

    // ========================================================
    // DYNAMIC AUDIO DUCKING CONTROLLER (#567)
    // Side-chain attenuates background music during loud SFX (explosions, jumps, impacts)
    // ========================================================
    /**
     * Dynamically ducks (temporarily lowers) target music GainNode during punchy SFX.
     * @param {GainNode} musicGainNode - The music gain node to duck
     * @param {number} [duckAmount=0.35] - Attenuation factor (0.35 = -9dB reduction)
     * @param {number} [holdMs=250] - Duration in ms before restoring volume
     * @param {number} [rampMs=180] - Smoothing ramp duration in ms
     */
    duckMusic: function (musicGainNode, duckAmount, holdMs, rampMs) {
      if (!musicGainNode || !musicGainNode.gain) return;
      var ctx = getContext();
      if (!ctx) return;

      var now = ctx.currentTime;
      var factor = duckAmount !== undefined ? duckAmount : 0.35;
      var hold = (holdMs || 250) / 1000;
      var ramp = (rampMs || 180) / 1000;

      var currentVal = musicGainNode.gain.value;
      musicGainNode.gain.cancelScheduledValues(now);
      musicGainNode.gain.setValueAtTime(currentVal, now);
      // Fast attack (25ms)
      musicGainNode.gain.linearRampToValueAtTime(currentVal * factor, now + 0.025);
      // Hold then smooth release back to original level
      musicGainNode.gain.setValueAtTime(currentVal * factor, now + 0.025 + hold);
      musicGainNode.gain.linearRampToValueAtTime(currentVal, now + 0.025 + hold + ramp);
    },

    // ========================================================
    // SOUND EFFECT PRIORITY QUEUING & VOICE STEALER (#571)
    // Eliminates voice starvation: Critical (Damage, GameOver) > Medium > Low
    // ========================================================
    MAX_CONCURRENT_VOICES: 8,
    _activeVoices: [],

    /**
     * Allocates a voice slot according to priority rank
     * @param {string} priority - 'critical', 'medium', or 'low'
     * @param {AudioNode} [sourceNode] - Optional audio source node for voice stealing
     * @returns {boolean} Whether the sound is permitted to play
     */
    requestVoice: function (priority, sourceNode) {
      priority = (priority || 'medium').toLowerCase();
      var priorityRank = { critical: 3, medium: 2, low: 1 }[priority] || 2;
      var now = Date.now();

      // Clean finished voices
      this._activeVoices = this._activeVoices.filter(function (v) {
        return v.expiresAt > now;
      });

      if (this._activeVoices.length < this.MAX_CONCURRENT_VOICES) {
        this._activeVoices.push({
          rank: priorityRank,
          node: sourceNode,
          expiresAt: now + 1200
        });
        return true;
      }

      // Voice pool is full: search for lowest priority voice to steal
      var lowestIndex = -1;
      var lowestRank = priorityRank;

      for (var i = 0; i < this._activeVoices.length; i++) {
        if (this._activeVoices[i].rank < lowestRank) {
          lowestRank = this._activeVoices[i].rank;
          lowestIndex = i;
        }
      }

      if (lowestIndex !== -1) {
        // Voice stealer drops lowest priority ambient sound to guarantee critical cue
        var stolen = this._activeVoices.splice(lowestIndex, 1)[0];
        if (stolen.node && typeof stolen.node.stop === 'function') {
          try {
            stolen.node.stop();
          } catch (_) {}
        }
        this._activeVoices.push({
          rank: priorityRank,
          node: sourceNode,
          expiresAt: now + 1200
        });
        return true;
      }

      // If requested voice is lowest priority and no lower voices exist, drop it
      return priorityRank >= 3;
    },

    // ========================================================
    // RETRO 5-BAND BIQUADFILTER AUDIO EQUALIZER (#570)
    // 60Hz, 250Hz, 1kHz, 4kHz, 12kHz Equalizer Chain with Presets
    // ========================================================
    _eqNodes: null,
    _currentPreset: 'arcade',

    initEqualizer: function () {
      var ctx = getContext();
      if (!ctx || this._eqNodes) return this._eqNodes;

      var freqs = [60, 250, 1000, 4000, 12000];
      var types = ['lowshelf', 'peaking', 'peaking', 'peaking', 'highshelf'];
      var nodes = [];

      for (var i = 0; i < freqs.length; i++) {
        var filter = ctx.createBiquadFilter();
        filter.type = types[i];
        filter.frequency.value = freqs[i];
        filter.gain.value = 0;
        if (types[i] === 'peaking') filter.Q.value = 1.0;
        nodes.push(filter);
      }

      // Chain filters
      for (var j = 0; j < nodes.length - 1; j++) {
        nodes[j].connect(nodes[j + 1]);
      }

      this._eqNodes = nodes;

      // Re-route masterGain through EQ chain before destination
      try {
        if (masterGain) {
          masterGain.disconnect();
          masterGain.connect(nodes[0]);
          nodes[nodes.length - 1].connect(ctx.destination);
        }
      } catch (_) {}

      // Load saved preset
      try {
        var saved = localStorage.getItem('arcadeverse_eq_preset') || 'arcade';
        this.setPreset(saved);
      } catch (_) {
        this.setPreset('arcade');
      }

      return nodes;
    },

    setPreset: function (presetName) {
      this._currentPreset = presetName || 'arcade';
      try {
        localStorage.setItem('arcadeverse_eq_preset', this._currentPreset);
      } catch (_) {}

      if (!this._eqNodes) {
        this.initEqualizer();
      }
      if (!this._eqNodes) return;

      // Gains: [60Hz, 250Hz, 1kHz, 4kHz, 12kHz]
      var gains = [0, 0, 0, 0, 0];
      switch (this._currentPreset) {
        case 'warm':
          // Warm Cabinet (Boosted Mids, trimmed high piercing hiss)
          gains = [3, 5, 4, 1, -4];
          break;
        case 'lofi':
          // 8-Bit Lo-Fi (Low-pass filtered, rolled-off crisp top)
          gains = [2, 3, 2, -6, -12];
          break;
        case 'bass':
          // Bass Boost
          gains = [8, 5, 1, 0, 1];
          break;
        case 'arcade':
        default:
          // Default Arcade Flat
          gains = [0, 0, 0, 0, 0];
          break;
      }

      var ctx = getContext();
      var now = ctx ? ctx.currentTime : 0;
      for (var k = 0; k < this._eqNodes.length; k++) {
        if (this._eqNodes[k] && this._eqNodes[k].gain) {
          this._eqNodes[k].gain.setValueAtTime(gains[k], now);
        }
      }
    },

    getPreset: function () {
      return this._currentPreset;
    },

    /**
     * Procedural Noise Buffer Factory (#701, #724)
     * Generates native AudioBuffer containing white, pink (1/f), or brownian (1/f^2) noise.
     * @param {string} [type='white'] - Noise spectral curve: 'white', 'pink', 'brownian' (or 'brown' / 'red')
     * @param {number} [duration=0.25] - Buffer duration in seconds
     * @param {AudioContext} [customCtx] - Optional AudioContext instance
     * @returns {AudioBuffer|null}
     */
    createNoiseBuffer: function (type, duration, customCtx) {
      return createNoiseBuffer(type, duration, customCtx);
    }
  };

  return ArcadeAudio;
});
