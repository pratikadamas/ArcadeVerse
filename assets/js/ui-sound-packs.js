/**
 * UISoundPacksEngine - Customizable UI Interaction Click Sound Packs with Zero-Asset Synthesis
 * 
 * Provides tactile, procedural zero-asset audio synthesis for button clicks, card hovers,
 * filter toggles, and modal dialogs using Web Audio API rapid exponential gain envelopes.
 * Presets: Arcade Relay, Cyber Beep, Bubble Pop.
 */

class UISoundPacksEngine {
  constructor(audioContext = null, options = {}) {
    this.ctx = audioContext;
    this.currentPack = options.pack || 'arcadeRelay'; // 'arcadeRelay', 'cyberBeep', 'bubblePop'
    this.muted = options.muted !== undefined ? options.muted : false;
    this.volume = options.volume !== undefined ? options.volume : 0.15;
  }

  ensureContext() {
    if (!this.ctx && typeof AudioContext !== 'undefined') {
      this.ctx = new AudioContext();
    } else if (!this.ctx && typeof webkitAudioContext !== 'undefined') {
      this.ctx = new webkitAudioContext();
    }
    return this.ctx;
  }

  setPack(packName) {
    if (['arcadeRelay', 'cyberBeep', 'bubblePop'].includes(packName)) {
      this.currentPack = packName;
    }
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1.0, vol));
  }

  playClick() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (this.currentPack === 'arcadeRelay') {
      // Mechanical solenoid click (short noise / bandpass pop)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.025);

      gain.gain.setValueAtTime(this.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.03);
    } else if (this.currentPack === 'cyberBeep') {
      // High-frequency micro-sine chirp (1760Hz)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1760, now);
      osc.frequency.setValueAtTime(880, now + 0.015);

      gain.gain.setValueAtTime(this.volume * 0.7, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.035);
    } else if (this.currentPack === 'bubblePop') {
      // Frequency swept drop (600Hz down to 200Hz)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.04);

      gain.gain.setValueAtTime(this.volume * 0.9, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    }
  }

  playHover() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(this.currentPack === 'cyberBeep' ? 880 : 380, now);

    gain.gain.setValueAtTime(this.volume * 0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.015);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.02);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { UISoundPacksEngine };
}
