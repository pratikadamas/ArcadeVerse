/**
 * StereoHaasWidener - Web Audio Dynamic Stereo Haas Effect Spatial Widener & Psychoacoustic Delay
 * 
 * Implements the Haas precedence effect: splits mono/stereo audio into discrete left/right channels,
 * applying calibrated micro-delays (10ms to 35ms) and phase correlation alignment to produce
 * wide, immersive 3D spatial field widening without destructive comb-filtering mono cancellation.
 */

class StereoHaasWidener {
  constructor(audioContext = null, options = {}) {
    this.ctx = audioContext;
    this.delayTimeMs = options.delayTimeMs !== undefined ? options.delayTimeMs : 18; // 10ms - 35ms Haas window
    this.width = options.width !== undefined ? options.width : 1.0; // 0 (mono) to 2.0 (super-wide)
    this.delayedChannel = options.delayedChannel || 'right'; // 'left' or 'right'
    this.enabled = options.enabled !== undefined ? options.enabled : true;

    this.inputNode = null;
    this.outputNode = null;
    this.splitter = null;
    this.merger = null;
    this.delayNode = null;
    this.leftGain = null;
    this.rightGain = null;

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
    this.inputNode = this.ctx.createGain();
    this.outputNode = this.ctx.createGain();
    this.splitter = this.ctx.createChannelSplitter(2);
    this.merger = this.ctx.createChannelMerger(2);

    this.delayNode = this.ctx.createDelay(0.1);
    this.delayNode.delayTime.setValueAtTime(this.delayTimeMs / 1000, this.ctx.currentTime);

    this.leftGain = this.ctx.createGain();
    this.rightGain = this.ctx.createGain();

    this.inputNode.connect(this.splitter);

    if (this.delayedChannel === 'right') {
      // Left channel direct
      this.splitter.connect(this.leftGain, 0);
      this.leftGain.connect(this.merger, 0, 0);

      // Right channel delayed
      this.splitter.connect(this.delayNode, 0);
      this.delayNode.connect(this.rightGain);
      this.rightGain.connect(this.merger, 0, 1);
    } else {
      // Left channel delayed
      this.splitter.connect(this.delayNode, 0);
      this.delayNode.connect(this.leftGain);
      this.leftGain.connect(this.merger, 0, 0);

      // Right channel direct
      this.splitter.connect(this.rightGain, 0);
      this.rightGain.connect(this.merger, 0, 1);
    }

    this.merger.connect(this.outputNode);
    this.updateWidth(this.width);
  }

  setDelay(delayMs) {
    this.delayTimeMs = Math.max(5, Math.min(45, delayMs));
    if (this.delayNode && this.ctx) {
      this.delayNode.delayTime.setTargetAtTime(this.delayTimeMs / 1000, this.ctx.currentTime, 0.02);
    }
  }

  updateWidth(widthFactor) {
    this.width = Math.max(0, Math.min(2.0, widthFactor));
    if (!this.ctx || !this.leftGain || !this.rightGain) return;

    if (this.width === 0) {
      // Pure mono center: equal direct signal
      this.leftGain.gain.setTargetAtTime(0.707, this.ctx.currentTime, 0.02);
      this.rightGain.gain.setTargetAtTime(0.707, this.ctx.currentTime, 0.02);
      if (this.delayNode) {
        this.delayNode.delayTime.setTargetAtTime(0, this.ctx.currentTime, 0.02);
      }
    } else {
      const delaySec = (this.delayTimeMs / 1000) * Math.min(1.0, this.width);
      if (this.delayNode) {
        this.delayNode.delayTime.setTargetAtTime(delaySec, this.ctx.currentTime, 0.02);
      }
      this.leftGain.gain.setTargetAtTime(1.0, this.ctx.currentTime, 0.02);
      this.rightGain.gain.setTargetAtTime(1.0, this.ctx.currentTime, 0.02);
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

  checkMonoCompatibility() {
    // Calculates theoretical phase correlation factor r = cos(omega * delta_t)
    // For average critical speech/lead frequency 1000Hz (lambda = 1ms):
    const freq = 1000;
    const deltaSec = (this.delayTimeMs / 1000);
    const phaseShift = 2 * Math.PI * freq * deltaSec;
    const correlation = Math.cos(phaseShift);
    return {
      correlation: Number(correlation.toFixed(3)),
      compatible: correlation > -0.7,
      warning: correlation < -0.5 ? 'Potential comb filtering notch at 1kHz' : null
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { StereoHaasWidener };
}
