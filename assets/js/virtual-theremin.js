/**
 * Dynamic Web Audio Theremin (#1416)
 * Continuous pitch and volume synthesizer controlled by cursor/touch coordinates.
 * Features customizable waveforms (sine, triangle, saw), variable LFO vibrato,
 * portamento glide, and antenna visualizer feedback.
 */

class VirtualTheremin {
    constructor(audioContext = null) {
        this.ctx = audioContext || (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext) ? new (window.AudioContext || window.webkitAudioContext)() : null);
        this.oscillator = null;
        this.gainNode = null;
        this.vibratoOsc = null;
        this.vibratoGain = null;
        this.active = false;

        this.minFreq = 65.41;   // C2
        this.maxFreq = 1046.50; // C6
        this.waveform = 'sine';
        this.vibratoRate = 5.5; // Hz
        this.vibratoDepth = 6.0; // Hz
    }

    init() {
        if (!this.ctx) return false;

        this.oscillator = this.ctx.createOscillator();
        this.oscillator.type = this.waveform;
        this.oscillator.frequency.setValueAtTime(440, this.ctx.currentTime);

        this.gainNode = this.ctx.createGain();
        this.gainNode.gain.setValueAtTime(0, this.ctx.currentTime);

        // LFO Vibrato circuit
        if (typeof this.ctx.createOscillator === 'function') {
            this.vibratoOsc = this.ctx.createOscillator();
            this.vibratoOsc.type = 'sine';
            this.vibratoOsc.frequency.setValueAtTime(this.vibratoRate, this.ctx.currentTime);

            this.vibratoGain = this.ctx.createGain();
            this.vibratoGain.gain.setValueAtTime(this.vibratoDepth, this.ctx.currentTime);

            this.vibratoOsc.connect(this.vibratoGain);
            if (this.oscillator.frequency) {
                this.vibratoGain.connect(this.oscillator.frequency);
            }
        }

        this.oscillator.connect(this.gainNode);
        this.gainNode.connect(this.ctx.destination);

        return true;
    }

    start() {
        if (this.active) return;
        if (!this.oscillator) this.init();

        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        const now = this.ctx ? this.ctx.currentTime : 0;
        if (this.oscillator && typeof this.oscillator.start === 'function') {
            try { this.oscillator.start(now); } catch (e) {}
        }
        if (this.vibratoOsc && typeof this.vibratoOsc.start === 'function') {
            try { this.vibratoOsc.start(now); } catch (e) {}
        }

        this.active = true;
    }

    stop() {
        if (!this.active) return;
        if (this.gainNode && this.ctx) {
            this.gainNode.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
        }
        this.active = false;
    }

    setPointer(normX, normY) {
        // normX [0, 1] controls pitch (exponential frequency response)
        // normY [0, 1] controls volume (inverted, top = max volume)
        const clampedX = Math.max(0, Math.min(1, normX));
        const clampedY = Math.max(0, Math.min(1, normY));

        const freq = this.minFreq * Math.pow(this.maxFreq / this.minFreq, clampedX);
        const volume = (1.0 - clampedY) * 0.7;

        if (this.oscillator && this.ctx) {
            this.oscillator.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.02);
        }
        if (this.gainNode && this.ctx) {
            this.gainNode.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.02);
        }

        return { frequency: freq, volume };
    }

    setWaveform(type) {
        this.waveform = type;
        if (this.oscillator) {
            this.oscillator.type = type;
        }
    }

    setVibrato(rate, depth) {
        this.vibratoRate = rate;
        this.vibratoDepth = depth;
        if (this.vibratoOsc && this.ctx) {
            this.vibratoOsc.frequency.setValueAtTime(rate, this.ctx.currentTime);
        }
        if (this.vibratoGain && this.ctx) {
            this.vibratoGain.gain.setValueAtTime(depth, this.ctx.currentTime);
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { VirtualTheremin };
}

if (typeof window !== 'undefined') {
    window.VirtualTheremin = VirtualTheremin;
}
