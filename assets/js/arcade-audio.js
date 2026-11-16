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

  function createNoiseBuffer(ctx, durationSec) {
    var bufferSize = Math.floor(ctx.sampleRate * (durationSec || 0.25));
    var buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    var output = buffer.getChannelData(0);
    for (var i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
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
     * Deep arcade explosion: Noise buffer with lowpass resonant sweep
     */
    playExplosion: function () {
      var ctx = getContext();
      if (!ctx || isMuted) return;

      var now = ctx.currentTime;
      var duration = 0.45;
      var noiseBuffer = createNoiseBuffer(ctx, duration);
      var noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;

      var filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, now);
      filter.frequency.linearRampToValueAtTime(40, now + duration);

      var gain = ctx.createGain();
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

      noiseSource.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain || ctx.destination);

      noiseSource.start(now);
      noiseSource.stop(now + duration);
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
    }
    }
  };

  return ArcadeAudio;
});
