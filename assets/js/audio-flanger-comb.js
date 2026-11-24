/**
 * AudioFlangerComb - Web Audio Dynamic Comb Filter & Flanger/Phaser Effect DSP Node
 * 
 * Implements vintage bucket-brigade short delay line flanging (0.5ms to 15ms),
 * feedback resonance loops, LFO modulation, and multi-stage all-pass phaser filter banks
 * for iconic sci-fi laser swooshes and jet-plane comb filter sweeps.
 */

class AudioFlangerComb {
  constructor(audioContext = null, options = {}) {
    this.ctx = audioContext;
    this.speed = options.speed !== undefined ? options.speed : 0.4; // LFO Hz
    this.delayMs = options.delayMs !== undefined ? options.delayMs : 3.5; // Base delay in ms
    this.depthMs = options.depthMs !== undefined ? options.depthMs : 2.0; // Modulation depth in ms
    this.feedback = options.feedback !== undefined ? options.feedback : 0.65; // Feedback gain
    this.stages = options.stages || 4; // Phaser stages (4 or 8)

    this.inputNode = null;
    this.outputNode = null;
    this.wetGain = null;
    this.dryGain = null;
    this.delayNode = null;
    this.feedbackNode = null;
    this.lfoNode = null;
    this.lfoGain = null;
    this.phaserFilters = [];

    if (this.ctx) {
      this.initNodes();
    }
  }

  ensureContext() {
    if (!this.ctx && typeof AudioContext !== 'undefined') {
      this.ctx = new AudioContext();
    } else if (!this.ctx && typeof webkitAudioContext !== 'undefined') {
      this.ctx = new webkitAudioContext();
    }
    if (this.ctx && !this.inputNode) {
      this.initNodes();
    }
    return this.ctx;
  }

  initNodes() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    this.inputNode = this.ctx.createGain();
    this.outputNode = this.ctx.createGain();
    this.dryGain = this.ctx.createGain();
    this.wetGain = this.ctx.createGain();

    this.dryGain.gain.setValueAtTime(0.707, now);
    this.wetGain.gain.setValueAtTime(0.707, now);

    // Flanger modulated delay line
    this.delayNode = this.ctx.createDelay(0.05);
    this.delayNode.delayTime.setValueAtTime(this.delayMs / 1000, now);

    // Feedback loop
    this.feedbackNode = this.ctx.createGain();
    this.feedbackNode.gain.setValueAtTime(this.feedback, now);

    // LFO modulator
    this.lfoNode = this.ctx.createOscillator();
    this.lfoNode.type = 'triangle';
    this.lfoNode.frequency.setValueAtTime(this.speed, now);

    this.lfoGain = this.ctx.createGain();
    this.lfoGain.gain.setValueAtTime(this.depthMs / 1000, now);

    this.lfoNode.connect(this.lfoGain);
    this.lfoGain.connect(this.delayNode.delayTime);

    // Connect input through flanger and feedback loop
    this.inputNode.connect(this.dryGain);
    this.dryGain.connect(this.outputNode);

    this.inputNode.connect(this.delayNode);
    this.delayNode.connect(this.feedbackNode);
    this.feedbackNode.connect(this.delayNode);

    // Multi-stage all-pass phaser filter bank
    let lastFilterNode = this.delayNode;
    this.phaserFilters = [];
    for (let i = 0; i < this.stages; i++) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'allpass';
      filter.frequency.setValueAtTime(1000 * Math.pow(1.5, i), now);
      filter.Q.setValueAtTime(1.0, now);
      lastFilterNode.connect(filter);
      lastFilterNode = filter;
      this.phaserFilters.push(filter);
    }

    lastFilterNode.connect(this.wetGain);
    this.wetGain.connect(this.outputNode);

    this.lfoNode.start();
  }

  setSpeed(hz) {
    this.speed = Math.max(0.05, Math.min(15, hz));
    if (this.lfoNode && this.ctx) {
      this.lfoNode.frequency.setTargetAtTime(this.speed, this.ctx.currentTime, 0.02);
    }
  }

  setFeedback(amount) {
    this.feedback = Math.max(0, Math.min(0.95, amount));
    if (this.feedbackNode && this.ctx) {
      this.feedbackNode.gain.setTargetAtTime(this.feedback, this.ctx.currentTime, 0.02);
    }
  }

  setDepth(depthMs) {
    this.depthMs = Math.max(0.1, Math.min(10, depthMs));
    if (this.lfoGain && this.ctx) {
      this.lfoGain.gain.setTargetAtTime(this.depthMs / 1000, this.ctx.currentTime, 0.02);
    }
  }

  connect(destination) {
    if (this.outputNode) {
      this.outputNode.connect(destination);
    }
  }

  disconnect() {
    if (this.outputNode) {
      this.outputNode.disconnect();
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AudioFlangerComb };
}
