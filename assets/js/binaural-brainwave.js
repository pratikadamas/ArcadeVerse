/**
 * BinauralBrainwaveSynchronizer - Web Audio Binaural Beat & Isochronic Tone Brainwave Synchronizer
 * 
 * Generates precision stereophonic frequency offset pairs (e.g. 432 Hz Left, 442 Hz Right -> 10 Hz Alpha)
 * and sharp rhythmic isochronic pulse modulation (Alpha: 8-12Hz, Beta: 13-30Hz, Theta: 4-7Hz, Delta: 0.5-4Hz)
 * to induce flow state and focus during intense arcade sessions.
 */

class BinauralBrainwaveSynchronizer {
  constructor(audioContext = null, options = {}) {
    this.ctx = audioContext;
    this.baseFrequency = options.baseFrequency || 432; // Hz
    this.beatFrequency = options.beatFrequency || 10; // 10 Hz Alpha wave
    this.mode = options.mode || 'binaural'; // 'binaural' or 'isochronic'
    this.volume = options.volume !== undefined ? options.volume : 0.06; // -24dB background level
    this.active = false;

    this.leftOsc = null;
    this.rightOsc = null;
    this.isochronicOsc = null;
    this.pulseGain = null;
    this.masterGain = null;
  }

  ensureContext() {
    if (!this.ctx && typeof AudioContext !== 'undefined') {
      this.ctx = new AudioContext();
    } else if (!this.ctx && typeof webkitAudioContext !== 'undefined') {
      this.ctx = new webkitAudioContext();
    }
    return this.ctx;
  }

  setBeatFrequency(hz) {
    this.beatFrequency = Math.max(0.5, Math.min(40, hz));
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    if (this.rightOsc) {
      this.rightOsc.frequency.setTargetAtTime(this.baseFrequency + this.beatFrequency, now, 0.05);
    }
    if (this.pulseGain && this.isochronicOsc) {
      this.isochronicOsc.frequency.setTargetAtTime(this.beatFrequency, now, 0.05);
    }
  }

  setBaseFrequency(hz) {
    this.baseFrequency = Math.max(60, Math.min(1000, hz));
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (this.leftOsc) {
      this.leftOsc.frequency.setTargetAtTime(this.baseFrequency, now, 0.05);
    }
    if (this.rightOsc) {
      this.rightOsc.frequency.setTargetAtTime(this.baseFrequency + this.beatFrequency, now, 0.05);
    }
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(0.5, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    }
  }

  start() {
    const ctx = this.ensureContext();
    if (!ctx || this.active) return;
    const now = ctx.currentTime;

    this.masterGain = ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.volume, now);
    this.masterGain.connect(ctx.destination);

    if (this.mode === 'binaural') {
      const merger = ctx.createChannelMerger(2);

      this.leftOsc = ctx.createOscillator();
      this.leftOsc.type = 'sine';
      this.leftOsc.frequency.setValueAtTime(this.baseFrequency, now);

      this.rightOsc = ctx.createOscillator();
      this.rightOsc.type = 'sine';
      this.rightOsc.frequency.setValueAtTime(this.baseFrequency + this.beatFrequency, now);

      this.leftOsc.connect(merger, 0, 0); // Left ear
      this.rightOsc.connect(merger, 0, 1); // Right ear

      merger.connect(this.masterGain);

      this.leftOsc.start(now);
      this.rightOsc.start(now);
    } else {
      // Isochronic sharp pulse modulation
      this.leftOsc = ctx.createOscillator();
      this.leftOsc.type = 'sine';
      this.leftOsc.frequency.setValueAtTime(this.baseFrequency, now);

      this.pulseGain = ctx.createGain();
      this.pulseGain.gain.setValueAtTime(0.5, now);

      this.isochronicOsc = ctx.createOscillator();
      this.isochronicOsc.type = 'square';
      this.isochronicOsc.frequency.setValueAtTime(this.beatFrequency, now);

      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(0.5, now);

      this.isochronicOsc.connect(lfoGain);
      lfoGain.connect(this.pulseGain.gain);

      this.leftOsc.connect(this.pulseGain);
      this.pulseGain.connect(this.masterGain);

      this.leftOsc.start(now);
      this.isochronicOsc.start(now);
    }

    this.active = true;
  }

  stop() {
    if (!this.active) return;
    try {
      if (this.leftOsc) this.leftOsc.stop();
      if (this.rightOsc) this.rightOsc.stop();
      if (this.isochronicOsc) this.isochronicOsc.stop();
    } catch (_) {}

    this.leftOsc = null;
    this.rightOsc = null;
    this.isochronicOsc = null;
    this.active = false;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BinauralBrainwaveSynchronizer };
}
